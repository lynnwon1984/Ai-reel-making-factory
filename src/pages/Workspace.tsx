import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import ScriptEditor from '../components/ScriptEditor';
import PipelineProgress from '../components/PipelineProgress';
import StoryboardTable from '../components/StoryboardTable';
import StoryboardCard from '../components/StoryboardCard';
import { usePipeline } from '../hooks/usePipeline';
import { downloadJSON, downloadMarkdown } from '../utils/exporter';
import type { Shot } from '../lib/types';

type ViewMode = 'table' | 'card';

interface ProjectData {
  name: string;
  scriptText: string;
}

function loadProject(id: string | undefined): ProjectData {
  if (!id) return { name: '未命名项目', scriptText: '' };
  try {
    const raw = localStorage.getItem(`project-${id}`);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { name: '未命名项目', scriptText: '' };
}

function saveProject(id: string, data: ProjectData) {
  localStorage.setItem(`project-${id}`, JSON.stringify(data));
}

export default function Workspace() {
  const { id } = useParams();
  const projectId = id || `proj-${Date.now()}`;

  const [scriptText, setScriptText] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [projectName, setProjectName] = useState('未命名项目');
  const [showExportMenu, setShowExportMenu] = useState(false);

  const { steps, isRunning, storyboard, startPipeline, retryStep } = usePipeline();

  // Load project on mount
  useEffect(() => {
    const data = loadProject(id);
    setScriptText(data.scriptText);
    setProjectName(data.name);
  }, [id]);

  // Save project on script change
  useEffect(() => {
    saveProject(projectId, { name: projectName, scriptText });
  }, [projectId, projectName, scriptText]);

  const handleStart = useCallback(() => {
    startPipeline(scriptText);
  }, [startPipeline, scriptText]);

  const handleRetryStep = useCallback(
    (stepId: number) => {
      retryStep(stepId, scriptText);
    },
    [retryStep, scriptText]
  );

  const handleShotUpdate = useCallback(
    (sceneIdx: number, shotIdx: number, field: keyof Shot, value: string | number) => {
      if (!storyboard) return;
      // Update is local-only for now; in future, persist to backend
      const scene = storyboard.scenes[sceneIdx];
      if (scene?.shots[shotIdx]) {
        (scene.shots[shotIdx] as unknown as Record<string, unknown>)[field] = value;
      }
    },
    [storyboard]
  );

  return (
    <div className="h-full flex flex-col">
      {/* Top Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 bg-white shrink-0">
        <div className="flex items-center gap-3">
          <input
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            className="text-sm font-semibold text-gray-800 bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-2 py-1"
            placeholder="项目名称"
          />
          {id && <span className="text-xs text-gray-400">#{id}</span>}
        </div>
        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="flex items-center bg-gray-100 rounded-md p-0.5">
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                viewMode === 'table' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              📋 表格
            </button>
            <button
              onClick={() => setViewMode('card')}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                viewMode === 'card' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              🃏 卡片
            </button>
          </div>
          {/* Export */}
          {storyboard && (
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                📥 导出
              </button>
              {showExportMenu && (
                <div className="absolute right-0 top-full mt-1 w-36 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1">
                  <button
                    onClick={() => { downloadJSON(storyboard); setShowExportMenu(false); }}
                    className="w-full px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50"
                  >
                    导出 JSON
                  </button>
                  <button
                    onClick={() => { downloadMarkdown(storyboard); setShowExportMenu(false); }}
                    className="w-full px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50"
                  >
                    导出 Markdown
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Three-column Layout */}
      <div className="flex-1 flex min-h-0">
        {/* Left: Script Editor (30%) */}
        <div className="w-[30%] border-r border-gray-200 flex flex-col min-h-0">
          <ScriptEditor value={scriptText} onChange={setScriptText} />
        </div>

        {/* Center: Pipeline (25%) */}
        <div className="w-[25%] border-r border-gray-200 flex flex-col min-h-0">
          <PipelineProgress
            steps={steps}
            isRunning={isRunning}
            onStart={handleStart}
            onRetryStep={handleRetryStep}
          />
        </div>

        {/* Right: Storyboard Result (45%) */}
        <div className="w-[45%] flex flex-col min-h-0">
          {viewMode === 'table' ? (
            <StoryboardTable storyboard={storyboard} onShotUpdate={handleShotUpdate} />
          ) : (
            <StoryboardCard storyboard={storyboard} onShotUpdate={handleShotUpdate} />
          )}
        </div>
      </div>
    </div>
  );
}
