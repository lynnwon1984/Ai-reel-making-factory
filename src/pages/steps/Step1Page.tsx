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
  const [activeTab, setActiveTab] = useState<'purified' | 'audit' | 'logic'>('purified');
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

  // ===== Input Section =====
  const inputSection = (
    <InputSection stepNumber={1} projectId={pid} value={inputText} onChange={setInputText} />
  );

  // ===== Operation Section =====
  const operationSection = (
    <div className="px-6 py-3 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <button
          onClick={handleRun}
          disabled={isRunning || !inputText.trim()}
          className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${
            isRunning || !inputText.trim()
              ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:from-blue-500 hover:to-cyan-500 shadow-md active:scale-[0.98]'
          }`}
        >
          {isRunning ? '⏳ 执行中...' : '▶ 开始审计'}
        </button>
        <button
          onClick={() => setShowPrompt(!showPrompt)}
          className={`px-3 py-2.5 text-xs rounded-lg transition-colors ${
            showPrompt ? 'bg-amber-600/20 text-amber-400' : 'text-gray-400 bg-gray-800 hover:bg-gray-700'
          }`}
        >
          P 提示词
        </button>
      </div>

      {/* Stream output */}
      {auditStep?.status === 'running' && auditStep.streamText && (
        <div className="p-3 bg-gray-950 rounded-lg max-h-28 overflow-auto">
          <pre className="text-xs text-green-400/80 font-mono whitespace-pre-wrap" style={{ textAlign: 'left' }}>
            {auditStep.streamText}
          </pre>
        </div>
      )}
      {auditStep?.status === 'error' && auditStep.error && (
        <div className="p-3 bg-red-950/30 rounded-lg">
          <p className="text-xs text-red-400" style={{ textAlign: 'left' }}>{auditStep.error}</p>
        </div>
      )}

      {/* Prompt Editor */}
      {showPrompt && stageConfig && (
        <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700/30">
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

  // ===== Output Content =====
  const outputContent = purifiedScript ? (
    <div>
      {/* Tabs */}
      <div className="flex gap-2 mb-5">
        {([
          { key: 'purified' as const, label: '净化剧本', icon: '📄' },
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

      {/* Tab Content */}
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
        <p>执行审计后，结果将在此显示</p>
      </div>
    </div>
  );

  return (
    <StepLayout stepNumber={1} stepTitle="剧本审计与净化" projectId={pid} inputSection={inputSection} operationSection={operationSection} downloadButtons={downloadButtons}>
      {outputContent}
    </StepLayout>
  );
}
