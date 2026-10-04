import type { PipelineStepStatus } from '../lib/types';

export interface StepState {
  id: number;
  name: string;
  description: string;
  status: PipelineStepStatus;
  streamText?: string;
  error?: string;
}

interface PipelineProgressProps {
  steps: StepState[];
  isRunning: boolean;
  onStart: () => void;
  onRetryStep: (stepId: number) => void;
}

const statusConfig: Record<PipelineStepStatus, { icon: string; color: string; label: string }> = {
  idle: { icon: '○', color: 'text-gray-400', label: '等待中' },
  running: { icon: '◉', color: 'text-blue-500', label: '执行中' },
  done: { icon: '✓', color: 'text-green-500', label: '已完成' },
  error: { icon: '✕', color: 'text-red-500', label: '失败' },
};

export default function PipelineProgress({ steps, isRunning, onStart, onRetryStep }: PipelineProgressProps) {
  const completedCount = steps.filter(s => s.status === 'done').length;
  const progressPercent = (completedCount / steps.length) * 100;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-white">
        <h3 className="text-sm font-semibold text-gray-800">流水线控制</h3>
        {/* Overall Progress */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
            <span>总进度</span>
            <span>{completedCount}/{steps.length} 步骤</span>
          </div>
          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500 ease-out"
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
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-md hover:shadow-lg active:scale-[0.98]'
          }`}
        >
          {isRunning ? '⏳ 转译中...' : '🚀 开始转译'}
        </button>
      </div>

      {/* Steps */}
      <div className="flex-1 overflow-auto p-4 space-y-3">
        {steps.map((step, index) => {
          const config = statusConfig[step.status];
          return (
            <div
              key={step.id}
              className={`rounded-lg border transition-all ${
                step.status === 'running'
                  ? 'border-blue-200 bg-blue-50/50 shadow-sm'
                  : step.status === 'error'
                  ? 'border-red-200 bg-red-50/50'
                  : step.status === 'done'
                  ? 'border-green-200 bg-green-50/30'
                  : 'border-gray-200 bg-white'
              }`}
            >
              <div className="flex items-center gap-3 p-3">
                {/* Step Number */}
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  step.status === 'done'
                    ? 'bg-green-100 text-green-700'
                    : step.status === 'running'
                    ? 'bg-blue-100 text-blue-700'
                    : step.status === 'error'
                    ? 'bg-red-100 text-red-700'
                    : 'bg-gray-100 text-gray-500'
                }`}>
                  {step.status === 'running' ? (
                    <span className="animate-spin">⟳</span>
                  ) : (
                    index + 1
                  )}
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-800">{step.name}</span>
                    <span className={`text-xs ${config.color}`}>{config.icon} {config.label}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{step.description}</p>
                </div>
                {/* Retry */}
                {step.status === 'error' && (
                  <button
                    onClick={() => onRetryStep(step.id)}
                    className="px-2 py-1 text-xs text-red-600 bg-red-100 rounded hover:bg-red-200 transition-colors shrink-0"
                  >
                    重试
                  </button>
                )}
              </div>
              {/* Stream Output */}
              {step.status === 'running' && step.streamText && (
                <div className="mx-3 mb-3 p-2.5 bg-gray-900 rounded-md max-h-32 overflow-auto">
                  <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap" style={{ textAlign: 'left' }}>
                    {step.streamText}
                  </pre>
                </div>
              )}
              {/* Error */}
              {step.status === 'error' && step.error && (
                <div className="mx-3 mb-3 p-2.5 bg-red-100 rounded-md">
                  <p className="text-xs text-red-700" style={{ textAlign: 'left' }}>{step.error}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
