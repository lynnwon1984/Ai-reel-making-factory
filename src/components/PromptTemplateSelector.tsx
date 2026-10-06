import { useState, useEffect } from 'react';
import { useTemplateStore } from '../stores/useTemplateStore';

interface Props {
  moduleId: string;
  stageId: string;
  currentContent: string;
  onSelect: (content: string, templateId: string) => void;
  onSaveAsTemplate: (name: string, content: string) => void;
}

export default function PromptTemplateSelector({
  moduleId,
  stageId,
  currentContent,
  onSelect,
  onSaveAsTemplate,
}: Props) {
  const { templates, loading, error, loadTemplates, addTemplate, removeTemplate } =
    useTemplateStore();

  const [showSaveForm, setShowSaveForm] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadTemplates(moduleId, stageId);
  }, [moduleId, stageId, loadTemplates]);

  const handleSaveAs = async () => {
    const name = newTemplateName.trim();
    if (!name) return;
    try {
      await addTemplate({
        name,
        module_id: moduleId,
        stage_id: stageId,
        content: currentContent,
      });
      setNewTemplateName('');
      setShowSaveForm(false);
      onSaveAsTemplate(name, currentContent);
    } catch {
      // Error handled by store
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await removeTemplate(id);
    } catch {
      // Error handled by store
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-400">提示词模板</span>
        <button
          onClick={() => setShowSaveForm(!showSaveForm)}
          className="px-2 py-0.5 text-xs text-emerald-400 bg-emerald-900/20 border border-emerald-700/30 rounded hover:bg-emerald-900/40 transition-colors"
        >
          {showSaveForm ? '取消' : '+ 保存当前为模板'}
        </button>
      </div>

      {/* Save form */}
      {showSaveForm && (
        <div className="flex gap-2 items-center">
          <input
            type="text"
            value={newTemplateName}
            onChange={(e) => setNewTemplateName(e.target.value)}
            placeholder="输入模板名称..."
            className="flex-1 px-2 py-1 text-xs bg-gray-900 border border-gray-600 rounded text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            onKeyDown={(e) => e.key === 'Enter' && handleSaveAs()}
          />
          <button
            onClick={handleSaveAs}
            disabled={!newTemplateName.trim()}
            className="px-2.5 py-1 text-xs font-medium text-white bg-emerald-600 rounded hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            保存
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="text-xs text-red-400 bg-red-900/20 border border-red-700/30 rounded px-2 py-1">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-xs text-gray-500 text-center py-2">加载中...</div>
      )}

      {/* Empty state */}
      {!loading && !error && templates.length === 0 && (
        <div className="text-xs text-gray-500 text-center py-2 border border-dashed border-gray-700 rounded">
          暂无模板，可保存当前提示词为模板
        </div>
      )}

      {/* Template list */}
      <div className="space-y-1.5 max-h-48 overflow-y-auto">
        {templates.map((tpl) => (
          <div
            key={tpl.id}
            className="group flex items-start gap-2 px-2 py-1.5 rounded bg-gray-800/50 border border-gray-700/40 hover:border-gray-600/60 transition-colors"
          >
            <button
              onClick={() => onSelect(tpl.content, tpl.id)}
              className="flex-1 text-left min-w-0"
            >
              <div className="text-xs font-medium text-gray-200 truncate">
                {tpl.name}
                {tpl.is_default && (
                  <span className="ml-1.5 px-1 py-0 text-[10px] text-amber-400 bg-amber-900/30 rounded">
                    默认
                  </span>
                )}
              </div>
              {tpl.description && (
                <div className="text-[11px] text-gray-500 truncate mt-0.5">
                  {tpl.description}
                </div>
              )}
              <div className="text-[10px] text-gray-600 mt-0.5">
                {formatDate(tpl.created_at)}
              </div>
            </button>
            <button
              onClick={() => handleDelete(tpl.id)}
              disabled={deletingId === tpl.id}
              className="shrink-0 mt-0.5 px-1.5 py-0.5 text-[10px] text-red-400/60 hover:text-red-400 hover:bg-red-900/20 rounded opacity-0 group-hover:opacity-100 transition-all disabled:opacity-40"
              title="删除模板"
            >
              {deletingId === tpl.id ? '...' : '✕'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
