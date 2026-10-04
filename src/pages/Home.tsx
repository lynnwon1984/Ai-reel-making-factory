import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjects } from '../hooks/useProjects';
import type { ProjectMeta } from '../hooks/useProjects';

const STATUS_LABELS: Record<string, { text: string; color: string }> = {
  draft: { text: '草稿', color: 'bg-gray-100 text-gray-600' },
  analyzing: { text: '分析中', color: 'bg-blue-100 text-blue-600' },
  done: { text: '已完成', color: 'bg-green-100 text-green-700' },
  error: { text: '出错', color: 'bg-red-100 text-red-700' },
};

export default function Home() {
  const navigate = useNavigate();
  const { projects, createProject, deleteProject } = useProjects();
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Refresh projects on mount (in case localStorage changed)
  useEffect(() => {
    // Force re-render from localStorage
  }, []);

  const handleCreate = () => {
    const project = createProject();
    navigate(`/workspace/${project.id}`);
  };

  const handleDelete = (id: string) => {
    deleteProject(id);
    setDeleteConfirm(null);
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const projectCards: ProjectMeta[] = projects;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Hero */}
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-gray-900 mb-3 tracking-tight">
          AI 分镜锻造工厂
        </h1>
        <p className="text-gray-500 text-base leading-relaxed max-w-xl" style={{ textAlign: 'left' }}>
          将您的剧本文本自动拆解为专业分镜脚本。支持剧本分析、场景拆分、镜头分解和格式化输出，
          一站式完成从文字到分镜的 AI 转译。
        </p>
        <button
          onClick={handleCreate}
          className="mt-6 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all text-sm font-bold shadow-md hover:shadow-lg active:scale-[0.98]"
        >
          + 新建项目
        </button>
      </div>

      {/* Recent Projects */}
      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">最近项目</h2>
        {projectCards.length === 0 ? (
          <div className="py-16 text-center">
            <div className="text-5xl mb-4 opacity-20">🎬</div>
            <p className="text-gray-400 text-sm">还没有项目</p>
            <p className="text-gray-300 text-xs mt-1">点击上方按钮创建第一个分镜项目</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projectCards.map((project) => {
              const statusInfo = STATUS_LABELS[project.status] || STATUS_LABELS.draft;
              return (
                <div
                  key={project.id}
                  className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md hover:border-gray-300 transition-all cursor-pointer group"
                  onClick={() => navigate(`/workspace/${project.id}`)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-800 group-hover:text-blue-600 transition-colors truncate">
                      {project.name}
                    </h3>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteConfirm(project.id); }}
                      className="text-gray-300 hover:text-red-500 transition-colors text-xs ml-2 shrink-0"
                      title="删除项目"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusInfo.color}`}>
                      {statusInfo.text}
                    </span>
                    <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded">
                      {project.scriptType}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">{formatDate(project.createdAt)}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">确认删除</h3>
            <p className="text-sm text-gray-500 mb-6" style={{ textAlign: 'left' }}>
              此操作将永久删除该项目及其所有数据，无法恢复。确定要继续吗？
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
