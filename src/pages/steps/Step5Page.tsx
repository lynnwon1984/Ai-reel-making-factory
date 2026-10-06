import { useState, useCallback, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import StepLayout, { InputSection } from './StepLayout';
import PromptEditor from '../../components/PromptEditor';
import { usePipeline } from '../../hooks/usePipeline';
import { useStepData } from '../../hooks/useStepData';
import { loadSettings } from '../../components/SettingsPanel';
import type { PipelineSettings, Shot, ScriptAnalysis, StoryboardScript, QualityReport, RepairFinalResult } from '../../lib/types';
import { STAGE_CONFIGS } from '../../lib/constants';
import { downloadFile, exportFinalStoryboard, exportFinalQualityReport } from '../../utils/exporter';

export default function Step5Page() {
  const { id: projectId } = useParams<{ id: string }>();
  const pid = projectId || '';
  const [inputText, setInputText] = useState('');
  const [settings, setSettings] = useState<PipelineSettings>(loadSettings);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showRepairPrompt, setShowRepairPrompt] = useState(false);
  const [activeTab, setActiveTab] = useState<'quality' | 'final'>('quality');
  const { steps, isRunning, setScriptText, setPrevResults, executeStep, updateSettings } = usePipeline();
  const { getStepOutput, saveStepOutput } = useStepData(pid);

  const qualityStep = steps.find((s) => s.id === 'quality_check');
  const repairStep = steps.find((s) => s.id === 'repair_final');
  const qualityReport: QualityReport | null = qualityStep?.status === 'done' && qualityStep.result ? (qualityStep.result as QualityReport) : null;
  const repairResult: RepairFinalResult | null = repairStep?.status === 'done' && repairStep.result ? (repairStep.result as RepairFinalResult) : null;

  const qualityConfig = STAGE_CONFIGS.find((s) => s.id === 'quality_check');
  const repairConfig = STAGE_CONFIGS.find((s) => s.id === 'repair_final');

  const handleRunQuality = useCallback(() => {
    if (!inputText.trim()) return;
    const step2Output = getStepOutput(2); const step3Output = getStepOutput(3); const step4Output = getStepOutput(4);
    const prev: Record<string, unknown> = {};
    if (step2Output) prev.analysis = step2Output.data;
    if (step3Output) { const step3Data = step3Output.data as { shots?: Shot[] }; if (step3Data.shots) prev.shots = step3Data.shots; }
    if (step4Output) prev.storyboardScript = step4Output.data;
    setPrevResults(prev as { shots?: Shot[]; analysis?: ScriptAnalysis; storyboardScript?: StoryboardScript });
    setScriptText(inputText);
    executeStep('quality_check');
  }, [inputText, setScriptText, setPrevResults, executeStep, getStepOutput]);

  const handleRunRepair = useCallback(() => {
    if (!qualityReport) return;
    const step2Output = getStepOutput(2); const step3Output = getStepOutput(3); const step4Output = getStepOutput(4);
    const prev: Record<string, unknown> = {};
    if (step2Output) prev.analysis = step2Output.data;
    if (step3Output) { const step3Data = step3Output.data as { shots?: Shot[] }; if (step3Data.shots) prev.shots = step3Data.shots; }
    prev.qualityReport = qualityReport;
    if (step4Output) prev.storyboardScript = step4Output.data;
    setPrevResults(prev as { shots?: Shot[]; analysis?: ScriptAnalysis; storyboardScript?: StoryboardScript });
    executeStep('repair_final');
  }, [qualityReport, setPrevResults, executeStep, getStepOutput]);

  useEffect(() => { if (qualityReport && qualityStep?.status === 'done') saveStepOutput(5, qualityStep.result); }, [qualityReport, qualityStep, saveStepOutput]);

  const handleQualityPromptChange = (prompt: string) => { const next = { ...settings, customPrompts: { ...settings.customPrompts, quality_check: prompt } }; setSettings(next); updateSettings(next); };
  const handleRepairPromptChange = (prompt: string) => { const next = { ...settings, customPrompts: { ...settings.customPrompts, repair_final: prompt } }; setSettings(next); updateSettings(next); };

  const qualityDone = qualityStep?.status === 'done';
  const repairRunning = repairStep?.status === 'running';

  // ===== Input Section =====
  const inputSection = (
    <InputSection stepNumber={5} projectId={pid} value={inputText} onChange={setInputText} />
  );

  // ===== Operation Section =====
  const operationSection = (
    <div className="px-6 py-3 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={handleRunQuality} disabled={isRunning || !inputText.trim()}
          className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${isRunning || !inputText.trim() ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:from-blue-500 hover:to-cyan-500 shadow-md active:scale-[0.98]'}`}>
          {isRunning && qualityStep?.status === 'running' ? '⏳ 质检中...' : '▶ 质检'}
        </button>
        <button onClick={handleRunRepair} disabled={isRunning || !qualityDone}
          className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${isRunning || !qualityDone ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-gradient-to-r from-amber-600 to-orange-600 text-white hover:from-amber-500 hover:to-orange-500 shadow-md active:scale-[0.98]'}`}>
          {repairRunning ? '⏳ 修复格式化中...' : '🔧 修复 + 格式化'}
        </button>
        <button onClick={() => setShowPrompt(!showPrompt)} className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${showPrompt ? 'bg-amber-600/20 text-amber-400' : 'text-gray-400 bg-gray-800 hover:bg-gray-700'}`}>P 质检提示词</button>
        <button onClick={() => setShowRepairPrompt(!showRepairPrompt)} className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${showRepairPrompt ? 'bg-orange-600/20 text-orange-400' : 'text-gray-400 bg-gray-800 hover:bg-gray-700'}`}>P 修复提示词</button>
      </div>

      {qualityStep?.status === 'running' && qualityStep.streamText && (
        <div className="p-3 bg-gray-950 rounded-lg max-h-24 overflow-auto">
          <pre className="text-xs text-green-400/80 font-mono whitespace-pre-wrap" style={{ textAlign: 'left' }}>{qualityStep.streamText}</pre>
        </div>
      )}
      {qualityStep?.status === 'error' && qualityStep.error && (
        <div className="p-2 bg-red-950/30 rounded-lg"><p className="text-xs text-red-400">{qualityStep.error}</p></div>
      )}
      {repairStep?.status === 'running' && repairStep.streamText && (
        <div className="p-3 bg-gray-950 rounded-lg max-h-24 overflow-auto">
          <pre className="text-xs text-orange-400/80 font-mono whitespace-pre-wrap" style={{ textAlign: 'left' }}>{repairStep.streamText}</pre>
        </div>
      )}
      {repairStep?.status === 'error' && repairStep.error && (
        <div className="p-2 bg-red-950/30 rounded-lg"><p className="text-xs text-red-400">{repairStep.error}</p></div>
      )}

      {showPrompt && qualityConfig && (
        <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700/30">
          <PromptEditor stageId="quality_check" defaultPrompt={qualityConfig.defaultSystemPrompt} customPrompt={settings.customPrompts?.quality_check} onPromptChange={handleQualityPromptChange} availableVariables={qualityConfig.availableVariables}
            onReset={() => { const next = { ...settings, customPrompts: { ...settings.customPrompts } }; (next.customPrompts as Record<string, string | undefined>)['quality_check'] = undefined; setSettings(next); updateSettings(next); }} />
        </div>
      )}
      {showRepairPrompt && repairConfig && (
        <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700/30">
          <PromptEditor stageId="repair_final" defaultPrompt={repairConfig.defaultSystemPrompt} customPrompt={settings.customPrompts?.repair_final} onPromptChange={handleRepairPromptChange} availableVariables={repairConfig.availableVariables}
            onReset={() => { const next = { ...settings, customPrompts: { ...settings.customPrompts } }; (next.customPrompts as Record<string, string | undefined>)['repair_final'] = undefined; setSettings(next); updateSettings(next); }} />
        </div>
      )}
    </div>
  );

  // ===== Download Buttons =====
  const downloadButtons = (
    <div className="flex gap-3 flex-wrap">
      {qualityReport && <button onClick={() => { const lines: string[] = ['# 分镜头剧本质检报告', '', `- 总 Clip 数: ${qualityReport.totalClips}`, `- 总时长: ${qualityReport.totalDuration}s`, `- 质量评分: ${qualityReport.overallScore}/100`, `- 格式合规率: ${qualityReport.formatCompliance}%`]; if (qualityReport.continuityIssues.length > 0) { lines.push('', '## 连贯性问题'); qualityReport.continuityIssues.forEach(i => lines.push(`- ${i}`)); } downloadFile(lines.join('\n'), 'quality-report.md', 'text/markdown'); }} className="px-4 py-2 text-xs font-medium bg-cyan-600 hover:bg-cyan-700 rounded-lg text-white transition-colors">📥 质检报告 MD</button>}
      {qualityReport && <button onClick={() => downloadFile(JSON.stringify(qualityReport, null, 2), 'quality-report.json', 'application/json')} className="px-4 py-2 text-xs font-medium bg-blue-600 hover:bg-blue-700 rounded-lg text-white transition-colors">📥 质检 JSON</button>}
      {repairResult && <button onClick={() => exportFinalStoryboard(repairResult.finalStoryboardText, '分镜项目')} className="px-4 py-2 text-xs font-medium bg-orange-600 hover:bg-orange-700 rounded-lg text-white transition-colors">📥 最终分镜头剧本 .md</button>}
      {repairResult && <button onClick={() => { const blob = new Blob([repairResult.finalStoryboardText], { type: 'text/plain;charset=utf-8' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = '分镜项目_分镜头剧本.txt'; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); }} className="px-4 py-2 text-xs font-medium bg-amber-600 hover:bg-amber-700 rounded-lg text-white transition-colors">📥 最终分镜头剧本 .txt</button>}
      {repairResult && <button onClick={() => exportFinalQualityReport({ fixedIssues: repairResult.fixedIssues, manualReviewItems: repairResult.manualReviewItems, formatCompliance: repairResult.formatCompliance }, '分镜项目')} className="px-4 py-2 text-xs font-medium bg-green-600 hover:bg-green-700 rounded-lg text-white transition-colors">📥 质检报告</button>}
    </div>
  );

  // ===== Output Content =====
  const outputContent = (
    <div>
      {/* Tabs */}
      <div className="flex gap-2 mb-5">
        <button onClick={() => setActiveTab('quality')}
          className={`px-4 py-2 text-xs font-medium rounded-lg transition-colors ${activeTab === 'quality' ? 'bg-cyan-600/20 text-cyan-400 border border-cyan-500/30' : 'text-gray-500 bg-gray-800/50 hover:bg-gray-700/50'}`}>
          ✅ 质检报告 {qualityReport ? '✅' : ''}
        </button>
        <button onClick={() => setActiveTab('final')} disabled={!qualityDone}
          className={`px-4 py-2 text-xs font-medium rounded-lg transition-colors ${!qualityDone ? 'text-gray-700 bg-gray-900/30 cursor-not-allowed' : activeTab === 'final' ? 'bg-orange-600/20 text-orange-400 border border-orange-500/30' : 'text-gray-500 bg-gray-800/50 hover:bg-gray-700/50'}`}>
          🔧 最终分镜头剧本 {repairResult ? '✅' : ''}
        </button>
      </div>

      {/* Quality Tab */}
      {activeTab === 'quality' && (
        qualityReport ? (
          <div className="space-y-4">
            <div className="bg-gray-800/40 rounded-xl border border-cyan-500/20 p-5">
              <h4 className="text-xs font-semibold text-cyan-400 mb-3">总览</h4>
              <div className="text-xs text-gray-400 space-y-1.5">
                <p>总 Clip 数: <span className="text-gray-200">{qualityReport.totalClips}</span></p>
                <p>总时长: <span className="text-gray-200">{qualityReport.totalDuration}s</span></p>
                <p>质量评分: <span className={`font-bold ${qualityReport.overallScore >= 80 ? 'text-green-400' : qualityReport.overallScore >= 60 ? 'text-amber-400' : 'text-red-400'}`}>{qualityReport.overallScore}/100</span></p>
                <p>格式合规率: <span className="text-gray-200">{qualityReport.formatCompliance}%</span></p>
                {qualityReport.summary && <p className="text-gray-300 mt-2">{qualityReport.summary}</p>}
              </div>
            </div>
            {/* Per-Clip checks */}
            {qualityReport.clipChecks && qualityReport.clipChecks.length > 0 && (
              <div className="bg-gray-800/40 rounded-xl border border-gray-600/20 p-5">
                <h4 className="text-xs font-semibold text-gray-400 mb-3">
                  逐 Clip 检查 ({qualityReport.clipChecks.filter(c => !c.compliant).length} 个不合规)
                </h4>
                <div className="space-y-2 max-h-80 overflow-auto">
                  {qualityReport.clipChecks.map((clip, i) => (
                    <div key={i} className={`p-2.5 rounded-lg text-xs ${clip.compliant ? 'bg-green-900/10 border border-green-500/10' : 'bg-red-900/10 border border-red-500/20'}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-1.5 py-0.5 rounded font-mono ${clip.compliant ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
                          {clip.compliant ? '✓' : '✗'} Clip {String(clip.clipNumber).padStart(2, '0')}
                        </span>
                        <span className="text-gray-500">{clip.shotType}</span>
                        <span className="text-gray-500">{clip.duration}s</span>
                        <span className="text-gray-500">{clip.charCount}字</span>
                        {clip.cameraMovements.length > 0 && <span className="text-gray-600">运镜: {clip.cameraMovements.join(', ')}</span>}
                      </div>
                      {!clip.compliant && clip.issues.length > 0 && (
                        <div className="mt-1 space-y-0.5">
                          {clip.issues.map((issue, j) => (
                            <div key={j} className="flex items-start gap-1.5">
                              <span className={`px-1 py-0.5 rounded text-[10px] shrink-0 ${issue.severity === '严重' ? 'bg-red-900/50 text-red-400' : issue.severity === '中等' ? 'bg-yellow-900/50 text-yellow-400' : 'bg-gray-700 text-gray-400'}`}>{issue.severity}</span>
                              <span className="text-gray-400">{issue.type}：{issue.description}</span>
                              <span className="text-gray-600 ml-auto shrink-0">→ {issue.suggestion}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {qualityReport.continuityIssues.length > 0 && (
              <div className="bg-gray-800/40 rounded-xl border border-amber-500/20 p-5">
                <h4 className="text-xs font-semibold text-amber-400 mb-3">连贯性问题 ({qualityReport.continuityIssues.length})</h4>
                <div className="text-xs text-gray-400 space-y-1.5">
                  {qualityReport.continuityIssues.map((issue, i) => (<p key={i} style={{ textAlign: 'left' }}>{i + 1}. {issue}</p>))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-64"><div className="text-center text-gray-500 text-sm"><div className="text-5xl mb-4 opacity-20">✅</div><p>执行质检后，报告将在此显示</p></div></div>
        )
      )}

      {/* Final Tab */}
      {activeTab === 'final' && (
        repairResult ? (
          <div className="space-y-4">
            <div className="bg-gray-800/40 rounded-xl border border-orange-500/20 p-5">
              <h4 className="text-xs font-semibold text-orange-400 mb-3">修复报告</h4>
              <div className="text-xs text-gray-400 space-y-1.5">
                <p>已修复问题: <span className="text-green-400 font-bold">{repairResult.fixedIssues}</span></p>
                <p>格式合规度: <span className={`font-bold ${repairResult.formatCompliance >= 80 ? 'text-green-400' : repairResult.formatCompliance >= 60 ? 'text-amber-400' : 'text-red-400'}`}>{repairResult.formatCompliance}/100</span></p>
                <p>需人工确认: <span className={repairResult.manualReviewItems.length > 0 ? 'text-amber-400 font-bold' : 'text-gray-500'}>{repairResult.manualReviewItems.length} 项</span></p>
              </div>
            </div>
            {repairResult.manualReviewItems.length > 0 && (
              <div className="bg-gray-800/40 rounded-xl border border-amber-500/20 p-5">
                <h4 className="text-xs font-semibold text-amber-400 mb-3">需人工确认项</h4>
                <div className="text-xs text-gray-400 space-y-1.5">
                  {repairResult.manualReviewItems.map((item, i) => (<p key={i} style={{ textAlign: 'left' }}>{i + 1}. {item}</p>))}
                </div>
              </div>
            )}
            <div className="bg-gray-800/40 rounded-xl border border-gray-600/20 p-5">
              <h4 className="text-xs font-semibold text-gray-400 mb-3">最终分镜头剧本</h4>
              <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap max-h-[500px] overflow-auto leading-relaxed" style={{ textAlign: 'left' }}>{repairResult.finalStoryboardText}</pre>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-64"><div className="text-center text-gray-500 text-sm"><div className="text-5xl mb-4 opacity-20">🔧</div><p>质检完成后，点击「修复 + 格式化」生成最终分镜头剧本</p></div></div>
        )
      )}
    </div>
  );

  return (
    <StepLayout stepNumber={5} stepTitle="质检与导出" projectId={pid} inputSection={inputSection} operationSection={operationSection} downloadButtons={downloadButtons}>
      {outputContent}
    </StepLayout>
  );
}
