import { useState, useCallback, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import StepLayout, { InputSection } from './StepLayout';
import PromptEditor from '../../components/PromptEditor';
import { usePipeline } from '../../hooks/usePipeline';
import { useStepData } from '../../hooks/useStepData';
import { loadSettings } from '../../components/SettingsPanel';
import type { PipelineSettings, Shot, ScriptAnalysis } from '../../lib/types';
import { STAGE_CONFIGS } from '../../lib/constants';
import { downloadFile } from '../../utils/exporter';

interface CheckIssue { shotNumber: number; type: string; severity: string; description: string; suggestion: string; }
interface DecomposeCheckResult { totalShots: number; totalDuration: number; issues: CheckIssue[]; score: number; summary: string; }

export default function Step8Page() {
  const { id: projectId } = useParams<{ id: string }>();
  const pid = projectId || '';
  const [inputText, setInputText] = useState('');
  const [settings, setSettings] = useState<PipelineSettings>(loadSettings);
  const [showPrompt, setShowPrompt] = useState(false);
  const { steps, isRunning, setScriptText, setPrevResults, executeStep, updateSettings } = usePipeline();
  const { getStepOutput, saveStepOutput } = useStepData(pid);

  const decomposeCheckStep = steps.find((s) => s.id === 'decompose_check');
  const checkResult: DecomposeCheckResult | null = decomposeCheckStep?.status === 'done' && decomposeCheckStep.result
    ? (decomposeCheckStep.result as DecomposeCheckResult) : null;
  const stageConfig = STAGE_CONFIGS.find((s) => s.id === 'decompose_check');

  const handleRun = useCallback(() => {
    if (!inputText.trim()) return;
    const step2Output = getStepOutput(2);
    const step3Output = getStepOutput(3);
    const prev: Record<string, unknown> = {};
    if (step2Output) prev.analysis = step2Output.data;
    if (step3Output) { const d = step3Output.data as { shots?: Shot[] }; if (d.shots) prev.shots = d.shots; }
    setPrevResults(prev as { shots?: Shot[]; analysis?: ScriptAnalysis });
    setScriptText(inputText);
    executeStep('decompose_check');
  }, [inputText, setScriptText, setPrevResults, executeStep, getStepOutput]);

  useEffect(() => {
    if (checkResult && decomposeCheckStep?.status === 'done') saveStepOutput(8, decomposeCheckStep.result);
  }, [checkResult, decomposeCheckStep, saveStepOutput]);

  const handlePromptChange = (prompt: string) => {
    const next = { ...settings, customPrompts: { ...settings.customPrompts, decompose_check: prompt } };
    setSettings(next); updateSettings(next);
  };

  const inputSection = <InputSection stepNumber={8} projectId={pid} value={inputText} onChange={setInputText} />;
  const operationSection = (
    <div className="px-6 py-3 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={handleRun} disabled={isRunning || !inputText.trim()}
          className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${isRunning || !inputText.trim() ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-500 hover:to-emerald-500 shadow-md active:scale-[0.98]'}`}>
          {isRunning ? '⏳ 质检中...' : '▶ 分镜质检'}
        </button>
        <button onClick={() => setShowPrompt(!showPrompt)} className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${showPrompt ? 'bg-amber-600/20 text-amber-400' : 'text-gray-400 bg-gray-800 hover:bg-gray-700'}`}>P 提示词</button>
      </div>
      {decomposeCheckStep?.status === 'running' && decomposeCheckStep.streamText && (
        <div className="p-3 bg-gray-950 rounded-lg max-h-24 overflow-auto">
          <pre className="text-xs text-green-400/80 font-mono whitespace-pre-wrap" style={{ textAlign: 'left' }}>{decomposeCheckStep.streamText}</pre>
        </div>
      )}
      {decomposeCheckStep?.status === 'error' && decomposeCheckStep.error && (
        <div className="p-2 bg-red-950/30 rounded-lg"><p className="text-xs text-red-400">{decomposeCheckStep.error}</p></div>
      )}
      {showPrompt && stageConfig && (
        <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700/30">
          <PromptEditor stageId="decompose_check" defaultPrompt={stageConfig.defaultSystemPrompt} customPrompt={settings.customPrompts?.decompose_check} onPromptChange={handlePromptChange} availableVariables={stageConfig.availableVariables}
            onReset={() => { const next = { ...settings, customPrompts: { ...settings.customPrompts } }; (next.customPrompts as Record<string, string | undefined>)['decompose_check'] = undefined; setSettings(next); updateSettings(next); }} />
        </div>
      )}
    </div>
  );

  const downloadButtons = checkResult ? (
    <button onClick={() => downloadFile(JSON.stringify(checkResult, null, 2), 'decompose-check.json', 'application/json')} className="px-4 py-2 text-xs font-medium bg-green-600 hover:bg-green-700 rounded-lg text-white transition-colors">📥 质检报告 JSON</button>
  ) : null;

  const outputContent = checkResult ? (
    <div className="space-y-4">
      <div className="bg-gray-800/40 rounded-xl border border-green-500/20 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-200">📋 分镜质检报告</h3>
          <span className={`text-xl font-bold ${checkResult.score >= 80 ? 'text-green-400' : checkResult.score >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>{checkResult.score}分</span>
        </div>
        <p className="text-xs text-gray-300 mb-3">{checkResult.summary}</p>
        {checkResult.issues.length > 0 && (
          <div className="max-h-48 overflow-auto space-y-2">
            {checkResult.issues.map((issue, i) => (
              <div key={i} className="p-2 bg-gray-900/50 rounded-lg text-xs">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-1.5 py-0.5 rounded ${issue.severity === '严重' ? 'bg-red-900/50 text-red-400' : 'bg-gray-700 text-gray-400'}`}>{issue.severity}</span>
                  <span className="text-gray-500">镜头 #{issue.shotNumber}</span>
                  <span className="text-gray-400">{issue.type}</span>
                </div>
                <p className="text-gray-300">{issue.description}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  ) : (
    <div className="flex items-center justify-center h-64">
      <div className="text-center text-gray-500 text-sm"><div className="text-5xl mb-4 opacity-20">🔍</div><p>执行分镜质检后，结果将在此显示</p></div>
    </div>
  );

  return (
    <StepLayout stepNumber={8} stepTitle="分解检查" stepDescription="检查镜头分解的完整性和一致性，补充遗漏的镜头" projectId={pid} inputSection={inputSection} operationSection={operationSection} downloadButtons={downloadButtons}>
      {outputContent}
    </StepLayout>
  );
}
