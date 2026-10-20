import { useState, useCallback, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import StepLayout, { InputSection } from './StepLayout';
import PromptEditor from '../../components/PromptEditor';
import { usePipeline } from '../../hooks/usePipeline';
import { useStepData } from '../../hooks/useStepData';
import { loadSettings } from '../../components/SettingsPanel';
import type { PipelineSettings, Shot, ScriptAnalysis, StoryboardScript, QualityReport, RepairFinalResult } from '../../lib/types';
import { STAGE_CONFIGS } from '../../lib/constants';
import { exportFinalStoryboard, exportFinalQualityReport } from '../../utils/exporter';

export default function Step10Page() {
  const { id: projectId } = useParams<{ id: string }>();
  const pid = projectId || '';
  const [inputText, setInputText] = useState('');
  const [settings, setSettings] = useState<PipelineSettings>(loadSettings);
  const [showPrompt, setShowPrompt] = useState(false);
  const { steps, isRunning, setScriptText, setPrevResults, executeStep, updateSettings } = usePipeline();
  const { getStepOutput, saveStepOutput } = useStepData(pid);

  const repairFinalStep = steps.find((s) => s.id === 'repair_final');
  const repairResult: RepairFinalResult | null = repairFinalStep?.status === 'done' && repairFinalStep.result
    ? (repairFinalStep.result as RepairFinalResult) : null;
  const stageConfig = STAGE_CONFIGS.find((s) => s.id === 'repair_final');

  const handleRun = useCallback(() => {
    if (!inputText.trim()) return;
    const step2Output = getStepOutput(2);
    const step3Output = getStepOutput(3);
    const step4Output = getStepOutput(4);
    const step9Output = getStepOutput(9);
    const prev: Record<string, unknown> = {};
    if (step2Output) prev.analysis = step2Output.data;
    if (step3Output) { const d = step3Output.data as { shots?: Shot[] }; if (d.shots) prev.shots = d.shots; }
    if (step4Output) prev.storyboardScript = step4Output.data;
    if (step9Output) prev.qualityReport = step9Output.data;
    setPrevResults(prev as { shots?: Shot[]; analysis?: ScriptAnalysis; storyboardScript?: StoryboardScript; qualityReport?: QualityReport });
    setScriptText(inputText);
    executeStep('repair_final');
  }, [inputText, setScriptText, setPrevResults, executeStep, getStepOutput]);

  useEffect(() => {
    if (repairResult && repairFinalStep?.status === 'done') saveStepOutput(10, repairFinalStep.result);
  }, [repairResult, repairFinalStep, saveStepOutput]);

  const handlePromptChange = (prompt: string) => {
    const next = { ...settings, customPrompts: { ...settings.customPrompts, repair_final: prompt } };
    setSettings(next); updateSettings(next);
  };

  const inputSection = <InputSection stepNumber={10} projectId={pid} value={inputText} onChange={setInputText} />;
  const operationSection = (
    <div className="px-6 py-3 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={handleRun} disabled={isRunning || !inputText.trim()}
          className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${isRunning || !inputText.trim() ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-gradient-to-r from-orange-600 to-red-600 text-white hover:from-orange-500 hover:to-red-500 shadow-md active:scale-[0.98]'}`}>
          {isRunning ? '⏳ 修复导出中...' : '▶ 修复与导出'}
        </button>
        <button onClick={() => setShowPrompt(!showPrompt)} className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${showPrompt ? 'bg-amber-600/20 text-amber-400' : 'text-gray-400 bg-gray-800 hover:bg-gray-700'}`}>P 提示词</button>
      </div>
      {repairFinalStep?.status === 'running' && repairFinalStep.streamText && (
        <div className="p-3 bg-gray-950 rounded-lg max-h-24 overflow-auto">
          <pre className="text-xs text-orange-400/80 font-mono whitespace-pre-wrap" style={{ textAlign: 'left' }}>{repairFinalStep.streamText}</pre>
        </div>
      )}
      {repairFinalStep?.status === 'error' && repairFinalStep.error && (
        <div className="p-2 bg-red-950/30 rounded-lg"><p className="text-xs text-red-400">{repairFinalStep.error}</p></div>
      )}
      {showPrompt && stageConfig && (
        <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700/30">
          <PromptEditor stageId="repair_final" defaultPrompt={stageConfig.defaultSystemPrompt} customPrompt={settings.customPrompts?.repair_final} onPromptChange={handlePromptChange} availableVariables={stageConfig.availableVariables}
            onReset={() => { const next = { ...settings, customPrompts: { ...settings.customPrompts } }; (next.customPrompts as Record<string, string | undefined>)['repair_final'] = undefined; setSettings(next); updateSettings(next); }} />
        </div>
      )}
    </div>
  );

  const downloadButtons = repairResult ? (
    <div className="flex gap-3 flex-wrap">
      <button onClick={() => exportFinalStoryboard(repairResult.finalStoryboardText, '分镜项目')} className="px-4 py-2 text-xs font-medium bg-orange-600 hover:bg-orange-700 rounded-lg text-white transition-colors">📥 最终分镜头剧本 .md</button>
      <button onClick={() => exportFinalQualityReport({ fixedIssues: repairResult.fixedIssues, manualReviewItems: repairResult.manualReviewItems, formatCompliance: repairResult.formatCompliance }, '分镜项目')} className="px-4 py-2 text-xs font-medium bg-green-600 hover:bg-green-700 rounded-lg text-white transition-colors">📥 质检报告</button>
    </div>
  ) : null;

  const outputContent = repairResult ? (
    <div className="space-y-4">
      <div className="bg-gray-800/40 rounded-xl border border-orange-500/20 p-5">
        <h4 className="text-xs font-semibold text-orange-400 mb-3">修复报告</h4>
        <div className="text-xs text-gray-400 space-y-1.5">
          <p>已修复问题: <span className="text-green-400 font-bold">{repairResult.fixedIssues}</span></p>
          <p>格式合规度: <span className={`font-bold ${repairResult.formatCompliance >= 80 ? 'text-green-400' : repairResult.formatCompliance >= 60 ? 'text-amber-400' : 'text-red-400'}`}>{repairResult.formatCompliance}/100</span></p>
          <p>需人工确认: <span className={repairResult.manualReviewItems.length > 0 ? 'text-amber-400 font-bold' : 'text-gray-500'}>{repairResult.manualReviewItems.length} 项</span></p>
        </div>
      </div>
      <div className="bg-gray-800/40 rounded-xl border border-gray-600/20 p-5">
        <h4 className="text-xs font-semibold text-gray-400 mb-3">最终分镜头剧本</h4>
        <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap max-h-[500px] overflow-auto leading-relaxed" style={{ textAlign: 'left' }}>{repairResult.finalStoryboardText}</pre>
      </div>
    </div>
  ) : (
    <div className="flex items-center justify-center h-64">
      <div className="text-center text-gray-500 text-sm"><div className="text-5xl mb-4 opacity-20">🔧</div><p>执行修复与导出后，最终分镜头剧本将在此显示</p></div>
    </div>
  );

  return (
    <StepLayout stepNumber={10} stepTitle="最终修复" stepDescription="根据质量评审结果修复不达标的提示词，输出最终可交付的分镜头剧本" projectId={pid} inputSection={inputSection} operationSection={operationSection} downloadButtons={downloadButtons}>
      {outputContent}
    </StepLayout>
  );
}
