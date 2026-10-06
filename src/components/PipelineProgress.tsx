import { useState } from 'react';
import type { PipelineStepState, PipelineStepStatus, PipelineSettings, StageId, PurifiedScript } from '../lib/types';
import { STAGE_CONFIGS } from '../lib/constants';
import PromptEditor from './PromptEditor';
import { exportPurifiedScript, exportAuditReport } from '../utils/exporter';

interface PipelineProgressProps {
  steps: PipelineStepState[];
  isRunning: boolean;
  settings: PipelineSettings;
  projectName: string;
  onStart: () => void;
  onRetryStep: (stepIndex: number) => void;
  onSettingsChange: (settings: PipelineSettings) => void;
  onContinueStep: () => void;
  onContinueAll: () => void;
}

const statusConfig: Record<PipelineStepStatus, { icon: string; color: string; label: string }> = {
  idle: { icon: '○', color: 'text-gray-500', label: '等待中' },
  running: { icon: '◉', color: 'text-blue-400', label: '执行中' },
  done: { icon: '✓', color: 'text-green-400', label: '已完成' },
  error: { icon: '✕', color: 'text-red-400', label: '失败' },
};

function getResultSummary(step: PipelineStepState): string | null {
  if (step.status !== 'done' || !step.result) return null;
  const r = step.result as Record<string, unknown>;
  switch (step.id) {
    case 'audit':
      return "净化完成：" + ((r.totalScenes as number) ?? '?') + " 个场景";
    case 'analyze':
      return "分析完成：" + ((r.characters as unknown[])?.length ?? '?') + " 个角色";
    case 'decompose': {
      const shots = (r.shots as unknown[]) ?? [];
      return "分镜完成：" + shots.length + " 个镜头";
    }
    case 'prompt_gen':
      return "Prompt 生成：" + (Array.isArray(r) ? r.length : '?') + " 条";
    case 'quality_check':
      return "质检完成：评分 " + ((r.seedanceQualityScore as number) ?? '?') + "/100";
    default:
      return null;
  }
}

export default function PipelineProgress({
  steps,
  isRunning,
  settings,
  projectName,
  onStart,
  onRetryStep,
  onSettingsChange,
  onContinueStep,
  onContinueAll,
}: PipelineProgressProps) {
  const [expandedPrompt, setExpandedPrompt] = useState<StageId | null>(null);
  const completedCount = steps.filter((s) => s.status === 'done').length;
  const progressPercent = (completedCount / steps.length) * 100;
  const hasDoneSteps = steps.some((s) => s.status === 'done');
  const hasIdleSteps = steps.some((s) => s.status === 'idle');
  const allDone = steps.every((s) => s.status === 'done');

  const auditStep = steps.find((s) => s.id === 'audit');
  const purifiedScript: PurifiedScript | null =
    auditStep?.status === 'done' && auditStep.result
      ? (auditStep.result as PurifiedScript)
      : null;

  const handleCustomPromptChange = (stageId: StageId, prompt: string) => {
    const next = {
      ...settings,
      customPrompts: { ...settings.customPrompts, [stageId]: prompt },
    };
    onSettingsChange(next);
  };

  const handleResetPrompt = (stageId: StageId) => {
    const next = { ...settings, customPrompts: { ...settings.customPrompts } };
    delete next.customPrompts[stageId];
    onSettingsChange(next);
  };

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-700/50 shrink-0">
        <h3 className="text-sm font-semibold text-gray-200">流水线控制</h3>
        {/* Progress */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
            <span>总进度</span>
            <span>{completedCount}/{steps.length} 步骤</span>
          </div>
          <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
        {/* Start Button */}
        <button
          onClick={onStart}
          disabled={isRunning}
          className={`w-full mt-3 py-2.5 rounded-lg text-sm font-bold transition-all ${
            isRunning
              ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:from-blue-500 hover:to-cyan-500 shadow-md hover:shadow-lg active:scale-[0.98]'
          }`}
        >
          {isRunning ? '⏳ 转译中...' : '🚀 开始转译'}
        </button>
        {/* Continue All Button */}
        {hasDoneSteps && hasIdleSteps && !isRunning && (
          <button
            onClick={onContinueAll}
            className="w-full mt-2 py-2 text-sm bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg hover:from-blue-500 hover:to-cyan-500 shadow-md hover:shadow-lg active:scale-[0.98] transition-all"
          >
            ⚡ 一键完成全部 →
          </button>
        )}
        {/* All done indicator */}
        {allDone && (
          <div className="mt-2 text-center py-2 text-green-400 text-sm font-medium">
            ✓ 流水线全部完成
          </div>
        )}
      </div>

      {/* Steps */}
      <div className="flex-1 overflow-auto p-3 space-y-2">
        {steps.map((step, index) => {
          const config = statusConfig[step.status];
          const stageConfig = STAGE_CONFIGS.find((s) => s.id === step.id);
          const summary = getResultSummary(step);
          const isPromptExpanded = expandedPrompt === step.id;
          const isLastStep = index === steps.length - 1;
          const showContinueBtn = step.status === 'done' && !isLastStep && !isRunning && hasIdleSteps;
          const showAuditDownloads = step.id === 'audit' && step.status === 'done' && purifiedScript;

          return (
            <div
              key={step.id}
              className={`rounded-lg border transition-all ${
                step.status === 'running'
                  ? 'border-blue-500/30 bg-blue-950/20'
                  : step.status === 'error'
                  ? 'border-red-500/30 bg-red-950/20'
                  : step.status === 'done'
                  ? 'border-green-500/20 bg-green-950/10'
                  : 'border-gray-700/50 bg-gray-800/30'
              }`}
            >
              <div className="flex items-center gap-2.5 p-2.5">
                {/* Step Number */}
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    step.status === 'done'
                      ? 'bg-green-500/20 text-green-400'
                      : step.status === 'running'
                      ? 'bg-blue-500/20 text-blue-400'
                      : step.status === 'error'
                      ? 'bg-red-500/20 text-red-400'
                      : 'bg-gray-700/50 text-gray-500'
                  }`}
                >
                  {step.status === 'running' ? (
                    <span className="animate-spin text-xs">⟳</span>
                  ) : (
                    index + 1
                  )}
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-300">{step.name}</span>
                    <span className={`text-xs ${config.color}`}>{config.icon}</span>
                  </div>
                  {summary && (
                    <p className="text-xs text-green-400/70 mt-0.5">{summary}</p>
                  )}
                </div>
                {/* Prompt edit toggle */}
                <button
                  onClick={() => setExpandedPrompt(isPromptExpanded ? null : step.id)}
                  className={`px-1.5 py-0.5 text-xs rounded transition-colors ${
                    isPromptExpanded
                      ? 'bg-amber-600/20 text-amber-400'
                      : 'text-gray-500 hover:text-gray-300 hover:bg-gray-700/50'
                  }`}
                  title="自定义 Prompt"
                >
                  P
                </button>
                {/* Retry */}
                {(step.status === 'error' || step.status === 'done') && !isRunning && (
                  <button
                    onClick={() => onRetryStep(index)}
                    className="px-2 py-0.5 text-xs text-gray-400 bg-gray-700/50 rounded hover:bg-gray-700 transition-colors shrink-0"
                  >
                    重试
                  </button>
                )}
              </div>

              {/* Audit Download Buttons */}
              {showAuditDownloads && (
                <div className="mx-2.5 mb-2.5 flex gap-2">
                  <button
                    onClick={() => exportPurifiedScript(purifiedScript!.fullText, projectName)}
                    className="flex-1 px-3 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 rounded text-white transition-colors active:scale-[0.98]"
                  >
                    �� 下载净化剧本 (.txt)
                  </button>
                  <button
                    onClick={() => exportAuditReport(purifiedScript!, projectName)}
                    className="flex-1 px-3 py-1.5 text-xs font-medium bg-teal-600 hover:bg-teal-700 rounded text-white transition-colors active:scale-[0.98]"
                  >
                    📥 下载审计报告 (.md)
                  </button>
                </div>
              )}

              {/* Continue to next step button */}
              {showContinueBtn && (
                <div className="mx-2.5 mb-2.5">
                  <button
                    onClick={() => onContinueStep()}
                    className="w-full py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-500 transition-colors active:scale-[0.98]"
                  >
                    继续下一步 →
                  </button>
                </div>
              )}

              {/* Stream Output */}
              {step.status === 'running' && step.streamText && (
                <div className="mx-2.5 mb-2.5 p-2 bg-gray-950 rounded max-h-28 overflow-auto">
                  <pre
                    className="text-xs text-green-400/80 font-mono whitespace-pre-wrap"
                    style={{ textAlign: 'left' }}
                  >
                    {step.streamText}
                  </pre>
                </div>
              )}

              {/* Error */}
              {step.status === 'error' && step.error && (
                <div className="mx-2.5 mb-2.5 p-2 bg-red-950/30 rounded">
                  <p className="text-xs text-red-400" style={{ textAlign: 'left' }}>
                    {step.error}
                  </p>
                </div>
              )}

              {/* Prompt Editor (collapsible) */}
              {isPromptExpanded && stageConfig && (
                <div className="mx-2.5 mb-2.5 p-3 bg-gray-800/50 rounded-lg border border-gray-700/30">
                  <PromptEditor
                    stageId={step.id}
                    defaultPrompt={stageConfig.defaultSystemPrompt}
                    customPrompt={settings.customPrompts?.[step.id]}
                    onPromptChange={(p) => handleCustomPromptChange(step.id, p)}
                    availableVariables={stageConfig.availableVariables}
                    onReset={() => handleResetPrompt(step.id)}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
