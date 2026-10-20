import { useState, useCallback, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import StepLayout, { InputSection } from './StepLayout';
import PromptEditor from '../../components/PromptEditor';
import { usePipeline } from '../../hooks/usePipeline';
import { useStepData } from '../../hooks/useStepData';
import { loadSettings } from '../../components/SettingsPanel';
import type { PipelineSettings, PurifiedScript, DiagnosisResult, RepairResult } from '../../lib/types';
import { STAGE_CONFIGS } from '../../lib/constants';
import { downloadFile, exportRepairedScript } from '../../utils/exporter';

export default function Step7Page() {
  const { id: projectId } = useParams<{ id: string }>();
  const pid = projectId || '';
  const [inputText, setInputText] = useState('');
  const [settings, setSettings] = useState<PipelineSettings>(loadSettings);
  const [showPrompt, setShowPrompt] = useState(false);
  const { steps, isRunning, setScriptText, setPrevResults, executeStep, updateSettings } = usePipeline();
  const { getStepOutput, saveStepOutput } = useStepData(pid);

  const repairStep = steps.find((s) => s.id === 'repair');
  const repair: RepairResult | null = repairStep?.status === 'done' && repairStep.result
    ? (repairStep.result as RepairResult) : null;
  const stageConfig = STAGE_CONFIGS.find((s) => s.id === 'repair');

  const handleRun = useCallback(() => {
    if (!inputText.trim()) return;
    const step1Output = getStepOutput(1);
    const step6Output = getStepOutput(6);
    const prev: Record<string, unknown> = {};
    if (step1Output) prev.purifiedScript = step1Output.data;
    if (step6Output) prev.diagnosis = step6Output.data;
    setPrevResults(prev as { purifiedScript?: PurifiedScript; diagnosis?: DiagnosisResult });
    setScriptText(inputText);
    executeStep('repair');
  }, [inputText, setScriptText, setPrevResults, executeStep, getStepOutput]);

  useEffect(() => {
    if (repair && repairStep?.status === 'done') saveStepOutput(7, repairStep.result);
  }, [repair, repairStep, saveStepOutput]);

  const handlePromptChange = (prompt: string) => {
    const next = { ...settings, customPrompts: { ...settings.customPrompts, repair: prompt } };
    setSettings(next); updateSettings(next);
  };

  const inputSection = <InputSection stepNumber={7} projectId={pid} value={inputText} onChange={setInputText} />;
  const operationSection = (
    <div className="px-6 py-3 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={handleRun} disabled={isRunning || !inputText.trim()}
          className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${isRunning || !inputText.trim() ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-500 hover:to-pink-500 shadow-md active:scale-[0.98]'}`}>
          {isRunning ? '⏳ 修复中...' : '▶ 剧本修复'}
        </button>
        <button onClick={() => setShowPrompt(!showPrompt)} className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${showPrompt ? 'bg-amber-600/20 text-amber-400' : 'text-gray-400 bg-gray-800 hover:bg-gray-700'}`}>P 提示词</button>
      </div>
      {repairStep?.status === 'running' && repairStep.streamText && (
        <div className="p-3 bg-gray-950 rounded-lg max-h-24 overflow-auto">
          <pre className="text-xs text-green-400/80 font-mono whitespace-pre-wrap" style={{ textAlign: 'left' }}>{repairStep.streamText}</pre>
        </div>
      )}
      {repairStep?.status === 'error' && repairStep.error && (
        <div className="p-2 bg-red-950/30 rounded-lg"><p className="text-xs text-red-400">{repairStep.error}</p></div>
      )}
      {showPrompt && stageConfig && (
        <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700/30">
          <PromptEditor stageId="repair" defaultPrompt={stageConfig.defaultSystemPrompt} customPrompt={settings.customPrompts?.repair} onPromptChange={handlePromptChange} availableVariables={stageConfig.availableVariables}
            onReset={() => { const next = { ...settings, customPrompts: { ...settings.customPrompts } }; (next.customPrompts as Record<string, string | undefined>)['repair'] = undefined; setSettings(next); updateSettings(next); }} />
        </div>
      )}
    </div>
  );

  const downloadButtons = repair ? (
    <div className="flex gap-3 flex-wrap">
      <button onClick={() => downloadFile(JSON.stringify(repair, null, 2), 'repair.json', 'application/json')} className="px-4 py-2 text-xs font-medium bg-purple-600 hover:bg-purple-700 rounded-lg text-white transition-colors">📥 修复 JSON</button>
      <button onClick={() => exportRepairedScript(repair.repairedText, `项目${pid}`)} className="px-4 py-2 text-xs font-medium bg-pink-600 hover:bg-pink-700 rounded-lg text-white transition-colors">📥 修复后剧本 TXT</button>
    </div>
  ) : null;

  const outputContent = repair ? (
    <div className="space-y-4">
      <div className="bg-gray-800/40 rounded-xl border border-purple-500/20 p-5">
        <h4 className="text-xs font-semibold text-purple-400 mb-3">修复摘要</h4>
        <div className="text-xs text-gray-400"><p>修复点数量：<span className="text-white font-medium">{repair.fixCount}</span></p></div>
      </div>
      <div className="bg-gray-900/50 rounded-xl border border-gray-700/30 p-5 max-h-[500px] overflow-auto">
        <h4 className="text-xs font-semibold text-gray-400 mb-3">修复后剧本预览</h4>
        <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap leading-relaxed" style={{ textAlign: 'left' }}>{repair.repairedText}</pre>
      </div>
    </div>
  ) : (
    <div className="flex items-center justify-center h-64">
      <div className="text-center text-gray-500 text-sm"><div className="text-5xl mb-4 opacity-20">🔧</div><p>执行修复后，结果将在此显示</p></div>
    </div>
  );

  return (
    <StepLayout stepNumber={7} stepTitle="剧本修复" stepDescription="根据诊断结果自动修复剧本中的问题" projectId={pid} inputSection={inputSection} operationSection={operationSection} downloadButtons={downloadButtons}>
      {outputContent}
    </StepLayout>
  );
}
