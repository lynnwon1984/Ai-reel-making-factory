import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import StepLayout, { InputSection } from './StepLayout';
import PromptEditor from '../../components/PromptEditor';
import { usePipeline } from '../../hooks/usePipeline';
import { useStepData } from '../../hooks/useStepData';
import { loadSettings } from '../../components/SettingsPanel';
import type { PipelineSettings, ScriptAnalysis, PurifiedScript, DiagnosisResult, RepairResult, DiagnosisIssue, PipelineStepStatus } from '../../lib/types';
import { STAGE_CONFIGS } from '../../lib/constants';
import { downloadFile, exportDiagnosisReport, exportRepairedScript } from '../../utils/exporter';

async function callStandaloneSSE(
  endpoint: string,
  body: Record<string, unknown>,
  onToken: (token: string) => void,
  signal?: AbortSignal,
): Promise<unknown> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok) throw new Error(`API error ${response.status}: ${await response.text()}`);
  if (!response.body) throw new Error('No response body');
  return new Promise<unknown>((resolve, reject) => {
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    function pump(): void {
      reader.read().then(({ done, value }) => {
        if (done) { reject(new Error('Stream ended')); return; }
        buffer += decoder.decode(value, { stream: true });
        const doneIdx = buffer.indexOf('event: done');
        if (doneIdx !== -1) {
          const m = buffer.slice(doneIdx).match(/data:\s*(.+)/);
          if (m) { try { resolve(JSON.parse(m[1])); return; } catch { /* continue */ } }
        }
        const errorIdx = buffer.indexOf('event: error');
        if (errorIdx !== -1) {
          const m = buffer.slice(errorIdx).match(/data:\s*(.+)/);
          if (m) { try { reject(new Error(JSON.parse(m[1]).error || 'Unknown')); return; } catch { /* continue */ } }
        }
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          const t = line.trim();
          if (t.startsWith('data: ')) {
            try { const p = JSON.parse(t.slice(6)); if (p.token) onToken(p.token); } catch { /* skip */ }
          }
        }
        pump();
      }).catch(reject);
    }
    pump();
  });
}

export default function Step2Page() {
  const { id: projectId } = useParams<{ id: string }>();
  const pid = projectId || '';
  const [inputText, setInputText] = useState('');
  const [settings, setSettings] = useState<PipelineSettings>(loadSettings);
  const [showPrompt, setShowPrompt] = useState(false);
  const [activeTab, setActiveTab] = useState<'analysis' | 'diagnosis' | 'repair'>('analysis');
  const { steps, isRunning: pipelineRunning, setScriptText, setPrevResults, executeStep, updateSettings, settingsRef } = usePipeline();
  const { getStepOutput, saveStepOutput } = useStepData(pid);

  const [diagnoseState, setDiagnoseState] = useState<{ status: PipelineStepStatus; streamText: string; result?: DiagnosisResult; error?: string }>({ status: 'idle', streamText: '' });
  const [repairState, setRepairState] = useState<{ status: PipelineStepStatus; streamText: string; result?: RepairResult; error?: string }>({ status: 'idle', streamText: '' });
  const abortRef = useRef<AbortController | null>(null);

  const analyzeStep = steps.find((s) => s.id === 'analyze');
  const analysis: ScriptAnalysis | null = analyzeStep?.status === 'done' && analyzeStep.result ? (analyzeStep.result as ScriptAnalysis) : null;
  const diagnosis: DiagnosisResult | null = diagnoseState.status === 'done' && diagnoseState.result ? diagnoseState.result : null;
  const repair: RepairResult | null = repairState.status === 'done' && repairState.result ? repairState.result : null;

  const analyzeConfig = STAGE_CONFIGS.find((s) => s.id === 'analyze');
  const diagnoseConfig = STAGE_CONFIGS.find((s) => s.id === 'diagnose');
  const repairConfig = STAGE_CONFIGS.find((s) => s.id === 'repair');

  const canDiagnose = analysis !== null;
  const canRepair = diagnosis !== null;
  const isRunning = pipelineRunning || diagnoseState.status === 'running' || repairState.status === 'running';

  const handleRun = useCallback(() => {
    if (!inputText.trim()) return;
    const step1Output = getStepOutput(1);
    if (step1Output) setPrevResults({ purifiedScript: step1Output.data as PurifiedScript });
    setScriptText(inputText);
    executeStep('analyze');
  }, [inputText, setScriptText, setPrevResults, executeStep, getStepOutput]);

  const handleDiagnose = useCallback(async () => {
    if (!canDiagnose || !analysis) return;
    const step1Output = getStepOutput(1);
    const purifiedScript = step1Output?.data as PurifiedScript | undefined;
    if (!purifiedScript) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setDiagnoseState({ status: 'running', streamText: '' });
    setActiveTab('diagnosis');
    const customPrompt = settingsRef.current.customPrompts?.diagnose || undefined;
    let accumulated = '';
    try {
      const result = await callStandaloneSSE('/api/pipeline/step2-diagnose', { purifiedScript, analysis, settings: settingsRef.current, customPrompt },
        (token) => { accumulated += token; setDiagnoseState(s => ({ ...s, streamText: accumulated })); }, controller.signal);
      setDiagnoseState({ status: 'done', streamText: accumulated, result: result as DiagnosisResult });
    } catch (err) {
      setDiagnoseState({ status: 'error', streamText: accumulated, error: err instanceof Error ? err.message : 'Unknown error' });
    }
  }, [canDiagnose, analysis, getStepOutput, settingsRef]);

  const handleRepair = useCallback(async () => {
    if (!canRepair || !diagnosis) return;
    const step1Output = getStepOutput(1);
    const purifiedScript = step1Output?.data as PurifiedScript | undefined;
    if (!purifiedScript) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setRepairState({ status: 'running', streamText: '' });
    setActiveTab('repair');
    const customPrompt = settingsRef.current.customPrompts?.repair || undefined;
    let accumulated = '';
    try {
      const result = await callStandaloneSSE('/api/pipeline/step2-repair', { purifiedScript, diagnosis, settings: settingsRef.current, customPrompt },
        (token) => { accumulated += token; setRepairState(s => ({ ...s, streamText: accumulated })); }, controller.signal);
      setRepairState({ status: 'done', streamText: accumulated, result: result as RepairResult });
    } catch (err) {
      setRepairState({ status: 'error', streamText: accumulated, error: err instanceof Error ? err.message : 'Unknown error' });
    }
  }, [canRepair, diagnosis, getStepOutput, settingsRef]);

  useEffect(() => { if (analysis && analyzeStep?.status === 'done') saveStepOutput(2, analyzeStep.result); }, [analysis, analyzeStep, saveStepOutput]);

  const handlePromptChange = (prompt: string, stageId: string) => {
    const next = { ...settings, customPrompts: { ...settings.customPrompts, [stageId]: prompt } };
    setSettings(next); updateSettings(next);
  };

  const getSeverityColor = (severity: DiagnosisIssue['severity']) => {
    switch (severity) { case '严重': return 'border-red-500/40 bg-red-950/20'; case '中等': return 'border-yellow-500/40 bg-yellow-950/20'; case '轻微': return 'border-blue-500/40 bg-blue-950/20'; }
  };
  const getSeverityBadge = (severity: DiagnosisIssue['severity']) => {
    switch (severity) { case '严重': return 'bg-red-600 text-white'; case '中等': return 'bg-yellow-600 text-white'; case '轻微': return 'bg-blue-600 text-white'; }
  };

  // ===== Input Section =====
  const inputSection = (
    <InputSection stepNumber={2} projectId={pid} value={inputText} onChange={setInputText} />
  );

  // ===== Operation Section =====
  const operationSection = (
    <div className="px-6 py-3 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={handleRun} disabled={isRunning || !inputText.trim()}
          className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${isRunning || !inputText.trim() ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:from-blue-500 hover:to-cyan-500 shadow-md active:scale-[0.98]'}`}>
          {analyzeStep?.status === 'done' ? '✅ 分析完成' : analyzeStep?.status === 'running' ? '⏳ 分析中...' : '▶ 分析'}
        </button>
        <button onClick={handleDiagnose} disabled={isRunning || !canDiagnose}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${isRunning || !canDiagnose ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : diagnoseState.status === 'done' ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-500 hover:to-emerald-500 shadow-md' : 'bg-gradient-to-r from-amber-600 to-orange-600 text-white hover:from-amber-500 hover:to-orange-500 shadow-md active:scale-[0.98]'}`}>
          {diagnoseState.status === 'done' ? '✅ 诊断完成' : diagnoseState.status === 'running' ? '⏳ 诊断中...' : '🔍 诊断'}
        </button>
        <button onClick={handleRepair} disabled={isRunning || !canRepair}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${isRunning || !canRepair ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : repairState.status === 'done' ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-500 hover:to-emerald-500 shadow-md' : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-500 hover:to-pink-500 shadow-md active:scale-[0.98]'}`}>
          {repairState.status === 'done' ? '✅ 修复完成' : repairState.status === 'running' ? '⏳ 修复中...' : '🔧 修复'}
        </button>
        <button onClick={() => setShowPrompt(!showPrompt)} className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${showPrompt ? 'bg-amber-600/20 text-amber-400' : 'text-gray-400 bg-gray-800 hover:bg-gray-700'}`}>
          P 提示词
        </button>
      </div>

      {/* Stream outputs */}
      {analyzeStep?.status === 'running' && analyzeStep.streamText && (
        <div className="p-3 bg-gray-950 rounded-lg max-h-24 overflow-auto">
          <pre className="text-xs text-green-400/80 font-mono whitespace-pre-wrap" style={{ textAlign: 'left' }}>{analyzeStep.streamText}</pre>
        </div>
      )}
      {diagnoseState.status === 'running' && diagnoseState.streamText && (
        <div className="p-3 bg-gray-950 rounded-lg max-h-24 overflow-auto">
          <pre className="text-xs text-green-400/80 font-mono whitespace-pre-wrap" style={{ textAlign: 'left' }}>{diagnoseState.streamText}</pre>
        </div>
      )}
      {repairState.status === 'running' && repairState.streamText && (
        <div className="p-3 bg-gray-950 rounded-lg max-h-24 overflow-auto">
          <pre className="text-xs text-orange-400/80 font-mono whitespace-pre-wrap" style={{ textAlign: 'left' }}>{repairState.streamText}</pre>
        </div>
      )}

      {/* Errors */}
      {analyzeStep?.status === 'error' && analyzeStep.error && <div className="p-2 bg-red-950/30 rounded-lg"><p className="text-xs text-red-400">分析错误: {analyzeStep.error}</p></div>}
      {diagnoseState.status === 'error' && diagnoseState.error && <div className="p-2 bg-red-950/30 rounded-lg"><p className="text-xs text-red-400">诊断错误: {diagnoseState.error}</p></div>}
      {repairState.status === 'error' && repairState.error && <div className="p-2 bg-red-950/30 rounded-lg"><p className="text-xs text-red-400">修复错误: {repairState.error}</p></div>}

      {showPrompt && (
        <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700/30 space-y-3">
          {analyzeConfig && <PromptEditor stageId="analyze" defaultPrompt={analyzeConfig.defaultSystemPrompt} customPrompt={settings.customPrompts?.analyze} onPromptChange={(p) => handlePromptChange(p, 'analyze')} availableVariables={analyzeConfig.availableVariables} onReset={() => { const next = { ...settings, customPrompts: { ...settings.customPrompts } }; (next.customPrompts as Record<string, string | undefined>)['analyze'] = undefined; setSettings(next); updateSettings(next); }} />}
          {diagnoseConfig && <PromptEditor stageId="diagnose" defaultPrompt={diagnoseConfig.defaultSystemPrompt} customPrompt={settings.customPrompts?.diagnose} onPromptChange={(p) => handlePromptChange(p, 'diagnose')} availableVariables={diagnoseConfig.availableVariables} onReset={() => { const next = { ...settings, customPrompts: { ...settings.customPrompts } }; (next.customPrompts as Record<string, string | undefined>)['diagnose'] = undefined; setSettings(next); updateSettings(next); }} />}
          {repairConfig && <PromptEditor stageId="repair" defaultPrompt={repairConfig.defaultSystemPrompt} customPrompt={settings.customPrompts?.repair} onPromptChange={(p) => handlePromptChange(p, 'repair')} availableVariables={repairConfig.availableVariables} onReset={() => { const next = { ...settings, customPrompts: { ...settings.customPrompts } }; (next.customPrompts as Record<string, string | undefined>)['repair'] = undefined; setSettings(next); updateSettings(next); }} />}
        </div>
      )}
    </div>
  );

  // ===== Download Buttons =====
  const downloadButtons = (
    <div className="flex gap-3 flex-wrap">
      {analysis && <button onClick={() => downloadFile(JSON.stringify(analysis, null, 2), 'analysis.json', 'application/json')} className="px-4 py-2 text-xs font-medium bg-blue-600 hover:bg-blue-700 rounded-lg text-white transition-colors">📥 分析 JSON</button>}
      {analysis && <button onClick={() => { const lines: string[] = ['# 剧本深度分析报告', '', `## 类型: ${analysis.scriptType} / ${analysis.genre}`, `## 风格: ${analysis.style}`, `## 情绪基调: ${analysis.moodTone}`]; downloadFile(lines.join('\n'), 'analysis.md', 'text/markdown'); }} className="px-4 py-2 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 rounded-lg text-white transition-colors">📥 分析 MD</button>}
      {diagnosis && <button onClick={() => exportDiagnosisReport(diagnosis, `项目${pid}`)} className="px-4 py-2 text-xs font-medium bg-amber-600 hover:bg-amber-700 rounded-lg text-white transition-colors">📥 诊断报告 MD</button>}
      {repair && <button onClick={() => exportRepairedScript(repair.repairedText, `项目${pid}`)} className="px-4 py-2 text-xs font-medium bg-purple-600 hover:bg-purple-700 rounded-lg text-white transition-colors">📥 修复后剧本 TXT</button>}
    </div>
  );

  // ===== Output Content =====
  const outputContent = (
    <div>
      {/* Tabs */}
      <div className="flex gap-2 mb-5">
        {([
          { key: 'analysis' as const, label: '分析结果', done: !!analysis, color: 'blue' },
          { key: 'diagnosis' as const, label: '诊断报告', done: !!diagnosis, color: 'amber', disabled: !canDiagnose },
          { key: 'repair' as const, label: '修复后剧本', done: !!repair, color: 'purple', disabled: !canRepair },
        ]).map((tab) => (
          <button key={tab.key} onClick={() => !tab.disabled && setActiveTab(tab.key)}
            disabled={tab.disabled}
            className={`px-4 py-2 text-xs font-medium rounded-lg transition-colors ${
              tab.disabled ? 'text-gray-700 bg-gray-900/30 cursor-not-allowed' :
              activeTab === tab.key ? `bg-${tab.color}-600/20 text-${tab.color}-400 border border-${tab.color}-500/30` :
              'text-gray-500 bg-gray-800/50 hover:bg-gray-700/50'
            }`}>
            {tab.key === 'analysis' ? '📊' : tab.key === 'diagnosis' ? '🔍' : '🔧'} {tab.label} {tab.done ? '✅' : ''}
          </button>
        ))}
      </div>

      {/* Analysis Tab */}
      {activeTab === 'analysis' && (
        analysis ? (
          <div className="space-y-4">
            <div className="bg-gray-800/40 rounded-xl border border-blue-500/20 p-5">
              <h4 className="text-xs font-semibold text-blue-400 mb-3">基本信息</h4>
              <div className="text-xs text-gray-400 space-y-1.5">
                <p>类型: <span className="text-gray-200">{analysis.scriptType} / {analysis.genre}</span></p>
                <p>风格: <span className="text-gray-200">{analysis.style}</span></p>
                <p>情绪基调: <span className="text-gray-200">{analysis.moodTone}</span></p>
                <p>场景数: <span className="text-gray-200">{analysis.totalScenes}</span></p>
              </div>
            </div>
            <div className="bg-gray-800/40 rounded-xl border border-purple-500/20 p-5">
              <h4 className="text-xs font-semibold text-purple-400 mb-3">角色 ({analysis.characters.length})</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {analysis.characters.map((c, i) => (
                  <div key={i} className="text-xs text-gray-400 bg-gray-900/50 rounded-lg p-3">
                    <span className="text-gray-200 font-medium">{c.name}</span>
                    <span className="text-purple-400 ml-2">({c.role})</span>
                    <p className="text-gray-500 mt-1">{c.personality}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-gray-800/40 rounded-xl border border-indigo-500/20 p-5">
              <h4 className="text-xs font-semibold text-indigo-400 mb-3">剧情结构</h4>
              <div className="text-xs text-gray-400 space-y-1.5">
                <p>起: <span className="text-gray-200">{analysis.plotStructure.exposition}</span></p>
                <p>承: <span className="text-gray-200">{analysis.plotStructure.risingAction}</span></p>
                <p>转: <span className="text-gray-200">{analysis.plotStructure.climax}</span></p>
                <p>合: <span className="text-gray-200">{analysis.plotStructure.resolution}</span></p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-64"><div className="text-center text-gray-500 text-sm"><div className="text-5xl mb-4 opacity-20">🔍</div><p>执行分析后，结果将在此显示</p></div></div>
        )
      )}

      {/* Diagnosis Tab */}
      {activeTab === 'diagnosis' && (
        diagnosis ? (
          <div className="space-y-4">
            <div className="bg-gray-800/40 rounded-xl border border-amber-500/20 p-5">
              <h4 className="text-xs font-semibold text-amber-400 mb-3">诊断摘要</h4>
              <div className="grid grid-cols-4 gap-3">
                <div className="text-center"><div className="text-2xl font-bold text-white">{diagnosis.summary.totalIssues}</div><div className="text-xs text-gray-500">问题总数</div></div>
                <div className="text-center"><div className="text-2xl font-bold text-red-400">{diagnosis.summary.criticalCount}</div><div className="text-xs text-gray-500">严重</div></div>
                <div className="text-center"><div className="text-2xl font-bold text-yellow-400">{diagnosis.summary.moderateCount}</div><div className="text-xs text-gray-500">中等</div></div>
                <div className="text-center"><div className="text-2xl font-bold text-blue-400">{diagnosis.summary.minorCount}</div><div className="text-xs text-gray-500">轻微</div></div>
              </div>
            </div>
            {diagnosis.issues.length > 0 ? (
              <div className="space-y-2">
                {[...diagnosis.issues].sort((a, b) => ({ '严重': 0, '中等': 1, '轻微': 2 }[a.severity] ?? 3) - ({ '严重': 0, '中等': 1, '轻微': 2 }[b.severity] ?? 3))
                  .map((issue, i) => (
                    <div key={i} className={`rounded-xl border p-4 ${getSeverityColor(issue.severity)}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${getSeverityBadge(issue.severity)}`}>{issue.severity}</span>
                        <span className="text-xs text-gray-300 font-medium">{issue.type}</span>
                      </div>
                      <p className="text-xs text-gray-400 mb-1" style={{ textAlign: 'left' }}><span className="text-gray-500">位置：</span>{issue.location}</p>
                      <p className="text-xs text-gray-400 mb-1" style={{ textAlign: 'left' }}><span className="text-gray-500">描述：</span>{issue.description}</p>
                      <p className="text-xs text-green-400/70" style={{ textAlign: 'left' }}><span className="text-green-500/50">建议：</span>{issue.suggestion}</p>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="text-center py-6 text-green-400/60 text-sm"><div className="text-3xl mb-2">✨</div><p>未检测到剧本问题</p></div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-64"><div className="text-center text-gray-500 text-sm"><div className="text-5xl mb-4 opacity-20">🔍</div><p>执行诊断后，报告将在此显示</p></div></div>
        )
      )}

      {/* Repair Tab */}
      {activeTab === 'repair' && (
        repair ? (
          <div className="space-y-4">
            <div className="bg-gray-800/40 rounded-xl border border-purple-500/20 p-5">
              <h4 className="text-xs font-semibold text-purple-400 mb-3">修复摘要</h4>
              <div className="text-xs text-gray-400"><p>修复点数量：<span className="text-white font-medium">{repair.fixCount}</span></p></div>
            </div>
            <div className="bg-gray-900/50 rounded-xl border border-gray-700/30 p-5 max-h-[500px] overflow-auto">
              <h4 className="text-xs font-semibold text-gray-400 mb-3">修复后剧本预览</h4>
              <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap leading-relaxed" style={{ textAlign: 'left' }}
                dangerouslySetInnerHTML={{ __html: repair.repairedText.replace(/【修复：(.*?)】/g, '<span class="inline-block px-1 py-0.5 mx-0.5 text-xs font-medium bg-yellow-600/30 text-yellow-300 rounded border border-yellow-500/30">【修复：$1】</span>') }} />
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-64"><div className="text-center text-gray-500 text-sm"><div className="text-5xl mb-4 opacity-20">🔧</div><p>执行修复后，结果将在此显示</p></div></div>
        )
      )}
    </div>
  );

  return (
    <StepLayout stepNumber={2} stepTitle="剧本深度分析" projectId={pid} inputSection={inputSection} operationSection={operationSection} downloadButtons={downloadButtons}>
      {outputContent}
    </StepLayout>
  );
}
