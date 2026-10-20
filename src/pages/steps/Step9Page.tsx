import { useState, useCallback, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import StepLayout, { InputSection } from './StepLayout';
import PromptEditor from '../../components/PromptEditor';
import { usePipeline } from '../../hooks/usePipeline';
import { useStepData } from '../../hooks/useStepData';
import { loadSettings } from '../../components/SettingsPanel';
import type { PipelineSettings, StoryboardScript } from '../../lib/types';
import { STAGE_CONFIGS } from '../../lib/constants';
import { downloadFile } from '../../utils/exporter';

interface ClipCheckIssue { type: string; severity: string; description: string; suggestion: string; }
interface ClipCheck { clipNumber: number; shotType: string; duration: number; charCount: number; cameraMovements: string[]; compliant: boolean; issues: ClipCheckIssue[]; }
interface StoryboardCheckResult { totalClips: number; totalDuration: number; formatCompliance: number; clipChecks: ClipCheck[]; continuityIssues: string[]; overallScore: number; summary: string; }

export default function Step9Page() {
  const { id: projectId } = useParams<{ id: string }>();
  const pid = projectId || '';
  const [inputText, setInputText] = useState('');
  const [settings, setSettings] = useState<PipelineSettings>(loadSettings);
  const [showPrompt, setShowPrompt] = useState(false);
  const { steps, isRunning, setScriptText, setPrevResults, executeStep, updateSettings } = usePipeline();
  const { getStepOutput, saveStepOutput } = useStepData(pid);

  const promptgenCheckStep = steps.find((s) => s.id === 'promptgen_check');
  const checkResult: StoryboardCheckResult | null = promptgenCheckStep?.status === 'done' && promptgenCheckStep.result
    ? (promptgenCheckStep.result as StoryboardCheckResult) : null;
  const stageConfig = STAGE_CONFIGS.find((s) => s.id === 'promptgen_check');

  const handleRun = useCallback(() => {
    if (!inputText.trim()) return;
    const step4Output = getStepOutput(4);
    const prev: Record<string, unknown> = {};
    if (step4Output) prev.storyboardScript = step4Output.data;
    setPrevResults(prev as { storyboardScript?: StoryboardScript });
    setScriptText(inputText);
    executeStep('promptgen_check');
  }, [inputText, setScriptText, setPrevResults, executeStep, getStepOutput]);

  useEffect(() => {
    if (checkResult && promptgenCheckStep?.status === 'done') saveStepOutput(9, promptgenCheckStep.result);
  }, [checkResult, promptgenCheckStep, saveStepOutput]);

  const handlePromptChange = (prompt: string) => {
    const next = { ...settings, customPrompts: { ...settings.customPrompts, promptgen_check: prompt } };
    setSettings(next); updateSettings(next);
  };

  const inputSection = <InputSection stepNumber={9} projectId={pid} value={inputText} onChange={setInputText} />;
  const operationSection = (
    <div className="px-6 py-3 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={handleRun} disabled={isRunning || !inputText.trim()}
          className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${isRunning || !inputText.trim() ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white hover:from-cyan-500 hover:to-blue-500 shadow-md active:scale-[0.98]'}`}>
          {isRunning ? '⏳ 检查中...' : '▶ 合规检查'}
        </button>
        <button onClick={() => setShowPrompt(!showPrompt)} className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${showPrompt ? 'bg-amber-600/20 text-amber-400' : 'text-gray-400 bg-gray-800 hover:bg-gray-700'}`}>P 提示词</button>
      </div>
      {promptgenCheckStep?.status === 'running' && promptgenCheckStep.streamText && (
        <div className="p-3 bg-gray-950 rounded-lg max-h-24 overflow-auto">
          <pre className="text-xs text-green-400/80 font-mono whitespace-pre-wrap" style={{ textAlign: 'left' }}>{promptgenCheckStep.streamText}</pre>
        </div>
      )}
      {promptgenCheckStep?.status === 'error' && promptgenCheckStep.error && (
        <div className="p-2 bg-red-950/30 rounded-lg"><p className="text-xs text-red-400">{promptgenCheckStep.error}</p></div>
      )}
      {showPrompt && stageConfig && (
        <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700/30">
          <PromptEditor stageId="promptgen_check" defaultPrompt={stageConfig.defaultSystemPrompt} customPrompt={settings.customPrompts?.promptgen_check} onPromptChange={handlePromptChange} availableVariables={stageConfig.availableVariables}
            onReset={() => { const next = { ...settings, customPrompts: { ...settings.customPrompts } }; (next.customPrompts as Record<string, string | undefined>)['promptgen_check'] = undefined; setSettings(next); updateSettings(next); }} />
        </div>
      )}
    </div>
  );

  const downloadButtons = checkResult ? (
    <button onClick={() => downloadFile(JSON.stringify(checkResult, null, 2), 'promptgen-check.json', 'application/json')} className="px-4 py-2 text-xs font-medium bg-cyan-600 hover:bg-cyan-700 rounded-lg text-white transition-colors">📥 合规报告 JSON</button>
  ) : null;

  const outputContent = checkResult ? (
    <div className="space-y-4">
      <div className="bg-gray-800/40 rounded-xl border border-cyan-500/20 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-200">📋 分镜头剧本合规检查报告</h3>
          <span className={`text-xl font-bold ${checkResult.overallScore >= 80 ? 'text-green-400' : checkResult.overallScore >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>{checkResult.overallScore}分</span>
        </div>
        <div className="grid grid-cols-3 gap-4 mb-3">
          <div className="text-xs text-gray-400"><span className="text-gray-500">总 Clip 数：</span><span className="text-gray-200">{checkResult.totalClips}</span></div>
          <div className="text-xs text-gray-400"><span className="text-gray-500">总时长：</span><span className="text-gray-200">{checkResult.totalDuration}s</span></div>
          <div className="text-xs text-gray-400"><span className="text-gray-500">格式合规率：</span><span className="text-gray-200">{checkResult.formatCompliance}%</span></div>
        </div>
        <p className="text-xs text-gray-300">{checkResult.summary}</p>
      </div>
    </div>
  ) : (
    <div className="flex items-center justify-center h-64">
      <div className="text-center text-gray-500 text-sm"><div className="text-5xl mb-4 opacity-20">✅</div><p>执行合规检查后，结果将在此显示</p></div>
    </div>
  );

  return (
    <StepLayout stepNumber={9} stepTitle="提示词检查" stepDescription="检查提示词质量，确保格式正确、描述完整" projectId={pid} inputSection={inputSection} operationSection={operationSection} downloadButtons={downloadButtons}>
      {outputContent}
    </StepLayout>
  );
}
