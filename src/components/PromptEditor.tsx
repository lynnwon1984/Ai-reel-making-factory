import { useState, useRef } from 'react';
import type { StageId } from '../lib/types';
import { STAGE_CONFIGS } from '../lib/constants';
import PromptTemplateSelector from './PromptTemplateSelector';

type EditorMode = 'default' | 'template' | 'custom';

interface PromptEditorProps {
  stageId: StageId;
  moduleId?: string;
  defaultPrompt: string;
  customPrompt?: string;
  onPromptChange: (prompt: string) => void;
  availableVariables: string[];
  onReset: () => void;
}

export default function PromptEditor({
  stageId,
  moduleId = 'default',
  defaultPrompt,
  customPrompt,
  onPromptChange,
  availableVariables,
  onReset,
}: PromptEditorProps) {
  const [mode, setMode] = useState<EditorMode>(
    customPrompt ? 'custom' : 'default'
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const stageConfig = STAGE_CONFIGS.find((s) => s.id === stageId);
  const isEditable = mode === 'custom' || mode === 'template';

  const displayPrompt =
    mode === 'default' ? defaultPrompt : (customPrompt ?? '');

  const handleInsertVariable = (varName: string) => {
    const varToken = `{{${varName}}}`;
    onPromptChange(displayPrompt + varToken);
  };

  const handleModeSwitch = (newMode: EditorMode) => {
    if (newMode === mode) return;

    if (newMode === 'default') {
      setMode('default');
      onReset();
    } else if (newMode === 'custom') {
      setMode('custom');
      onPromptChange(displayPrompt || defaultPrompt);
    } else {
      setMode('template');
    }
  };

  const handleTemplateSelect = (content: string, _templateId: string) => {
    setMode('custom');
    onPromptChange(content);
  };

  const handleSaveAsTemplate = (_name: string, _content: string) => {
    // Template saved via PromptTemplateSelector internally
  };

  const handleFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);

    if (file.size > 1024 * 1024) {
      setUploadError('文件大小超过 1MB 限制');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      onPromptChange(content);
      if (mode !== 'custom') setMode('custom');
    };
    reader.onerror = () => setUploadError('文件读取失败');
    reader.readAsText(file);
    e.target.value = '';
  };

  const modeButtons: { id: EditorMode; label: string }[] = [
    { id: 'default', label: '默认' },
    { id: 'template', label: '模板' },
    { id: 'custom', label: '自定义' },
  ];

  return (
    <div className="space-y-3">
      {/* Stage info + mode switcher */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold text-gray-300">
            {stageConfig?.name ?? stageId}
          </span>
          <p className="text-xs text-gray-500 mt-0.5">
            {stageConfig?.description}
          </p>
        </div>
        <div className="flex gap-0.5 bg-gray-800 rounded-md p-0.5">
          {modeButtons.map((btn) => (
            <button
              key={btn.id}
              onClick={() => handleModeSwitch(btn.id)}
              className={`px-2 py-0.5 text-xs font-medium rounded transition-colors ${
                mode === btn.id
                  ? btn.id === 'custom'
                    ? 'bg-amber-600/20 text-amber-400'
                    : btn.id === 'template'
                      ? 'bg-emerald-600/20 text-emerald-400'
                      : 'bg-blue-600/20 text-blue-400'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* Template selector */}
      {mode === 'template' && (
        <PromptTemplateSelector
          moduleId={moduleId}
          stageId={stageId}
          currentContent={displayPrompt}
          onSelect={handleTemplateSelect}
          onSaveAsTemplate={handleSaveAsTemplate}
        />
      )}

      {/* Textarea with upload button */}
      <div className="relative">
        {mode === 'custom' && (
          <div className="flex items-center gap-2 mb-1.5">
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              onClick={handleFileUpload}
              className="px-2 py-0.5 text-xs text-gray-400 bg-gray-800 border border-gray-700 rounded hover:bg-gray-700 hover:text-gray-300 transition-colors"
              title="导入 .txt 或 .md 文件"
            >
              📎 上传
            </button>
            {uploadError && (
              <span className="text-xs text-red-400">{uploadError}</span>
            )}
          </div>
        )}
        <textarea
          value={displayPrompt}
          onChange={(e) => {
            if (isEditable) onPromptChange(e.target.value);
          }}
          readOnly={!isEditable}
          rows={6}
          className={`w-full px-3 py-2 rounded-lg text-xs font-mono resize-none focus:outline-none focus:ring-1 ${
            isEditable
              ? 'bg-gray-900 text-gray-200 border border-gray-600 focus:ring-blue-500'
              : 'bg-gray-800/50 text-gray-500 border border-gray-700/50 cursor-default'
          }`}
          style={{ textAlign: 'left' }}
          placeholder={
            mode === 'template'
              ? '从上方模板列表选择，或保存当前内容为模板...'
              : '输入自定义 Prompt...'
          }
        />
      </div>

      {/* Available variables */}
      <div>
        <span className="text-xs text-gray-500 mb-1.5 block">
          可用变量（点击插入）：
        </span>
        <div className="flex flex-wrap gap-1.5">
          {availableVariables.map((v) => (
            <button
              key={v}
              onClick={() => isEditable && handleInsertVariable(v)}
              className={`px-2 py-0.5 text-xs rounded border transition-colors ${
                isEditable
                  ? 'border-blue-600/40 text-blue-400 bg-blue-900/20 hover:bg-blue-900/40 cursor-pointer'
                  : 'border-gray-700 text-gray-500 bg-gray-800/50 cursor-default'
              }`}
            >
              {`{{${v}}}`}
            </button>
          ))}
        </div>
      </div>

      {/* Reset button */}
      {mode === 'custom' && (
        <button
          onClick={() => {
            setMode('default');
            onReset();
          }}
          className="px-3 py-1.5 text-xs text-gray-400 bg-gray-800 rounded hover:bg-gray-700 transition-colors"
        >
          恢复默认
        </button>
      )}
    </div>
  );
}
