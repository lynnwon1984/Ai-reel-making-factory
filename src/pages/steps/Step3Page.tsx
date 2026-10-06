import { useState, useCallback, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import StepLayout, { InputSection } from './StepLayout';
import PromptEditor from '../../components/PromptEditor';
import StoryboardTable from '../../components/StoryboardTable';
import StoryboardCard from '../../components/StoryboardCard';
import { usePipeline } from '../../hooks/usePipeline';
import { useStepData } from '../../hooks/useStepData';
import { loadSettings } from '../../components/SettingsPanel';
import type { PipelineSettings, Shot, ScriptAnalysis, PurifiedScript, Storyboard } from '../../lib/types';
import { STAGE_CONFIGS } from '../../lib/constants';
import { downloadFile } from '../../utils/exporter';

type ViewMode = 'table' | 'card';

interface CheckIssue { shotNumber: number; type: string; severity: string; description: string; suggestion: string; }
interface DecomposeCheckResult { totalShots: number; totalDuration: number; issues: CheckIssue[]; score: number; summary: string; }

export default function Step3Page() {
  const { id: projectId } = useParams<{ id: string }>();
  const pid = projectId || '';
  const [inputText, setInputText] = useState('');
  const [settings, setSettings] = useState<PipelineSettings>(loadSettings);
  const [showPrompt, setShowPrompt] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [isChecking, setIsChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<DecomposeCheckResult | null>(null);
  const { steps, isRunning, setScriptText, setPrevResults, executeStep, updateSettings } = usePipeline();
  const { getStepOutput, saveStepOutput } = useStepData(pid);

  const decomposeStep = steps.find((s) => s.id === 'decompose');
  const shots: Shot[] | null = decomposeStep?.status === 'done' && decomposeStep.result
    ? ((decomposeStep.result as { shots: Shot[] }).shots ?? null) : null;
  const stageConfig = STAGE_CONFIGS.find((s) => s.id === 'decompose');

  const handleRun = useCallback(() => {
    if (!inputText.trim()) return;
    const step1Output = getStepOutput(1);
    const step2Output = getStepOutput(2);
    const prev: Record<string, unknown> = {};
    if (step1Output) prev.purifiedScript = step1Output;
    if (step2Output) prev.analysis = step2Output;
    setPrevResults(prev as { purifiedScript?: PurifiedScript; analysis?: ScriptAnalysis });
    setScriptText(inputText);
    executeStep('decompose');
  }, [inputText, setScriptText, setPrevResults, executeStep, getStepOutput]);

  useEffect(() => { if (shots && decomposeStep?.status === 'done') saveStepOutput(3, decomposeStep.result); }, [shots, decomposeStep, saveStepOutput]);

  const handlePromptChange = (prompt: string) => {
    const next = { ...settings, customPrompts: { ...settings.customPrompts, decompose: prompt } };
    setSettings(next); updateSettings(next);
  };

  const handleQualityCheck = useCallback(async () => {
    if (!shots) return;
    setIsChecking(true); setCheckResult(null);
    try {
      const response = await fetch('/api/pipeline/step3-check', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ shots, settings }),
      });
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      if (!response.body) throw new Error('No response body');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = ''; let result: DecomposeCheckResult | null = null;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const doneIdx = buffer.indexOf('event: done');
        if (doneIdx !== -1) { const afterDone = buffer.slice(doneIdx); const dataMatch = afterDone.match(/data:\s*(.+)/); if (dataMatch) result = JSON.parse(dataMatch[1]); break; }
        const errorIdx = buffer.indexOf('event: error');
        if (errorIdx !== -1) { const afterError = buffer.slice(errorIdx); const dataMatch = afterError.match(/data:\s*(.+)/); if (dataMatch) { const errData = JSON.parse(dataMatch[1]); throw new Error(errData.error || 'Unknown error'); } }
      }
      if (result) setCheckResult(result);
    } catch (err) { alert(`质检失败: ${err instanceof Error ? err.message : 'Unknown error'}`); }
    finally { setIsChecking(false); }
  }, [shots, settings]);

  const miniStoryboard: Storyboard | null = shots ? {
    shots, purifiedScript: {} as never, analysis: {} as never, seedancePrompts: [],
    qualityReport: {} as never, metadata: { title: '', createdAt: '', seedanceVersion: '2.5', totalBatches: 0 },
  } : null;

  // ===== Left Panel =====
  const leftPanel = (
    <>
      <InputSection stepNumber={3} projectId={pid} value={inputText} onChange={setInputText} />
      <div className="px-4 py-3 flex-1 flex flex-col">
        <div className="flex flex-col gap-2">
          <button onClick={handleRun} disabled={isRunning || !inputText.trim()}
            className={`w-full px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${isRunning || !inputText.trim() ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:from-blue-500 hover:to-cyan-500 shadow-md active:scale-[0.98]'}`}>
            {isRunning ? '⏳ 分镜设计中...' : '▶ 分镜设计'}
          </button>
          <button onClick={handleQualityCheck} disabled={isChecking || !shots}
            className={`w-full px-4 py-2 rounded-lg text-sm font-bold transition-all ${isChecking || !shots ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-500 hover:to-emerald-500 shadow-md active:scale-[0.98]'}`}>
            {isChecking ? '⏳ 质检中...' : '🔍 质检'}
          </button>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <button onClick={() => setShowPrompt(!showPrompt)} className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${showPrompt ? 'bg-amber-600/20 text-amber-400' : 'text-gray-400 bg-gray-800 hover:bg-gray-700'}`}>P 提示词</button>
          {shots && (
            <div className="flex gap-1 bg-gray-800 rounded p-0.5 ml-auto">
              <button onClick={() => setViewMode('table')} className={`px-2 py-0.5 text-xs rounded transition-colors ${viewMode === 'table' ? 'bg-gray-700 text-gray-200' : 'text-gray-500'}`}>📋 表格</button>
              <button onClick={() => setViewMode('card')} className={`px-2 py-0.5 text-xs rounded transition-colors ${viewMode === 'card' ? 'bg-gray-700 text-gray-200' : 'text-gray-500'}`}>🃏 卡片</button>
            </div>
          )}
        </div>

        {decomposeStep?.status === 'running' && decomposeStep.streamText && (
          <div className="mt-3 p-3 bg-gray-950 rounded-lg max-h-24 overflow-auto">
            <pre className="text-xs text-green-400/80 font-mono whitespace-pre-wrap" style={{ textAlign: 'left' }}>{decomposeStep.streamText}</pre>
          </div>
        )}
        {decomposeStep?.status === 'error' && decomposeStep.error && (
          <div className="mt-3 p-3 bg-red-950/30 rounded-lg"><p className="text-xs text-red-400">{decomposeStep.error}</p></div>
        )}

        {showPrompt && stageConfig && (
          <div className="mt-3 p-3 bg-gray-800/50 rounded-lg border border-gray-700/30">
            <PromptEditor stageId="decompose" defaultPrompt={stageConfig.defaultSystemPrompt} customPrompt={settings.customPrompts?.decompose} onPromptChange={handlePromptChange} availableVariables={stageConfig.availableVariables}
              onReset={() => { const next = { ...settings, customPrompts: { ...settings.customPrompts } }; (next.customPrompts as Record<string, string | undefined>)['decompose'] = undefined; setSettings(next); updateSettings(next); }} />
          </div>
        )}
      </div>
    </>
  );

  // ===== Download Buttons =====
  const downloadButtons = (
    <div className="flex gap-3 flex-wrap">
      {shots && <button onClick={() => downloadFile(JSON.stringify({ shots }, null, 2), 'shots.json', 'application/json')} className="px-4 py-2 text-xs font-medium bg-blue-600 hover:bg-blue-700 rounded-lg text-white transition-colors">📥 分镜 JSON</button>}
      {checkResult && <button onClick={() => downloadFile(JSON.stringify(checkResult, null, 2), 'decompose-check-result.json', 'application/json')} className="px-4 py-2 text-xs font-medium bg-green-600 hover:bg-green-700 rounded-lg text-white transition-colors">📥 质检报告 JSON</button>}
    </div>
  );

  // ===== Right Panel Content =====
  const rightContent = (
    <div>
      {checkResult && (
        <div className="mb-6 p-5 bg-gray-800/40 rounded-xl border border-gray-700/30">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-200">📋 分镜质检报告</h3>
            <span className={`text-xl font-bold ${checkResult.score >= 80 ? 'text-green-400' : checkResult.score >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>{checkResult.score}分</span>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-3">
            <div className="text-xs text-gray-400"><span className="text-gray-500">总镜头数：</span><span className="text-gray-200">{checkResult.totalShots}</span></div>
            <div className="text-xs text-gray-400"><span className="text-gray-500">总时长：</span><span className="text-gray-200">{checkResult.totalDuration}s</span></div>
          </div>
          <p className="text-xs text-gray-300 mb-3">{checkResult.summary}</p>
          {checkResult.issues.length > 0 && (
            <div className="max-h-48 overflow-auto space-y-2">
              {checkResult.issues.slice(0, 10).map((issue, i) => (
                <div key={i} className="p-2 bg-gray-900/50 rounded-lg text-xs">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-1.5 py-0.5 rounded ${issue.severity === '严重' ? 'bg-red-900/50 text-red-400' : issue.severity === '中等' ? 'bg-yellow-900/50 text-yellow-400' : 'bg-gray-700 text-gray-400'}`}>{issue.severity}</span>
                    <span className="text-gray-500">镜头 #{issue.shotNumber}</span>
                    <span className="text-gray-400">{issue.type}</span>
                  </div>
                  <p className="text-gray-300">{issue.description}</p>
                  <p className="text-gray-500 mt-1">建议：{issue.suggestion}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {miniStoryboard ? (
        <div>
          {viewMode === 'table' ? <StoryboardTable storyboard={miniStoryboard} /> : <StoryboardCard storyboard={miniStoryboard} />}
        </div>
      ) : (
        <div className="flex items-center justify-center h-64">
          <div className="text-center text-gray-500 text-sm"><div className="text-5xl mb-4 opacity-20">🎬</div><p>执行分镜设计后，结果将在此显示</p></div>
        </div>
      )}
    </div>
  );

  return (
    <StepLayout stepNumber={3} stepTitle="分镜设计" projectId={pid} leftPanel={leftPanel} downloadButtons={downloadButtons}>
      {rightContent}
    </StepLayout>
  );
}
