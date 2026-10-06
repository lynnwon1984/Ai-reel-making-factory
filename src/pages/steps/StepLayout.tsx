import { useState, useRef, useCallback, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useProjects } from '../../hooks/useProjects';
import { useStepData } from '../../hooks/useStepData';
import { getModule } from '../../modules/registry';

export const STEP_TITLES = [
  '剧本审计与净化',
  '剧本深度分析',
  '分镜设计',
  'Seedance Prompt',
  '质检与输出',
];

export const STEP_IDS = ['audit', 'analyze', 'decompose', 'prompt_gen', 'quality_check'] as const;

interface StepLayoutProps {
  stepNumber: number;
  stepTitle: string;
  projectId: string;
  children: React.ReactNode;
}

export default function StepLayout({ stepNumber, stepTitle, projectId, children }: StepLayoutProps) {
  const { getProject } = useProjects();
  const project = getProject(projectId);
  const moduleDef = project ? getModule(project.moduleId) : undefined;
  const navigate = useNavigate();

  return (
    <div className="h-full flex flex-col bg-gray-900">
      {/* Top Progress Bar */}
      <div className="px-4 py-3 border-b border-gray-700/50 bg-gray-900 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
              ← 首页
            </Link>
            <span className="text-sm font-semibold text-gray-200">{project?.name || '未命名项目'}</span>
            <span className="text-xs text-gray-500 ml-2">{stepTitle}</span>
            {moduleDef && (
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span className="text-base">{moduleDef.icon}</span>
                <span>{moduleDef.name}</span>
                <span className="text-gray-600">·</span>
                <span>{moduleDef.aspectRatio}</span>
              </div>
            )}
          </div>
          <span className="text-xs text-gray-600">#{projectId.slice(0, 8)}</span>
        </div>
        {/* Step Progress */}
        <div className="flex items-center justify-center gap-2 overflow-x-auto pb-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <Link
              key={n}
              to={`/project/${projectId}/step${n}`}
              className={`px-4 py-2 rounded text-xs font-medium whitespace-nowrap transition-all ${
                n === stepNumber
                  ? 'bg-blue-600 text-white shadow-md'
                  : n < stepNumber
                    ? 'bg-green-700/80 text-white hover:bg-green-600 cursor-pointer'
                    : 'bg-gray-700/50 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {n}. {STEP_TITLES[n - 1]}
            </Link>
          ))}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>

      {/* Bottom Navigation */}
      <div className="flex items-center justify-between px-6 py-3 border-t border-gray-700/50 bg-gray-900 shrink-0">
        {stepNumber > 1 ? (
          <button
            onClick={() => navigate(`/project/${projectId}/step${stepNumber - 1}`)}
            className="px-4 py-2 text-sm text-gray-400 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
          >
            ← 上一步
          </button>
        ) : (
          <div />
        )}
        {stepNumber < 5 ? (
          <button
            onClick={() => navigate(`/project/${projectId}/step${stepNumber + 1}`)}
            className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-500 transition-colors"
          >
            下一步 →
          </button>
        ) : (
          <div />
        )}
      </div>
    </div>
  );
}

// ===== Shared Input Section Component =====

interface InputSectionProps {
  stepNumber: number;
  projectId: string;
  value: string;
  onChange: (value: string) => void;
}

export function InputSection({ stepNumber, projectId, value, onChange }: InputSectionProps) {
  const { getInheritedInput, setManualInput } = useStepData(projectId);
  const [source, setSource] = useState<'inherited' | 'uploaded'>(() => {
    if (stepNumber === 1) return 'uploaded';
    const inherited = getInheritedInput(stepNumber);
    return inherited ? 'inherited' : 'uploaded';
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const inheritedData = stepNumber > 1 ? getInheritedInput(stepNumber) : null;

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
    <div className="border-b border-gray-700/50">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800/50">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-300">输入区</span>
          {stepNumber > 1 && (
            <div className="flex gap-1 bg-gray-800 rounded p-0.5">
              <button
                onClick={() => setSource('inherited')}
                className={`px-2 py-0.5 text-xs rounded transition-colors ${
                  source === 'inherited'
                    ? 'bg-green-700/50 text-green-300'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                从上一步继承
              </button>
              <button
                onClick={() => setSource('uploaded')}
                className={`px-2 py-0.5 text-xs rounded transition-colors ${
                  source === 'uploaded'
                    ? 'bg-blue-700/50 text-blue-300'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                上传文件
              </button>
            </div>
          )}
          {source === 'uploaded' && (
            <>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-2 py-0.5 text-xs text-gray-400 bg-gray-700/50 rounded hover:bg-gray-700 transition-colors"
              >
                📂 上传
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md"
                onChange={handleFileInput}
                className="hidden"
              />
            </>
          )}
        </div>
        <span className="text-xs text-gray-500">{value.length} 字符</span>
      </div>
      <textarea
        value={value}
        onChange={(e) => handleTextChange(e.target.value)}
        readOnly={source === 'inherited'}
        placeholder={stepNumber === 1 ? '在此粘贴或上传您的剧本文本...' : '输入内容...'}
        className={`w-full h-32 resize-none px-4 py-3 text-sm font-mono bg-gray-950 text-gray-200 placeholder-gray-600 focus:outline-none ${
          source === 'inherited' ? 'opacity-80' : ''
        }`}
        style={{ textAlign: 'left' }}
      />
    </div>
  );
}
