import { useState, useCallback, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import StepLayout, { InputSection } from './StepLayout';
import PromptEditor from '../../components/PromptEditor';
import { usePipeline } from '../../hooks/usePipeline';
import { useStepData } from '../../hooks/useStepData';
import { loadSettings } from '../../components/SettingsPanel';
import type { PipelineSettings, PurifiedScript, ScriptAnalysis, DiagnosisResult } from '../../lib/types';
import { STAGE_CONFIGS } from '../../lib/constants';
import { downloadFile, exportDiagnosisReport } from '../../utils/exporter';

export default function Step6Page() {
  const { id: projectId } = useParams<{ id: string }>();
  const pid = projectId || '';
  const [inputText, setInputText] = useState('');
  const [settings, setSettings] = useState<PipelineSettings>(loadSettings);
  const [showPrompt, setShowPrompt] = useState(false);
  const { steps, isRunning, setScriptText, setPrevResults, executeStep, updateSettings } = usePipeline();
  const { getStepOutput, saveStepOutput } = useStepData(pid);

  const diagnoseStep = steps.find((s) => s.id === 'diagnose');
  const diagnosis: DiagnosisResult | null = diagnoseStep?.status === 'done' && diagnoseStep.result
    ? (diagnoseStep.result as DiagnosisResult) : null;
  const stageConfig = STAGE_CONFIGS.find((s) => s.id === 'diagnose');

  const handleRun = useCallback(() => {
    if (!inputText.trim()) return;
    const step1Output = getStepOutput(1);
    const step2Output = getStepOutput(2);
    const prev: Record<string, unknown> = {};
    if (step1Output) prev.purifiedScript = step1Output.data;
    if (step2Output) prev.analysis = step2Output.data;
    setPrevResults(prev as { purifiedScript?: PurifiedScript; analysis?: ScriptAnalysis });
    setScriptText(inputText);
    executeStep('diagnose');
  }, [inputText, setScriptText, setPrevResults, executeStep, getStepOutput]);

  useEffect(() => {
    if (diagnosis && diagnoseStep?.status === 'done') saveStepOutput(6, diagnoseStep.result);
  }, [diagnosis, diagnoseStep, saveStepOutput]);

  const handlePromptChange = (prompt: string) => {
    const next = { ...settings, customPrompts: { ...settings.customPrompts, diagnose: prompt } };
    setSettings(next); updateSettings(next);
  };

  const inputSection = (
    <InputSection stepNumber={6} projectId={pid} value={inputText} onChange={setInputText} />
  );

  const operationSection = (
    <div className="px-6 py-3 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={handleRun} disabled={isRunning || !inputText.trim()}
          className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${isRunning || !inputText.trim() ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-gradient-to-r from-amber-600 to-orange-600 text-white hover:from-amber-500 hover:to-orange-500 shadow-md active:scale-[0.98]'}`}>
          {isRunning ? '⏳ 诊断中...' : '▶ 剧本诊断'}
        </button>
        <button onClick={() => setShowPrompt(!showPrompt)} className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${showPrompt ? 'bg-amber-600/20 text-amber-400' : 'text-gray-400 bg-gray-800 hover:bg-gray-700'}`}>P 提示词</button>
      </div>
      {diagnoseStep?.status === 'running' && diagnoseStep.streamText && (
        <div className="p-3 bg-gray-950 rounded-lg max-h-24 overflow-auto">
          <pre className="text-xs text-green-400/80 font-mono whitespace-pre-wrap" style={{ textAlign: 'left' }}>{diagnoseStep.streamText}</pre>
        </div>
      )}
      {diagnoseStep?.status === 'error' && diagnoseStep.error && (
        <div className="p-2 bg-red-950/30 rounded-lg"><p className="text-xs text-red-400">{diagnoseStep.error}</p></div>
      )}
      {showPrompt && stageConfig && (
        <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700/30">
          <PromptEditor stageId="diagnose" defaultPrompt={stageConfig.defaultSystemPrompt} customPrompt={settings.customPrompts?.diagnose} onPromptChange={handlePromptChange} availableVariables={stageConfig.availableVariables}
            onReset={() => { const next = { ...settings, customPrompts: { ...settings.customPrompts } }; (next.customPrompts as Record<string, string | undefined>)['diagnose'] = undefined; setSettings(next); updateSettings(next); }} />
        </div>
      )}
    </div>
  );

  const downloadButtons = diagnosis ? (
    <div className="flex gap-3 flex-wrap">
      <button onClick={() => downloadFile(JSON.stringify(diagnosis, null, 2), 'diagnosis.json', 'application/json')} className="px-4 py-2 text-xs font-medium bg-amber-600 hover:bg-amber-700 rounded-lg text-white transition-colors">📥 诊断 JSON</button>
      <button onClick={() => exportDiagnosisReport(diagnosis, `项目${pid}`)} className="px-4 py-2 text-xs font-medium bg-orange-600 hover:bg-orange-700 rounded-lg text-white transition-colors">📥 诊断报告 MD</button>
    </div>
  ) : null;

  const outputContent = diagnosis ? (
    <div className="space-y-4">
      <div className="bg-gray-800/40 rounded-xl border border-amber-500/20 p-5">
        <h4 className="text-xs font-semibold text-amber-400 mb-3">诊断摘要</h4>
        <div className="grid grid-cols-4 gap-3">
          <div className="text-center"><div className="text-2xl font-bold text-white">{diagnosis.summary.totalIssues}</div><div className="text-xs text-gray-500">问题总数</div></div>
          <div className="text-center"><div className="text-2xl font-bold text-red-400">{diagnosis.summary.criticalCount}</div><div className="text-xs text-gray-500">严重</div></div>
          <div className="text-center"><div className="text-2xl font-bold text-yellow-400">{diagnosis.summary.moderateCount}</div><div className="text-xs text-gray-500">中等</div></div>
          <div className="text-center"><div className="text-2xl font-bold text-blue-400">{diagnosis.summary.minorCount}</div><div className="text-xs text-gray-500">轻微</div></div>
        </div>
      </div>
      {diagnosis.issues.length > 0 && (
        <div className="space-y-2">
          {diagnosis.issues.map((issue, i) => (
            <div key={i} className="p-3 bg-gray-900/50 rounded-lg text-xs">
              <div className="flex items-center gap-2 mb-1">
                <span className={`px-1.5 py-0.5 rounded ${issue.severity === '严重' ? 'bg-red-900/50 text-red-400' : issue.severity === '中等' ? 'bg-yellow-900/50 text-yellow-400' : 'bg-gray-700 text-gray-400'}`}>{issue.severity}</span>
                <span className="text-gray-300 font-medium">{issue.type}</span>
              </div>
              <p className="text-gray-400">{issue.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  ) : (
    <div className="flex items-center justify-center h-64">
      <div className="text-center text-gray-500 text-sm"><div className="text-5xl mb-4 opacity-20">🔍</div><p>执行诊断后，结果将在此显示</p></div>
    </div>
  );

  return (
    <StepLayout stepNumber={6} stepTitle="问题诊断" stepDescription="诊断剧本中的深层问题，如角色动机不足、情节断裂、节奏失衡等" projectId={pid} inputSection={inputSection} operationSection={operationSection} downloadButtons={downloadButtons}>
      {outputContent}
    </StepLayout>
  );
}
