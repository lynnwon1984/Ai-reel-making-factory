import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import ScriptEditor from '../components/ScriptEditor';
import PipelineProgress from '../components/PipelineProgress';
import StoryboardTable from '../components/StoryboardTable';
import StoryboardCard from '../components/StoryboardCard';
import SeedancePreview from '../components/SeedancePreview';
import { usePipeline } from '../hooks/usePipeline';
import { useProjects } from '../hooks/useProjects';
import { getModule } from '../modules/registry';
import { loadSettings } from '../components/SettingsPanel';
import { downloadJSON, downloadMarkdown, exportSeedancePrompts, exportPurifiedScript, exportAuditReport } from '../utils/exporter';
import type { Shot, PipelineSettings, PurifiedScript } from '../lib/types';

type ResultTab = 'table' | 'card' | 'seedance';

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
  const [resultTab, setResultTab] = useState<ResultTab>('table');
  const [projectName, setProjectName] = useState('未命名项目');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [settings, setSettings] = useState<PipelineSettings>(loadSettings);
  const [seedanceVersion, setSeedanceVersion] = useState<'2.0' | '2.5'>(settings.targetSeedanceVersion);

  const { steps, isRunning, storyboard, startPipeline, continueStep, continueAll, retryStep, updateSettings } = usePipeline();
  const { getProject } = useProjects();
  const project = getProject(projectId);
  const moduleDef = project ? getModule(project.moduleId) : undefined;

  // Derive purifiedScript from audit step
  const auditStep = steps.find((s) => s.id === 'audit');
  const purifiedScript: PurifiedScript | null =
    auditStep?.status === 'done' && auditStep.result
      ? (auditStep.result as PurifiedScript)
      : null;

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
    startPipeline(scriptText, settings);
  }, [startPipeline, scriptText, settings]);

  const handleRetryStep = useCallback(
    (stepIndex: number) => {
      retryStep(stepIndex, scriptText);
    },
    [retryStep, scriptText],
  );

  const handleContinueStep = useCallback(() => {
    continueStep();
  }, [continueStep]);

  const handleContinueAll = useCallback(() => {
    continueAll();
  }, [continueAll]);

  const handleShotUpdate = useCallback(
    (shotIdx: number, field: keyof Shot, value: string | number) => {
      if (!storyboard) return;
      const shot = storyboard.shots[shotIdx];
      if (shot) {
        (shot as unknown as Record<string, unknown>)[field] = value;
      }
    },
    [storyboard],
  );

  const handleSettingsChange = useCallback(
    (newSettings: PipelineSettings) => {
      setSettings(newSettings);
      updateSettings(newSettings);
    },
    [updateSettings],
  );

  const showExportButton = storyboard || purifiedScript;

  return (
    <div className="h-full flex flex-col bg-gray-900">
      {/* Top Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700/50 bg-gray-900 shrink-0">
        <div className="flex items-center gap-3">
          <input
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            className="text-sm font-semibold text-gray-200 bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-blue-500 rounded px-2 py-1"
            placeholder="项目名称"
          />
          {id && <span className="text-xs text-gray-600">#{id}</span>}
          {/* Module info */}
          {moduleDef && (
            <div className="flex items-center gap-2 text-sm text-gray-400 ml-2">
              <span className="text-lg">{moduleDef.icon}</span>
              <span>{moduleDef.name}</span>
              <span className="text-gray-600">·</span>
              <span>{moduleDef.subtitle}</span>
              <span className="text-gray-600">·</span>
              <span>{moduleDef.aspectRatio}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Result Tab Toggle */}
          <div className="flex items-center bg-gray-800 rounded-md p-0.5">
            <button
              onClick={() => setResultTab('table')}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                resultTab === 'table' ? 'bg-gray-700 text-gray-200 shadow-sm' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              📋 表格
            </button>
            <button
              onClick={() => setResultTab('card')}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                resultTab === 'card' ? 'bg-gray-700 text-gray-200 shadow-sm' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              🃏 卡片
            </button>
            <button
              onClick={() => setResultTab('seedance')}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                resultTab === 'seedance' ? 'bg-gray-700 text-cyan-400 shadow-sm' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              🎬 Seedance
            </button>
          </div>
          {/* Export */}
          {showExportButton && (
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="px-3 py-1.5 text-xs font-medium text-gray-400 bg-gray-800 rounded-md hover:bg-gray-700 transition-colors"
              >
                📥 导出
              </button>
              {showExportMenu && (
                <div className="absolute right-0 top-full mt-1 w-52 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-20 py-1">
                  {/* Step 1 exports: visible once audit step is done */}
                  {purifiedScript && (
                    <>
                      <button
                        onClick={() => {
                          exportPurifiedScript(purifiedScript.fullText, projectName);
                          setShowExportMenu(false);
                        }}
                        className="w-full px-3 py-2 text-left text-xs text-emerald-400 hover:bg-gray-700/50"
                      >
                        📥 净化剧本 (.txt)
                      </button>
                      <button
                        onClick={() => {
                          exportAuditReport(purifiedScript, projectName);
                          setShowExportMenu(false);
                        }}
                        className="w-full px-3 py-2 text-left text-xs text-teal-400 hover:bg-gray-700/50"
                      >
                        📥 审计报告 (.md)
                      </button>
                      {storyboard && <div className="border-t border-gray-700 my-1" />}
                    </>
                  )}
                  {/* Full pipeline exports */}
                  {storyboard && (
                    <>
                      <button
                        onClick={() => {
                          downloadJSON(storyboard);
                          setShowExportMenu(false);
                        }}
                        className="w-full px-3 py-2 text-left text-xs text-gray-300 hover:bg-gray-700/50"
                      >
                        导出 JSON
                      </button>
                      <button
                        onClick={() => {
                          downloadMarkdown(storyboard);
                          setShowExportMenu(false);
                        }}
                        className="w-full px-3 py-2 text-left text-xs text-gray-300 hover:bg-gray-700/50"
                      >
                        导出 Markdown
                      </button>
                      <button
                        onClick={() => {
                          exportSeedancePrompts(storyboard.seedancePrompts, seedanceVersion);
                          setShowExportMenu(false);
                        }}
                        className="w-full px-3 py-2 text-left text-xs text-cyan-400 hover:bg-gray-700/50"
                      >
                        导出 Seedance Prompt
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Vertical Top-Middle-Bottom Layout */}
      <div className="flex flex-col h-[calc(100vh-64px)]">
        {/* Top: Script Editor (~20vh) */}
        <div className="h-[20vh] min-h-[150px] border-b border-gray-700 overflow-y-auto">
          <ScriptEditor value={scriptText} onChange={setScriptText} />
        </div>

        {/* Middle: Pipeline Control (~40vh) */}
        <div className="h-[40vh] min-h-[280px] border-b border-gray-700 overflow-y-auto">
          <PipelineProgress
            steps={steps}
            isRunning={isRunning}
            settings={settings}
            projectName={projectName}
            onStart={handleStart}
            onRetryStep={handleRetryStep}
            onSettingsChange={handleSettingsChange}
            onContinueStep={handleContinueStep}
            onContinueAll={handleContinueAll}
          />
        </div>

        {/* Bottom: Results (flex-1) */}
        <div className="flex-1 overflow-y-auto">
          {resultTab === 'table' && (
            <StoryboardTable storyboard={storyboard} onShotUpdate={handleShotUpdate} />
          )}
          {resultTab === 'card' && (
            <StoryboardCard storyboard={storyboard} onShotUpdate={handleShotUpdate} />
          )}
          {resultTab === 'seedance' && (
            <SeedancePreview
              prompts={storyboard?.seedancePrompts ?? []}
              version={seedanceVersion}
              onVersionChange={setSeedanceVersion}
            />
          )}
        </div>
      </div>
    </div>
  );
}
