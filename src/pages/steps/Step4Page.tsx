import { useState, useCallback, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import StepLayout, { InputSection } from './StepLayout';
import PromptEditor from '../../components/PromptEditor';
import SeedancePreview from '../../components/SeedancePreview';
import { usePipeline } from '../../hooks/usePipeline';
import { useStepData } from '../../hooks/useStepData';
import { loadSettings } from '../../components/SettingsPanel';
import type { PipelineSettings, Shot, ScriptAnalysis, SeedancePrompt } from '../../lib/types';
import { STAGE_CONFIGS } from '../../lib/constants';
import { exportSeedancePrompts, downloadFile } from '../../utils/exporter';

interface CheckIssue {
  shotNumber: number;
  type: string;
  severity: string;
  description: string;
  suggestion: string;
}

interface PromptgenCheckResult {
  totalPrompts: number;
  formatCompliance: number;
  issues: CheckIssue[];
  score: number;
  summary: string;
}

export default function Step4Page() {
  const { id: projectId } = useParams<{ id: string }>();
  const pid = projectId || '';
  const [inputText, setInputText] = useState('');
  const [settings, setSettings] = useState<PipelineSettings>(loadSettings);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<PromptgenCheckResult | null>(null);
  const { steps, isRunning, setScriptText, setPrevResults, executeStep, updateSettings } = usePipeline();
  const { getStepOutput, saveStepOutput } = useStepData(pid);

  const promptGenStep = steps.find((s) => s.id === 'prompt_gen');
  const seedancePrompts: SeedancePrompt[] | null =
    promptGenStep?.status === 'done' && promptGenStep.result
      ? (promptGenStep.result as SeedancePrompt[])
      : null;

  const stageConfig = STAGE_CONFIGS.find((s) => s.id === 'prompt_gen');

  const handleRun = useCallback(() => {
    if (!inputText.trim()) return;
    const step2Output = getStepOutput(2);
    const step3Output = getStepOutput(3);
    const prev: Record<string, unknown> = {};
    if (step2Output) prev.analysis = step2Output.data;
    if (step3Output) {
      const step3Data = step3Output.data as { shots?: Shot[] };
      if (step3Data.shots) prev.shots = step3Data.shots;
    }
    setPrevResults(prev as { shots?: Shot[]; analysis?: ScriptAnalysis });
    setScriptText(inputText);
    executeStep('prompt_gen');
  }, [inputText, setScriptText, setPrevResults, executeStep, getStepOutput]);

  useEffect(() => {
    if (seedancePrompts && promptGenStep?.status === 'done') {
      saveStepOutput(4, promptGenStep.result);
    }
  }, [seedancePrompts, promptGenStep, saveStepOutput]);

  const handlePromptChange = (prompt: string) => {
    const next = { ...settings, customPrompts: { ...settings.customPrompts, prompt_gen: prompt } };
    setSettings(next);
    updateSettings(next);
  };

  const handleComplianceCheck = useCallback(async () => {
    if (!seedancePrompts) return;
    setIsChecking(true);
    setCheckResult(null);
    try {
      const response = await fetch('/api/pipeline/step4-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seedancePrompts, settings }),
      });
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let result: PromptgenCheckResult | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const doneIdx = buffer.indexOf('event: done');
        if (doneIdx !== -1) {
          const afterDone = buffer.slice(doneIdx);
          const dataMatch = afterDone.match(/data:\s*(.+)/);
          if (dataMatch) {
            result = JSON.parse(dataMatch[1]);
          }
          break;
        }

        const errorIdx = buffer.indexOf('event: error');
        if (errorIdx !== -1) {
          const afterError = buffer.slice(errorIdx);
          const dataMatch = afterError.match(/data:\s*(.+)/);
          if (dataMatch) {
            const errData = JSON.parse(dataMatch[1]);
            throw new Error(errData.error || 'Unknown error');
          }
        }
      }

      if (result) {
        setCheckResult(result);
      }
    } catch (err) {
      console.error('Compliance check failed:', err);
      alert(`合规检查失败: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsChecking(false);
    }
  }, [seedancePrompts, settings]);

  const handleDownloadCheckResult = () => {
    if (!checkResult) return;
    downloadFile(JSON.stringify(checkResult, null, 2), 'promptgen-check-result.json', 'application/json');
  };

  return (
    <StepLayout stepNumber={4} stepTitle="Seedance Prompt" projectId={pid}>
      <InputSection stepNumber={4} projectId={pid} value={inputText} onChange={setInputText} />

      <div className="px-4 py-3 border-b border-gray-700/50">
        <div className="flex items-center gap-3">
          <button
            onClick={handleRun}
            disabled={isRunning || !inputText.trim()}
            className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${
              isRunning || !inputText.trim()
                ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:from-blue-500 hover:to-cyan-500 shadow-md active:scale-[0.98]'
            }`}
          >
            {isRunning ? '⏳ 生成中...' : '▶ 生成 Prompt'}
          </button>
          <button
            onClick={handleComplianceCheck}
            disabled={isChecking || !seedancePrompts}
            className={`px-3 py-2 text-xs rounded-lg transition-colors ${
              isChecking || !seedancePrompts
                ? 'text-gray-600 bg-gray-800/50 cursor-not-allowed'
                : 'bg-green-600/20 text-green-400 hover:bg-green-600/30'
            }`}
          >
            {isChecking ? '⏳ 检查中...' : '✅ 合规检查'}
          </button>
          <button
            onClick={() => setShowPrompt(!showPrompt)}
            className={`px-3 py-2 text-xs rounded-lg transition-colors ${
              showPrompt ? 'bg-amber-600/20 text-amber-400' : 'text-gray-400 bg-gray-800 hover:bg-gray-700'
            }`}
          >
            P 提示词
          </button>
        </div>

        {promptGenStep?.status === 'running' && promptGenStep.streamText && (
          <div className="mt-3 p-3 bg-gray-950 rounded-lg max-h-32 overflow-auto">
            <pre className="text-xs text-green-400/80 font-mono whitespace-pre-wrap" style={{ textAlign: 'left' }}>
              {promptGenStep.streamText}
            </pre>
          </div>
        )}
        {promptGenStep?.status === 'error' && promptGenStep.error && (
          <div className="mt-3 p-3 bg-red-950/30 rounded-lg">
            <p className="text-xs text-red-400" style={{ textAlign: 'left' }}>{promptGenStep.error}</p>
          </div>
        )}

        {showPrompt && stageConfig && (
          <div className="mt-3 p-3 bg-gray-800/50 rounded-lg border border-gray-700/30">
            <PromptEditor
              stageId="prompt_gen"
              defaultPrompt={stageConfig.defaultSystemPrompt}
              customPrompt={settings.customPrompts?.prompt_gen}
              onPromptChange={handlePromptChange}
              availableVariables={stageConfig.availableVariables}
              onReset={() => {
                const next = { ...settings, customPrompts: { ...settings.customPrompts } };
                (next.customPrompts as Record<string, string | undefined>)['prompt_gen'] = undefined;
                setSettings(next);
                updateSettings(next);
              }}
            />
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        {checkResult && (
          <div className="mx-4 mt-4 p-4 bg-gray-800/50 rounded-lg border border-gray-700/30">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-200">📋 Prompt 合规检查报告</h3>
              <div className="flex items-center gap-2">
                <span className={`text-lg font-bold ${checkResult.score >= 80 ? 'text-green-400' : checkResult.score >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {checkResult.score}分
                </span>
                <button
                  onClick={handleDownloadCheckResult}
                  className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 rounded text-white transition-colors"
                >
                  📥 下载
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-3">
              <div className="text-xs text-gray-400">
                <span className="text-gray-500">总 Prompt 数：</span>
                <span className="text-gray-200">{checkResult.totalPrompts}</span>
              </div>
              <div className="text-xs text-gray-400">
                <span className="text-gray-500">格式合规率：</span>
                <span className="text-gray-200">{checkResult.formatCompliance}%</span>
              </div>
            </div>
            <p className="text-xs text-gray-300 mb-3">{checkResult.summary}</p>
            {checkResult.issues.length > 0 && (
              <div className="max-h-48 overflow-auto">
                <h4 className="text-xs font-medium text-gray-400 mb-2">问题列表 ({checkResult.issues.length})</h4>
                <div className="space-y-2">
                  {checkResult.issues.slice(0, 10).map((issue, i) => (
                    <div key={i} className="p-2 bg-gray-900/50 rounded text-xs">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-1.5 py-0.5 rounded ${
                          issue.severity === '严重' ? 'bg-red-900/50 text-red-400' :
                          issue.severity === '中等' ? 'bg-yellow-900/50 text-yellow-400' :
                          'bg-gray-700 text-gray-400'
                        }`}>
                          {issue.severity}
                        </span>
                        <span className="text-gray-500">镜头 #{issue.shotNumber}</span>
                        <span className="text-gray-600">·</span>
                        <span className="text-gray-400">{issue.type}</span>
                      </div>
                      <p className="text-gray-300">{issue.description}</p>
                      <p className="text-gray-500 mt-1">建议：{issue.suggestion}</p>
                    </div>
                  ))}
                  {checkResult.issues.length > 10 && (
                    <p className="text-xs text-gray-500 text-center">... 还有 {checkResult.issues.length - 10} 个问题</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {seedancePrompts ? (
          <div>
            <SeedancePreview
              prompts={seedancePrompts}
              version={settings.targetSeedanceVersion}
              onVersionChange={(v) => setSettings({ ...settings, targetSeedanceVersion: v })}
            />
            <div className="px-4 py-3">
              <button
                onClick={() => exportSeedancePrompts(seedancePrompts, settings.targetSeedanceVersion)}
                className="px-4 py-2 text-xs font-medium bg-cyan-600 hover:bg-cyan-700 rounded-lg text-white transition-colors"
              >
                📥 下载 Seedance Prompt
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500 text-sm">
            <div className="text-4xl mb-3 opacity-30">🎬</div>
            <p>生成 Prompt 后，结果将在此显示</p>
          </div>
        )}
      </div>
    </StepLayout>
  );
}
