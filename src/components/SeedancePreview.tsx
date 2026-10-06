import { useState } from 'react';
import type { SeedancePrompt } from '../lib/types';

interface SeedancePreviewProps {
  prompts: SeedancePrompt[];
  version: '2.0' | '2.5';
  onVersionChange: (version: '2.0' | '2.5') => void;
}

export default function SeedancePreview({ prompts, version, onVersionChange }: SeedancePreviewProps) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const filteredPrompts = prompts.filter((p) => p.format === version);

  const handleCopy = async (idx: number, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const handleExportAll = () => {
    const content = filteredPrompts
      .map((p) => {
        const header = p.timestampRange ?? p.shotLabel ?? `镜头 ${p.shotNumber}`;
        return `--- ${header} (镜号: ${p.shotNumber}, 场景: ${p.sceneId}) ---\n\n${p.promptText}`;
      })
      .join('\n\n\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `seedance-prompts-${version}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (prompts.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 text-sm">
        <div className="text-center">
          <div className="text-4xl mb-3 opacity-30">🎬</div>
          <p>暂无 Seedance Prompt</p>
          <p className="text-xs mt-1">请先执行流水线生成 Prompt</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700/50 shrink-0">
        {/* Version Toggle */}
        <div className="flex items-center bg-gray-800 rounded-md p-0.5">
          <button
            onClick={() => onVersionChange('2.0')}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
              version === '2.0' ? 'bg-gray-700 text-cyan-400 shadow-sm' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            Seedance 2.0
          </button>
          <button
            onClick={() => onVersionChange('2.5')}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
              version === '2.5' ? 'bg-gray-700 text-cyan-400 shadow-sm' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            Seedance 2.5
          </button>
        </div>
        <span className="text-xs text-gray-500">{filteredPrompts.length} 条 Prompt</span>
      </div>

      {/* Prompt List */}
      <div className="flex-1 overflow-auto p-3 space-y-2">
        {filteredPrompts.map((prompt, idx) => {
          const isExpanded = expandedIdx === idx;
          const isCopied = copiedIdx === idx;
          const label = prompt.timestampRange ?? prompt.shotLabel ?? `镜头 ${prompt.shotNumber}`;

          return (
            <div
              key={`${prompt.shotNumber}-${idx}`}
              className={`rounded-lg border transition-all ${
                isExpanded ? 'border-cyan-500/30 bg-cyan-950/10' : 'border-gray-700/30 bg-gray-800/30'
              }`}
            >
              <div
                className="flex items-center justify-between p-2.5 cursor-pointer"
                onClick={() => setExpandedIdx(isExpanded ? null : idx)}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-300 bg-gray-700/50 px-1.5 py-0.5 rounded">
                    #{prompt.shotNumber}
                  </span>
                  <span className="text-xs text-gray-500">场景 {prompt.sceneId}</span>
                  <span className="text-xs text-cyan-400/70">{label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">{prompt.duration}s</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopy(idx, prompt.promptText);
                    }}
                    className="px-1.5 py-0.5 text-xs text-gray-400 hover:text-gray-200 bg-gray-700/50 rounded transition-colors"
                  >
                    {isCopied ? '✓ 已复制' : '复制'}
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="px-2.5 pb-2.5">
                  <pre
                    className="text-xs text-gray-300 font-mono bg-gray-900/50 rounded p-3 max-h-48 overflow-auto whitespace-pre-wrap"
                    style={{ textAlign: 'left' }}
                  >
                    {prompt.promptText}
                  </pre>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-700/50 shrink-0">
        <span className="text-xs text-gray-500">
          共 {filteredPrompts.length} 条 · 总时长 {filteredPrompts.reduce((s, p) => s + p.duration, 0)}s
        </span>
        <button
          onClick={handleExportAll}
          className="px-3 py-1.5 text-xs font-medium text-cyan-400 bg-cyan-900/20 rounded hover:bg-cyan-900/30 transition-colors"
        >
          导出全部
        </button>
      </div>
    </div>
  );
}
