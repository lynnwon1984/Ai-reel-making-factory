import { useState, useRef, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useProjects } from '../../hooks/useProjects';
import { useStepData } from '../../hooks/useStepData';
import { useFullPipeline } from '../../hooks/useFullPipeline';
import { FULL_PIPELINE_STEPS } from '../../lib/constants';
import { getModule } from '../../modules/registry';

export const STEP_TITLES = [
  '剧本审计与净化',
  '剧本深度分析',
  '镜头分解',
  '提示词生成',
  '质量评审与修复',
  '问题诊断',
  '剧本修复',
  '分解检查',
  '提示词检查',
  '最终修复',
];

export const STEP_SHORT_NAMES = ['剧本准备', '分析', '诊断', '修复', '分镜', '分镜质检', '剧本', '合规检查', '质检', '修复导出'];

export const STEP_IDS = ['audit', 'analyze', 'diagnose', 'repair', 'decompose', 'decompose_check', 'prompt_gen', 'promptgen_check', 'quality_check', 'repair_final'] as const;

const STEP_NUMS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

interface StepLayoutProps {
  stepNumber: number;
  stepTitle: string;
  stepDescription?: string;
  projectId: string;
  children: React.ReactNode;
  inputSection?: React.ReactNode;
  operationSection?: React.ReactNode;
  downloadButtons?: React.ReactNode;
}

export default function StepLayout({ stepNumber, projectId, children, inputSection, operationSection, downloadButtons, stepDescription }: StepLayoutProps) {
  const { getProject } = useProjects();
  const project = getProject(projectId);
  const moduleDef = project ? getModule(project.moduleId) : undefined;

  return (
    <div className="h-screen flex flex-col bg-gray-900 text-white overflow-hidden">
      {/* ===== Header ===== */}
      <header className="shrink-0 border-b border-gray-700/60 px-6 py-3 bg-gray-900">
        {/* Row 1: Project info + actions */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-lg shrink-0">🎬</span>
            <span className="text-sm font-semibold text-gray-100 truncate">{project?.name || '未命名项目'}</span>
            {moduleDef && (
              <div className="flex items-center gap-1.5 text-xs text-gray-500 shrink-0">
                <span>{moduleDef.icon}</span>
                <span className="hidden sm:inline">{moduleDef.name}</span>
                <span className="text-gray-700">·</span>
                <span>{moduleDef.aspectRatio}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              to={`/project/${projectId}/settings`}
              className="p-1.5 rounded-md text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
              title="设置"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </Link>
            <Link
              to="/"
              className="p-1.5 rounded-md text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
              title="首页"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" />
              </svg>
            </Link>
          </div>
        </div>

        {/* Row 2: Recommended flow */}
        <div className="flex items-center gap-1 text-sm overflow-x-auto">
          <span className="text-gray-600 mr-1 shrink-0 text-xs">推荐流程：</span>
          {STEP_NUMS.map((n) => {
            const isCurrent = n === stepNumber;
            return (
              <span key={n} className="flex items-center shrink-0">
                {n > 1 && <span className="text-gray-600 mx-0.5 text-xs">→</span>}
                <Link
                  to={`/project/${projectId}/step${n}`}
                  className={`px-2.5 py-1.5 rounded-md transition-colors text-center whitespace-nowrap ${
                    isCurrent
                      ? 'bg-blue-600/25 text-blue-300 font-bold text-xs ring-1 ring-blue-500/40'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800 text-[11px]'
                  }`}
                >
                  {n}.{STEP_SHORT_NAMES[n - 1]}
                </Link>
              </span>
            );
          })}
          <span className="text-gray-700 ml-2 text-[10px] shrink-0">可点击跳转</span>
        </div>

        {/* Row 3: Full pipeline auto-run */}
        <FullPipelineBar projectId={projectId} />
      </header>

      {/* ===== Main: Top-Bottom Single Column ===== */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Input area */}
        {inputSection && (
          <div className="shrink-0 border-b border-gray-700/60">
            {inputSection}
          </div>
        )}

        {/* Operation area */}
        {operationSection && (
          <div className="shrink-0 border-b border-gray-700/60">
            {operationSection}
          </div>
        )}

        {/* Output area - fills remaining space */}
        <div className="flex-1 overflow-y-auto p-6 min-h-0">
          {stepDescription && (
            <div className="mb-5 flex items-start gap-2.5 px-4 py-3 rounded-lg bg-gray-800/40 border border-gray-700/30">
              <svg className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-gray-400 leading-relaxed">{stepDescription}</p>
            </div>
          )}
          {children}
        </div>

        {/* Download area */}
        {downloadButtons && (
          <div className="shrink-0 border-t border-gray-700/60 px-6 py-2 bg-gray-900/80">
            {downloadButtons}
          </div>
        )}
      </div>
    </div>
  );
}

// ===== Full Pipeline Auto-Run Bar =====

function FullPipelineBar({ projectId }: { projectId: string }) {
  const {
    steps: fpSteps,
    isAutoRunning,
    currentStepIndex,
    runFullPipeline,
    runFromCurrentStep,
    abort,
  } = useFullPipeline(projectId);

  const completedCount = fpSteps.filter((s) => s.status === 'done').length;
  const totalCount = fpSteps.length;
  const currentStep = currentStepIndex >= 0 ? fpSteps[currentStepIndex] : null;
  const hasError = fpSteps.some((s) => s.status === 'error');
  const allDone = fpSteps.every((s) => s.status === 'done');

  const handleRun = () => {
    if (allDone) {
      // Re-run from scratch
      runFullPipeline();
    } else if (hasError) {
      // Resume from error step
      runFromCurrentStep();
    } else {
      // Start from beginning or resume
      runFromCurrentStep();
    }
  };

  const buttonLabel = (() => {
    if (isAutoRunning) return `⏳ ${currentStep?.name || '执行中'}...`;
    if (allDone) return '✅ 全流程已完成';
    if (hasError) return '🔄 继续执行';
    if (completedCount > 0) return `▶ 继续全流程 (${completedCount}/${totalCount})`;
    return '▶ 一键执行全流程';
  })();

  return (
    <div className="flex items-center gap-3 mt-2 pt-2 border-t border-gray-800/60">
      {/* Run / Abort button */}
      <button
        onClick={isAutoRunning ? abort : handleRun}
        className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all shrink-0 ${
          isAutoRunning
            ? 'bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-500/30'
            : allDone
              ? 'bg-green-600/15 text-green-400 border border-green-500/25 hover:bg-green-600/25'
              : 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:from-indigo-500 hover:to-violet-500 shadow-md active:scale-[0.98]'
        }`}
      >
        {buttonLabel}
      </button>

      {/* Progress bar (visible during execution) */}
      {isAutoRunning && (
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-500"
              style={{ width: `${((completedCount + 0.5) / totalCount) * 100}%` }}
            />
          </div>
          <span className="text-[10px] text-gray-500 shrink-0 tabular-nums">
            {completedCount}/{totalCount}
          </span>
        </div>
      )}

      {/* Step indicators (compact) */}
      {!isAutoRunning && (
        <div className="flex items-center gap-1 flex-1 min-w-0 overflow-hidden">
          {fpSteps.map((step, i) => (
            <div
              key={step.id}
              className={`h-1 flex-1 rounded-full transition-colors ${
                step.status === 'done'
                  ? 'bg-green-500/60'
                  : step.status === 'error'
                    ? 'bg-red-500/60'
                    : step.status === 'running'
                      ? 'bg-blue-500/60 animate-pulse'
                      : 'bg-gray-800'
              }`}
              title={`${FULL_PIPELINE_STEPS[i]?.name || step.id}: ${step.status}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ===== Shared Input Section Component =====

interface InputSectionProps {
  stepNumber: number;
  projectId: string;
  value: string;
  onChange: (value: string) => void;
  headerExtra?: React.ReactNode;
}

export function InputSection({ stepNumber, projectId, value, onChange, headerExtra }: InputSectionProps) {
  const { getInheritedInput, setManualInput } = useStepData(projectId);
  const [source, setSource] = useState<'inherited' | 'uploaded'>(() => {
    if (stepNumber === 1) return 'uploaded';
    const inherited = getInheritedInput(stepNumber);
    return inherited ? 'inherited' : 'uploaded';
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const inheritedData = stepNumber > 1 ? getInheritedInput(stepNumber) : null;
  const hasInherited = inheritedData !== null;

  useEffect(() => {
    if (source === 'inherited' && inheritedData) {
      const text = typeof inheritedData.data === 'string'
        ? inheritedData.data
        : JSON.stringify(inheritedData.data, null, 2);
      onChange(text);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, inheritedData]);

  const handleFileUpload = useCallback((file: File) => {
    if (!file.name.match(/\.(txt|md)$/i)) {
      alert('仅支持 .txt 或 .md 文件');
      return;
    }
    if (file.size > 1024 * 1024) {
      alert('文件大小超过 1MB 限制');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      onChange(text);
      setSource('uploaded');
      setManualInput(stepNumber, text);
    };
    reader.readAsText(file);
  }, [onChange, stepNumber, setManualInput]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
    e.target.value = '';
  };

  const handleTextChange = (text: string) => {
    onChange(text);
    if (source === 'uploaded') {
      setManualInput(stepNumber, text);
    }
  };

  return (
    <div className="px-6 py-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">输入</span>
        <div className="flex items-center gap-2">
          {headerExtra}
          <span className="text-[10px] text-gray-600">{value.length} 字符</span>
        </div>
      </div>

      {/* Inherited hint banner (steps 2-5) */}
      {stepNumber > 1 && hasInherited && source !== 'inherited' && (
        <div className="mb-2 flex items-center justify-between px-3 py-1.5 rounded-md bg-blue-600/10 border border-blue-500/20">
          <span className="text-xs text-blue-400">检测到上一步有输出</span>
          <button
            onClick={() => setSource('inherited')}
            className="px-2 py-0.5 text-xs font-medium text-blue-300 bg-blue-600/20 rounded hover:bg-blue-600/30 transition-colors"
          >
            导入
          </button>
        </div>
      )}

      {/* Source indicator when inherited */}
      {source === 'inherited' && (
        <div className="mb-2 flex items-center justify-between px-3 py-1.5 rounded-md bg-gray-800 border border-gray-700/40">
          <div className="flex items-center gap-1.5">
            <svg className="w-3 h-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span className="text-xs text-gray-500">已导入（只读）</span>
          </div>
          <button
            onClick={() => setSource('uploaded')}
            className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
          >
            切换为上传
          </button>
        </div>
      )}

      {/* Upload button */}
      {source === 'uploaded' && (
        <div className="mb-2 flex gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 px-3 py-2 text-xs font-medium text-gray-300 bg-gray-800 border border-gray-700/50 rounded-lg hover:bg-gray-750 hover:border-gray-600 transition-colors"
          >
            📂 上传文件
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md"
            onChange={handleFileInput}
            className="hidden"
          />
        </div>
      )}

      {/* Textarea */}
      <textarea
        value={value}
        onChange={(e) => handleTextChange(e.target.value)}
        readOnly={source === 'inherited'}
        placeholder={stepNumber === 1 ? '上传或粘贴剧本文本...' : '上传文件，或导入上一步输出...'}
        className={`w-full h-36 resize-none rounded-lg px-3 py-2.5 text-sm font-mono bg-gray-950/60 border border-gray-700/40 text-gray-200 placeholder-gray-600 focus:outline-none focus:border-gray-600 transition-colors ${
          source === 'inherited' ? 'opacity-70 cursor-default' : ''
        }`}
        style={{ textAlign: 'left' }}
      />
    </div>
  );
}
