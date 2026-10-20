import { useState, useCallback, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import StepLayout, { InputSection } from './StepLayout';
import PromptEditor from '../../components/PromptEditor';
import { usePipeline } from '../../hooks/usePipeline';
import { useStepData } from '../../hooks/useStepData';
import { loadSettings } from '../../components/SettingsPanel';
import { exportPurifiedScript, exportAuditReport } from '../../utils/exporter';
import type { PipelineSettings, PurifiedScript, StructuredScript } from '../../lib/types';
import { STAGE_CONFIGS } from '../../lib/constants';

export default function Step1Page() {
  const { id: projectId } = useParams<{ id: string }>();
  const pid = projectId || '';
  const [inputText, setInputText] = useState('');
  const [settings, setSettings] = useState<PipelineSettings>(loadSettings);
  const [showPrompt, setShowPrompt] = useState(false);
  const [promptTarget, setPromptTarget] = useState<'audit' | 'structure'>('audit');
  const [activeTab, setActiveTab] = useState<'purified' | 'audit' | 'logic' | 'structure'>('purified');
  const { steps, isRunning, startPipeline, updateSettings, executeStep } = usePipeline();
  const { saveStepOutput } = useStepData(pid);

  const auditStep = steps.find((s) => s.id === 'audit');
  const structureStep = steps.find((s) => s.id === 'structure');

  const purifiedScript: PurifiedScript | null =
    auditStep?.status === 'done' && auditStep.result
      ? (auditStep.result as PurifiedScript)
      : null;

  const structuredScript: StructuredScript | null =
    structureStep?.status === 'done' && structureStep.result
      ? (structureStep.result as StructuredScript)
      : null;

  const auditConfig = STAGE_CONFIGS.find((s) => s.id === 'audit');
  const structureConfig = STAGE_CONFIGS.find((s) => s.id === 'structure');

  const handleRunAudit = useCallback(() => {
    if (!inputText.trim()) return;
    startPipeline(inputText, settings);
  }, [inputText, startPipeline, settings]);

  const handleRunStructure = useCallback(() => {
    executeStep('structure');
  }, [executeStep]);

  useEffect(() => {
    if (purifiedScript && auditStep?.status === 'done') {
      saveStepOutput(1, auditStep.result);
    }
  }, [purifiedScript, auditStep, saveStepOutput]);

  useEffect(() => {
    if (structuredScript && structureStep?.status === 'done') {
      // Save structure output with a sub-key
      localStorage.setItem(`project-${pid}-step1-structure-output`, JSON.stringify({
        stepNumber: 1,
        timestamp: Date.now(),
        data: structureStep.result,
        inputSource: 'inherited',
      }));
    }
  }, [structuredScript, structureStep, pid]);

  const handlePromptChange = (prompt: string) => {
    const next = {
      ...settings,
      customPrompts: { ...settings.customPrompts, [promptTarget]: prompt },
    };
    setSettings(next);
    updateSettings(next);
  };

  const projectName = (() => {
    try {
      const raw = localStorage.getItem(`project-${pid}`);
      if (raw) return JSON.parse(raw).name || '未命名项目';
    } catch { /* ignore */ }
    return '未命名项目';
  })();

  // ===== Input Section =====
  const inputSection = (
    <InputSection stepNumber={1} projectId={pid} value={inputText} onChange={setInputText} />
  );

  // ===== Operation Section =====
  const operationSection = (
    <div className="px-6 py-3 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        {/* Audit button */}
        <button
          onClick={handleRunAudit}
          disabled={isRunning || !inputText.trim()}
          className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${
            isRunning || !inputText.trim()
              ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:from-blue-500 hover:to-cyan-500 shadow-md active:scale-[0.98]'
          }`}
        >
          {auditStep?.status === 'running' ? '⏳ 审计中...' : auditStep?.status === 'done' ? '✅ 审计完成' : '▶ 开始审计'}
        </button>

        {/* Structure button (only enabled after audit completes) */}
        <button
          onClick={handleRunStructure}
          disabled={isRunning || !purifiedScript}
          className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${
            isRunning || !purifiedScript
              ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:from-violet-500 hover:to-purple-500 shadow-md active:scale-[0.98]'
          }`}
        >
          {structureStep?.status === 'running' ? '⏳ 结构化中...' : structureStep?.status === 'done' ? '✅ 结构化完成' : '▶ 剧本结构化'}
        </button>

        {/* Prompt toggle */}
        <div className="flex items-center gap-1 ml-auto">
          <button
            onClick={() => { setPromptTarget('audit'); setShowPrompt(true); }}
            className={`px-3 py-2.5 text-xs rounded-lg transition-colors ${
              showPrompt && promptTarget === 'audit' ? 'bg-amber-600/20 text-amber-400' : 'text-gray-400 bg-gray-800 hover:bg-gray-700'
            }`}
          >
            P 审计
          </button>
          <button
            onClick={() => { setPromptTarget('structure'); setShowPrompt(true); }}
            className={`px-3 py-2.5 text-xs rounded-lg transition-colors ${
              showPrompt && promptTarget === 'structure' ? 'bg-amber-600/20 text-amber-400' : 'text-gray-400 bg-gray-800 hover:bg-gray-700'
            }`}
          >
            P 结构化
          </button>
        </div>
      </div>

      {/* Stream output */}
      {auditStep?.status === 'running' && auditStep.streamText && (
        <div className="p-3 bg-gray-950 rounded-lg max-h-28 overflow-auto">
          <div className="text-[10px] text-blue-400 mb-1 font-medium">审计中...</div>
          <pre className="text-xs text-green-400/80 font-mono whitespace-pre-wrap" style={{ textAlign: 'left' }}>
            {auditStep.streamText}
          </pre>
        </div>
      )}
      {structureStep?.status === 'running' && structureStep.streamText && (
        <div className="p-3 bg-gray-950 rounded-lg max-h-28 overflow-auto">
          <div className="text-[10px] text-violet-400 mb-1 font-medium">结构化中...</div>
          <pre className="text-xs text-green-400/80 font-mono whitespace-pre-wrap" style={{ textAlign: 'left' }}>
            {structureStep.streamText}
          </pre>
        </div>
      )}
      {auditStep?.status === 'error' && auditStep.error && (
        <div className="p-3 bg-red-950/30 rounded-lg">
          <p className="text-xs text-red-400" style={{ textAlign: 'left' }}>{auditStep.error}</p>
        </div>
      )}
      {structureStep?.status === 'error' && structureStep.error && (
        <div className="p-3 bg-red-950/30 rounded-lg">
          <p className="text-xs text-red-400" style={{ textAlign: 'left' }}>{structureStep.error}</p>
        </div>
      )}

      {/* Prompt Editor */}
      {showPrompt && promptTarget === 'audit' && auditConfig && (
        <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700/30">
          <PromptEditor
            stageId="audit"
            defaultPrompt={auditConfig.defaultSystemPrompt}
            customPrompt={settings.customPrompts?.audit}
            onPromptChange={handlePromptChange}
            availableVariables={auditConfig.availableVariables}
            onReset={() => {
              const next = { ...settings, customPrompts: { ...settings.customPrompts } };
              (next.customPrompts as Record<string, string | undefined>)['audit'] = undefined;
              setSettings(next);
              updateSettings(next);
            }}
          />
        </div>
      )}
      {showPrompt && promptTarget === 'structure' && structureConfig && (
        <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700/30">
          <PromptEditor
            stageId="structure"
            defaultPrompt={structureConfig.defaultSystemPrompt}
            customPrompt={settings.customPrompts?.structure}
            onPromptChange={handlePromptChange}
            availableVariables={structureConfig.availableVariables}
            onReset={() => {
              const next = { ...settings, customPrompts: { ...settings.customPrompts } };
              (next.customPrompts as Record<string, string | undefined>)['structure'] = undefined;
              setSettings(next);
              updateSettings(next);
            }}
          />
        </div>
      )}
    </div>
  );

  // ===== Download Buttons =====
  const downloadButtons = purifiedScript ? (
    <div className="flex gap-3">
      <button
        onClick={() => exportPurifiedScript(purifiedScript.fullText, projectName)}
        className="px-4 py-2 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 rounded-lg text-white transition-colors"
      >
        📥 净化剧本 (.txt)
      </button>
      <button
        onClick={() => exportAuditReport(purifiedScript, projectName)}
        className="px-4 py-2 text-xs font-medium bg-teal-600 hover:bg-teal-700 rounded-lg text-white transition-colors"
      >
        📋 审计报告 (.md)
      </button>
    </div>
  ) : null;

  // ===== Confidence badge =====
  const confidenceBadge = (confidence: string) => {
    const colors = {
      explicit: 'bg-green-900/40 text-green-400 border-green-500/30',
      inferred: 'bg-yellow-900/40 text-yellow-400 border-yellow-500/30',
      unknown: 'bg-red-900/40 text-red-400 border-red-500/30',
    };
    const labels = { explicit: '明确', inferred: '推断', unknown: '未知' };
    return (
      <span className={`px-1.5 py-0.5 text-[10px] rounded border ${colors[confidence as keyof typeof colors] || colors.unknown}`}>
        {labels[confidence as keyof typeof labels] || confidence}
      </span>
    );
  };

  // ===== Output Content =====
  const outputContent = purifiedScript ? (
    <div>
      {/* Tabs */}
      <div className="flex gap-2 mb-5">
        {([
          { key: 'purified' as const, label: '净化剧本', icon: '📄' },
          { key: 'structure' as const, label: `场景结构 (${structuredScript?.scenes.length || '—'})`, icon: '🗂️' },
          { key: 'audit' as const, label: '审计报告', icon: '📋' },
          { key: 'logic' as const, label: `逻辑断链 (${purifiedScript.logicIssues.length})`, icon: '⚠️' },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-xs font-medium rounded-lg transition-colors ${
              activeTab === tab.key
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                : 'text-gray-500 bg-gray-800/50 hover:bg-gray-700/50'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Purified Script */}
      {activeTab === 'purified' && (
        <div className="bg-gray-800/40 rounded-xl border border-green-500/20 p-5">
          <h4 className="text-xs font-semibold text-green-400 mb-3">净化剧本</h4>
          <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap leading-relaxed" style={{ textAlign: 'left' }}>
            {purifiedScript.fullText}
          </pre>
          <div className="mt-3 pt-3 border-t border-gray-700/30 text-xs text-gray-500">
            {purifiedScript.totalScenes} 个场景 · {purifiedScript.characterNames.length} 个角色
          </div>
        </div>
      )}

      {/* Tab: Structured Scenes */}
      {activeTab === 'structure' && (
        <div>
          {!structuredScript ? (
            <div className="text-center py-12 text-gray-500">
              <div className="text-4xl mb-3 opacity-30">🗂️</div>
              <p className="text-sm mb-2">点击上方「▶ 剧本结构化」按钮，提取场景结构信息</p>
              <p className="text-xs text-gray-600">结构化将提取每个场景的地点、角色、台词、动作、道具，并标注缺失信息</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Global notes */}
              <div className="bg-gray-800/40 rounded-xl border border-violet-500/20 p-4">
                <div className="flex items-center gap-4 text-xs text-gray-400">
                  <span>总场景：<span className="text-violet-400 font-bold">{structuredScript.globalNotes.totalScenes}</span></span>
                  <span>平均完整度：<span className={`font-bold ${structuredScript.globalNotes.averageCompleteness >= 60 ? 'text-green-400' : structuredScript.globalNotes.averageCompleteness >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>{structuredScript.globalNotes.averageCompleteness}%</span></span>
                  <span>低完整度场景：<span className="text-red-400 font-bold">{structuredScript.globalNotes.lowCompletenessScenes.length}</span></span>
                </div>
                {Object.keys(structuredScript.globalNotes.characterAppearanceConsistency).length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-700/30">
                    <div className="text-[10px] text-gray-500 mb-1.5">角色外观一致性</div>
                    <div className="space-y-1">
                      {Object.entries(structuredScript.globalNotes.characterAppearanceConsistency).map(([name, desc]) => (
                        <div key={name} className="text-xs text-gray-400">
                          <span className="text-gray-200 font-medium">{name}</span>：{desc}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Scene cards */}
              {structuredScript.scenes.map((scene) => (
                <div key={scene.sceneNumber} className="bg-gray-800/40 rounded-xl border border-gray-700/30 overflow-hidden">
                  {/* Scene header */}
                  <div className="px-4 py-3 bg-gray-800/60 border-b border-gray-700/30 flex items-center gap-3">
                    <span className="text-xs font-bold text-violet-400 bg-violet-600/20 px-2 py-0.5 rounded">
                      场景 {scene.sceneNumber + 1}
                    </span>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-gray-300">{scene.location.value || '—'}</span>
                      {confidenceBadge(scene.location.confidence)}
                      <span className="text-gray-600">·</span>
                      <span className="text-gray-300">{scene.timeOfDay.value || '—'}</span>
                      {confidenceBadge(scene.timeOfDay.confidence)}
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        scene.completenessScore >= 60 ? 'bg-green-900/40 text-green-400' :
                        scene.completenessScore >= 40 ? 'bg-yellow-900/40 text-yellow-400' :
                        'bg-red-900/40 text-red-400'
                      }`}>
                        {scene.completenessScore}%
                      </span>
                      {scene.sceneTypes.map((t) => (
                        <span key={t} className="text-[10px] text-gray-500 bg-gray-700/50 px-1.5 py-0.5 rounded">{t}</span>
                      ))}
                    </div>
                  </div>

                  <div className="p-4 space-y-3">
                    {/* Characters */}
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-gray-500 w-12 shrink-0">角色</span>
                      <div className="flex gap-1.5 flex-wrap">
                        {scene.characters.map((c) => (
                          <span key={c} className="text-gray-200 bg-gray-700/50 px-2 py-0.5 rounded text-xs">{c}</span>
                        ))}
                        {scene.characters.length === 0 && <span className="text-gray-600 italic">无</span>}
                      </div>
                    </div>

                    {/* Explicit actions */}
                    {scene.explicitActions.length > 0 && (
                      <div className="flex items-start gap-2 text-xs">
                        <span className="text-gray-500 w-12 shrink-0">动作</span>
                        <div className="space-y-1">
                          {scene.explicitActions.map((a, i) => (
                            <div key={i} className="text-gray-300">• {a}</div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Dialogue (show first 5) */}
                    {scene.dialogue.length > 0 && (
                      <div className="flex items-start gap-2 text-xs">
                        <span className="text-gray-500 w-12 shrink-0">台词</span>
                        <div className="space-y-1 flex-1">
                          {scene.dialogue.slice(0, 5).map((d, i) => (
                            <div key={i} className="text-gray-300">
                              <span className="text-blue-400 font-medium">{d.speaker}</span>
                              {d.emotionHint && <span className="text-gray-500 ml-1">({d.emotionHint})</span>}
                              <span className="text-gray-500 ml-1">：</span>
                              <span className="text-gray-400">"{d.text}"</span>
                            </div>
                          ))}
                          {scene.dialogue.length > 5 && (
                            <div className="text-gray-600">...还有 {scene.dialogue.length - 5} 句台词</div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Props */}
                    {scene.props.length > 0 && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-gray-500 w-12 shrink-0">道具</span>
                        <div className="flex gap-1.5 flex-wrap">
                          {scene.props.map((p) => (
                            <span key={p} className="text-amber-300 bg-amber-900/20 px-2 py-0.5 rounded text-xs border border-amber-500/20">{p}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Missing info */}
                    {scene.missingInfo.length > 0 && (
                      <div className="flex items-start gap-2 text-xs pt-2 border-t border-gray-700/20">
                        <span className="text-red-400/60 w-12 shrink-0">缺失</span>
                        <div className="flex gap-1.5 flex-wrap">
                          {scene.missingInfo.map((m, i) => (
                            <span key={i} className="text-red-400/70 bg-red-900/10 px-2 py-0.5 rounded text-[10px] border border-red-500/10" title={m.note}>
                              {m.field}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Audit Report */}
      {activeTab === 'audit' && (
        <div className="bg-gray-800/40 rounded-xl border border-teal-500/20 p-5">
          <h4 className="text-xs font-semibold text-teal-400 mb-3">审计报告</h4>
          <div className="text-xs text-gray-400 space-y-2">
            <p>去重段落：<span className="text-gray-200 font-medium">{purifiedScript.auditNotes.duplicatesRemoved}</span></p>
            <p>噪音标记清除：<span className="text-gray-200 font-medium">{purifiedScript.auditNotes.noiseMarkersRemoved}</span></p>
            <p>场景合并：<span className="text-gray-200 font-medium">{purifiedScript.auditNotes.scenesMerged}</span></p>
            <p>原始行数：<span className="text-gray-200">{purifiedScript.auditNotes.originalLineCount}</span> → 净化后：<span className="text-green-400 font-medium">{purifiedScript.auditNotes.purifiedLineCount}</span></p>
          </div>
        </div>
      )}

      {/* Tab: Logic Issues */}
      {activeTab === 'logic' && (
        <div className="bg-gray-800/40 rounded-xl border border-amber-500/20 p-5">
          <h4 className="text-xs font-semibold text-amber-400 mb-3">逻辑断链 ({purifiedScript.logicIssues.length})</h4>
          {purifiedScript.logicIssues.length > 0 ? (
            <div className="space-y-2">
              {purifiedScript.logicIssues.map((issue, i) => (
                <div key={i} className="p-3 bg-gray-900/50 rounded-lg text-xs" style={{ textAlign: 'left' }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-1.5 py-0.5 rounded font-medium ${
                      issue.severity === '严重' ? 'bg-red-900/50 text-red-400' :
                      issue.severity === '中等' ? 'bg-yellow-900/50 text-yellow-400' :
                      'bg-gray-700 text-gray-400'
                    }`}>{issue.severity}</span>
                    <span className="text-gray-300 font-medium">{issue.type}</span>
                  </div>
                  <p className="text-gray-400">{issue.description}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-green-400/60 text-sm">
              <div className="text-3xl mb-2">✨</div>
              <p>未发现逻辑断链</p>
            </div>
          )}
        </div>
      )}
    </div>
  ) : (
    <div className="flex items-center justify-center h-full">
      <div className="text-center text-gray-500 text-sm">
        <div className="text-5xl mb-4 opacity-20">📋</div>
        <p>上传剧本并执行审计后，结果将在此显示</p>
      </div>
    </div>
  );

  return (
    <StepLayout stepNumber={1} stepTitle="剧本审计与净化" stepDescription="净化剧本内容，去除无效场景、重复内容和逻辑问题，输出干净的剧本" projectId={pid} inputSection={inputSection} operationSection={operationSection} downloadButtons={downloadButtons}>
      {outputContent}
    </StepLayout>
  );
}
