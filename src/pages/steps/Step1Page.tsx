import { useState, useCallback, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import StepLayout, { InputSection } from './StepLayout';
import PromptEditor from '../../components/PromptEditor';
import { usePipeline } from '../../hooks/usePipeline';
import { useStepData } from '../../hooks/useStepData';
import { loadSettings } from '../../components/SettingsPanel';
import { exportPurifiedScript, exportAuditReport } from '../../utils/exporter';
import type { PipelineSettings, PurifiedScript } from '../../lib/types';
import { STAGE_CONFIGS } from '../../lib/constants';

export default function Step1Page() {
  const { id: projectId } = useParams<{ id: string }>();
  const pid = projectId || '';
  const [inputText, setInputText] = useState('');
  const [settings, setSettings] = useState<PipelineSettings>(loadSettings);
  const [showPrompt, setShowPrompt] = useState(false);
  const { steps, isRunning, startPipeline, updateSettings } = usePipeline();
  const { saveStepOutput } = useStepData(pid);

  const auditStep = steps.find((s) => s.id === 'audit');
  const purifiedScript: PurifiedScript | null =
    auditStep?.status === 'done' && auditStep.result
      ? (auditStep.result as PurifiedScript)
      : null;

  const stageConfig = STAGE_CONFIGS.find((s) => s.id === 'audit');

  const handleRun = useCallback(() => {
    if (!inputText.trim()) return;
    startPipeline(inputText, settings);
  }, [inputText, startPipeline, settings]);

  // Save output when audit completes
  useEffect(() => {
    if (purifiedScript && auditStep?.status === 'done') {
      saveStepOutput(1, auditStep.result);
    }
  }, [purifiedScript, auditStep, saveStepOutput]);

  const handlePromptChange = (prompt: string) => {
    const next = { ...settings, customPrompts: { ...settings.customPrompts, audit: prompt } };
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

  return (
    <StepLayout stepNumber={1} stepTitle="剧本审计与净化" projectId={pid}>
      {/* Input */}
      <InputSection stepNumber={1} projectId={pid} value={inputText} onChange={setInputText} />

      {/* Operation Area */}
      <div className="px-4 py-3 border-b border-gray-700/50">
        <div className="flex items-center gap-3">
          <button
            onClick={handleRun}
            disabled={isRunning || !inputText.trim()}
            className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${
              isRunning || !inputText.trim()
                ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:from-blue-500 hover:to-cyan-500 shadow-md active:scale-[0.98]'
            }`}
          >
            {isRunning ? '⏳ 执行中...' : '▶ 执行审计'}
          </button>
          <button
            onClick={() => setShowPrompt(!showPrompt)}
            className={`px-3 py-2 text-xs rounded-lg transition-colors ${
              showPrompt ? 'bg-amber-600/20 text-amber-400' : 'text-gray-400 bg-gray-800 hover:bg-gray-700'
            }`}
          >
            P 提示词
          </button>
        </div>

        {/* Stream output */}
        {auditStep?.status === 'running' && auditStep.streamText && (
          <div className="mt-3 p-3 bg-gray-950 rounded-lg max-h-32 overflow-auto">
            <pre className="text-xs text-green-400/80 font-mono whitespace-pre-wrap" style={{ textAlign: 'left' }}>
              {auditStep.streamText}
            </pre>
          </div>
        )}
        {auditStep?.status === 'error' && auditStep.error && (
          <div className="mt-3 p-3 bg-red-950/30 rounded-lg">
            <p className="text-xs text-red-400" style={{ textAlign: 'left' }}>{auditStep.error}</p>
          </div>
        )}

        {/* Prompt Editor */}
        {showPrompt && stageConfig && (
          <div className="mt-3 p-3 bg-gray-800/50 rounded-lg border border-gray-700/30">
            <PromptEditor
              stageId="audit"
              defaultPrompt={stageConfig.defaultSystemPrompt}
              customPrompt={settings.customPrompts?.audit}
              onPromptChange={handlePromptChange}
              availableVariables={stageConfig.availableVariables}
              onReset={() => {
                const next = { ...settings, customPrompts: { ...settings.customPrompts } };
                (next.customPrompts as Record<string, string | undefined>)['audit'] = undefined;
                setSettings(next);
                updateSettings(next);
              }}
            />
          </div>
        )}
      </div>

      {/* Output Area */}
      <div className="p-4">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">输出结果</h3>
        {purifiedScript ? (
          <div className="space-y-4">
            <div className="bg-gray-800/50 rounded-lg border border-green-500/20 p-4">
              <h4 className="text-xs font-semibold text-green-400 mb-2">净化剧本</h4>
              <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap max-h-64 overflow-auto" style={{ textAlign: 'left' }}>
                {purifiedScript.fullText}
              </pre>
              <div className="mt-2 text-xs text-gray-500">
                {purifiedScript.totalScenes} 个场景 · {purifiedScript.characterNames.length} 个角色
              </div>
            </div>

            <div className="bg-gray-800/50 rounded-lg border border-teal-500/20 p-4">
              <h4 className="text-xs font-semibold text-teal-400 mb-2">审计报告</h4>
              <div className="text-xs text-gray-400 space-y-1">
                <p>去重段落：{purifiedScript.auditNotes.duplicatesRemoved}</p>
                <p>噪音标记清除：{purifiedScript.auditNotes.noiseMarkersRemoved}</p>
                <p>场景合并：{purifiedScript.auditNotes.scenesMerged}</p>
                <p>原始行数：{purifiedScript.auditNotes.originalLineCount} → 净化后：{purifiedScript.auditNotes.purifiedLineCount}</p>
              </div>
              {purifiedScript.logicIssues.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs text-amber-400 mb-1">逻辑断链 ({purifiedScript.logicIssues.length})</p>
                  {purifiedScript.logicIssues.slice(0, 3).map((issue, i) => (
                    <p key={i} className="text-xs text-gray-500" style={{ textAlign: 'left' }}>
                      [{issue.severity}] {issue.type}：{issue.description}
                    </p>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => exportPurifiedScript(purifiedScript.fullText, projectName)}
                className="flex-1 px-3 py-2 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 rounded-lg text-white transition-colors"
              >
                📥 下载净化剧本 (.txt)
              </button>
              <button
                onClick={() => exportAuditReport(purifiedScript, projectName)}
                className="flex-1 px-3 py-2 text-xs font-medium bg-teal-600 hover:bg-teal-700 rounded-lg text-white transition-colors"
              >
                📥 下载审计报告 (.md)
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500 text-sm">
            <div className="text-4xl mb-3 opacity-30">📋</div>
            <p>执行审计后，结果将在此显示</p>
          </div>
        )}
      </div>
    </StepLayout>
  );
}
