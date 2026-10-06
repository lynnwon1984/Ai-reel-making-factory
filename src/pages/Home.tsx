import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjects } from '../hooks/useProjects';
import type { ProjectMeta } from '../hooks/useProjects';
import { getAllModules, getModule } from '../modules/registry';
import type { ProjectModuleDefinition } from '../modules/types';

const STATUS_LABELS: Record<string, { text: string; color: string }> = {
  draft: { text: '草稿', color: 'bg-gray-700 text-gray-300' },
  analyzing: { text: '分析中', color: 'bg-blue-900/30 text-blue-400' },
  done: { text: '已完成', color: 'bg-green-900/30 text-green-400' },
  error: { text: '出错', color: 'bg-red-900/30 text-red-400' },
};

function ModuleCard({ module, onClick }: { module: ProjectModuleDefinition; onClick: (id: string) => void }) {
  return (
    <button
      onClick={() => onClick(module.id)}
      className={`group relative overflow-hidden rounded-xl border border-gray-700/50 p-5 text-left transition-all hover:border-gray-500/50 hover:shadow-lg hover:-translate-y-0.5 bg-gradient-to-br ${module.color} bg-opacity-10`}
      style={{ background: `linear-gradient(135deg, rgba(0,0,0,0.85), rgba(0,0,0,0.7)), linear-gradient(135deg, var(--tw-gradient-stops))` }}
    >
      {/* Gradient overlay */}
      <div className={`absolute inset-0 bg-gradient-to-br ${module.color} opacity-10 group-hover:opacity-20 transition-opacity`} />

      <div className="relative z-10">
        {/* Icon */}
        <div className="text-3xl mb-3">{module.icon}</div>

        {/* Name + subtitle */}
        <h3 className="text-sm font-semibold text-gray-200 group-hover:text-white transition-colors">
          {module.name}
        </h3>
        <p className="text-xs text-gray-400 mt-0.5">{module.subtitle}</p>

        {/* Description */}
        <p className="text-xs text-gray-500 mt-2 leading-relaxed line-clamp-2">
          {module.description}
        </p>

        {/* Aspect ratio badge */}
        <div className="mt-3 flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full bg-gradient-to-r ${module.color} text-white font-medium`}>
            {module.aspectRatio}
          </span>
        </div>
      </div>
    </button>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const { projects, createProject, deleteProject } = useProjects();
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const modules = getAllModules();

  useEffect(() => {
    // Force re-render from localStorage
  }, []);

  const handleModuleClick = (moduleId: string) => {
    const project = createProject(undefined, moduleId);
    navigate(`/project/${project.id}/step1`);
  };

  const handleDelete = (id: string) => {
    deleteProject(id);
    setDeleteConfirm(null);
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const getModuleName = (moduleId: string) => {
    const mod = getModule(moduleId);
    return mod ? `${mod.icon} ${mod.name}` : moduleId;
  };

  const projectCards: ProjectMeta[] = projects;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Hero */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-100 mb-3 tracking-tight">
          AI 分镜锻造工厂
        </h1>
        <p className="text-gray-400 text-base leading-relaxed max-w-xl">
          将剧本转化为专业分镜脚本
        </p>
      </div>

      {/* 项目类型选择 */}
      <div className="mb-10">
        <h2 className="text-lg font-semibold text-gray-200 mb-4">选择项目类型</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {modules.map(module => (
            <ModuleCard key={module.id} module={module} onClick={handleModuleClick} />
          ))}
        </div>
      </div>

      {/* 最近项目 */}
      <div>
        <h2 className="text-lg font-semibold text-gray-200 mb-4">最近项目</h2>
        {projectCards.length === 0 ? (
          <div className="py-16 text-center">
            <div className="text-5xl mb-4 opacity-20">🎬</div>
            <p className="text-gray-500 text-sm">还没有项目</p>
            <p className="text-gray-600 text-xs mt-1">选择上方项目类型开始创建</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projectCards.map((project) => {
              const statusInfo = STATUS_LABELS[project.status] || STATUS_LABELS.draft;
              return (
                <div
                  key={project.id}
                  className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-5 hover:border-gray-600/50 hover:shadow-md transition-all cursor-pointer group"
                  onClick={() => navigate(`/project/${project.id}/step1`)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-300 group-hover:text-blue-400 transition-colors truncate">
                      {project.name}
                    </h3>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteConfirm(project.id); }}
                      className="text-gray-600 hover:text-red-400 transition-colors text-xs ml-2 shrink-0"
                      title="删除项目"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusInfo.color}`}>
                      {statusInfo.text}
                    </span>
                    <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded">
                      {project.scriptType}
                    </span>
                    {project.moduleId && (
                      <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded">
                        {getModuleName(project.moduleId)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-600">{formatDate(project.createdAt)}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-200 mb-2">确认删除</h3>
            <p className="text-sm text-gray-400 mb-6">
              此操作将永久删除该项目及其所有数据，无法恢复。确定要继续吗？
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-sm text-gray-400 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-500 transition-colors"
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
