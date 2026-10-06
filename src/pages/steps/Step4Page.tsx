import { useState, useCallback, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import StepLayout, { InputSection } from './StepLayout';
import PromptEditor from '../../components/PromptEditor';
import { usePipeline } from '../../hooks/usePipeline';
import { useStepData } from '../../hooks/useStepData';
import { loadSettings } from '../../components/SettingsPanel';
import type { PipelineSettings, Shot, ScriptAnalysis, StoryboardScript } from '../../lib/types';
import { STAGE_CONFIGS } from '../../lib/constants';
import { exportStoryboardScript, exportStoryboardScriptTxt, downloadFile } from '../../utils/exporter';

interface ClipCheckIssue { type: string; severity: string; description: string; suggestion: string; }
interface ClipCheck { clipNumber: number; shotType: string; duration: number; charCount: number; cameraMovements: string[]; compliant: boolean; issues: ClipCheckIssue[]; }
interface StoryboardCheckResult { totalClips: number; totalDuration: number; formatCompliance: number; clipChecks: ClipCheck[]; continuityIssues: string[]; overallScore: number; summary: string; }

export default function Step4Page() {
  const { id: projectId } = useParams<{ id: string }>();
  const pid = projectId || '';
  const [inputText, setInputText] = useState('');
  const [settings, setSettings] = useState<PipelineSettings>(loadSettings);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<StoryboardCheckResult | null>(null);
  const { steps, isRunning, setScriptText, setPrevResults, executeStep, updateSettings } = usePipeline();
  const { getStepOutput, saveStepOutput } = useStepData(pid);

  const promptGenStep = steps.find((s) => s.id === 'prompt_gen');
  const storyboardScript: StoryboardScript | null = promptGenStep?.status === 'done' && promptGenStep.result ? (promptGenStep.result as StoryboardScript) : null;
  const stageConfig = STAGE_CONFIGS.find((s) => s.id === 'prompt_gen');

  const handleRun = useCallback(() => {
    if (!inputText.trim()) return;
    const step2Output = getStepOutput(2);
    const step3Output = getStepOutput(3);
    const prev: Record<string, unknown> = {};
    if (step2Output) prev.analysis = step2Output.data;
    if (step3Output) { const step3Data = step3Output.data as { shots?: Shot[] }; if (step3Data.shots) prev.shots = step3Data.shots; }
    setPrevResults(prev as { shots?: Shot[]; analysis?: ScriptAnalysis });
    setScriptText(inputText);
    executeStep('prompt_gen');
  }, [inputText, setScriptText, setPrevResults, executeStep, getStepOutput]);

  useEffect(() => { if (storyboardScript && promptGenStep?.status === 'done') saveStepOutput(4, promptGenStep.result); }, [storyboardScript, promptGenStep, saveStepOutput]);

  const handlePromptChange = (prompt: string) => {
    const next = { ...settings, customPrompts: { ...settings.customPrompts, prompt_gen: prompt } };
    setSettings(next); updateSettings(next);
  };

  const handleComplianceCheck = useCallback(async () => {
    if (!storyboardScript) return;
    setIsChecking(true); setCheckResult(null);
    try {
      const response = await fetch('/api/pipeline/step4-check', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ storyboardScript, settings }),
      });
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      if (!response.body) throw new Error('No response body');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = ''; let result: StoryboardCheckResult | null = null;
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
    } catch (err) { alert(`合规检查失败: ${err instanceof Error ? err.message : 'Unknown error'}`); }
    finally { setIsChecking(false); }
  }, [storyboardScript, settings]);

  // ===== Input Section =====
  const inputSection = (
    <InputSection stepNumber={4} projectId={pid} value={inputText} onChange={setInputText} />
  );

  // ===== Operation Section =====
  const operationSection = (
    <div className="px-6 py-3 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={handleRun} disabled={isRunning || !inputText.trim()}
          className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${isRunning || !inputText.trim() ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:from-blue-500 hover:to-cyan-500 shadow-md active:scale-[0.98]'}`}>
          {isRunning ? '⏳ 生成中...' : '▶ 生成分镜头剧本'}
        </button>
        <button onClick={handleComplianceCheck} disabled={isChecking || !storyboardScript}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${isChecking || !storyboardScript ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-500 hover:to-emerald-500 shadow-md active:scale-[0.98]'}`}>
          {isChecking ? '⏳ 检查中...' : '✅ 合规检查'}
        </button>
        <button onClick={() => setShowPrompt(!showPrompt)} className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${showPrompt ? 'bg-amber-600/20 text-amber-400' : 'text-gray-400 bg-gray-800 hover:bg-gray-700'}`}>P 提示词</button>
      </div>

      {promptGenStep?.status === 'running' && promptGenStep.streamText && (
        <div className="p-3 bg-gray-950 rounded-lg max-h-24 overflow-auto">
          <pre className="text-xs text-green-400/80 font-mono whitespace-pre-wrap" style={{ textAlign: 'left' }}>{promptGenStep.streamText}</pre>
        </div>
      )}
      {promptGenStep?.status === 'error' && promptGenStep.error && (
        <div className="p-3 bg-red-950/30 rounded-lg"><p className="text-xs text-red-400">{promptGenStep.error}</p></div>
      )}

      {showPrompt && stageConfig && (
        <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700/30">
          <PromptEditor stageId="prompt_gen" defaultPrompt={stageConfig.defaultSystemPrompt} customPrompt={settings.customPrompts?.prompt_gen} onPromptChange={handlePromptChange} availableVariables={stageConfig.availableVariables}
            onReset={() => { const next = { ...settings, customPrompts: { ...settings.customPrompts } }; (next.customPrompts as Record<string, string | undefined>)['prompt_gen'] = undefined; setSettings(next); updateSettings(next); }} />
        </div>
      )}
    </div>
  );

  // ===== Download Buttons =====
  const downloadButtons = (
    <div className="flex gap-3 flex-wrap">
      {storyboardScript && <button onClick={() => exportStoryboardScript(storyboardScript)} className="px-4 py-2 text-xs font-medium bg-cyan-600 hover:bg-cyan-700 rounded-lg text-white transition-colors">📥 分镜头剧本 .md</button>}
      {storyboardScript && <button onClick={() => exportStoryboardScriptTxt(storyboardScript)} className="px-4 py-2 text-xs font-medium bg-blue-600 hover:bg-blue-700 rounded-lg text-white transition-colors">📥 分镜头剧本 .txt</button>}
      {checkResult && <button onClick={() => downloadFile(JSON.stringify(checkResult, null, 2), 'storyboard-check-result.json', 'application/json')} className="px-4 py-2 text-xs font-medium bg-green-600 hover:bg-green-700 rounded-lg text-white transition-colors">📥 合规报告 JSON</button>}
    </div>
  );

  // ===== Output Content =====
  const outputContent = (
    <div>
      {checkResult && (
        <div className="mb-6 p-5 bg-gray-800/40 rounded-xl border border-gray-700/30">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-200">📋 分镜头剧本合规检查报告</h3>
            <span className={`text-xl font-bold ${checkResult.overallScore >= 80 ? 'text-green-400' : checkResult.overallScore >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>{checkResult.overallScore}分</span>
          </div>
          <div className="grid grid-cols-3 gap-4 mb-3">
            <div className="text-xs text-gray-400"><span className="text-gray-500">总 Clip 数：</span><span className="text-gray-200">{checkResult.totalClips}</span></div>
            <div className="text-xs text-gray-400"><span className="text-gray-500">总时长：</span><span className="text-gray-200">{checkResult.totalDuration}s</span></div>
            <div className="text-xs text-gray-400"><span className="text-gray-500">格式合规率：</span><span className="text-gray-200">{checkResult.formatCompliance}%</span></div>
          </div>
          <p className="text-xs text-gray-300 mb-3">{checkResult.summary}</p>
          {checkResult.clipChecks && checkResult.clipChecks.some(c => !c.compliant) && (
            <div className="max-h-48 overflow-auto space-y-2">
              {checkResult.clipChecks.filter(c => !c.compliant).map((clip, i) => (
                <div key={i} className="p-2 bg-gray-900/50 rounded-lg text-xs">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-1.5 py-0.5 rounded bg-gray-700 text-gray-300 font-mono">Clip {String(clip.clipNumber).padStart(2, '0')}</span>
                    <span className="text-gray-500">{clip.shotType}</span>
                    <span className="text-gray-500">{clip.duration}s</span>
                    <span className="text-gray-500">{clip.charCount}字</span>
                  </div>
                  {clip.issues.map((issue, j) => (
                    <div key={j} className="flex items-start gap-2 mt-1">
                      <span className={`px-1 py-0.5 rounded text-[10px] ${issue.severity === '严重' ? 'bg-red-900/50 text-red-400' : issue.severity === '中等' ? 'bg-yellow-900/50 text-yellow-400' : 'bg-gray-700 text-gray-400'}`}>{issue.severity}</span>
                      <span className="text-gray-400">{issue.type}：{issue.description}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {storyboardScript ? (
        <div className="bg-gray-800/40 rounded-xl border border-gray-700/30 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-semibold text-gray-200">🎬 分镜头剧本</h3>
              <span className="text-xs text-gray-500">{storyboardScript.totalClips} Clips · {storyboardScript.totalDuration}s</span>
            </div>
          </div>
          <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap max-h-[600px] overflow-auto leading-relaxed" style={{ textAlign: 'left' }}>{storyboardScript.formattedText}</pre>
        </div>
      ) : (
        <div className="flex items-center justify-center h-64">
          <div className="text-center text-gray-500 text-sm"><div className="text-5xl mb-4 opacity-20">🎬</div><p>生成分镜头剧本后，结果将在此显示</p></div>
        </div>
      )}
    </div>
  );

  return (
    <StepLayout stepNumber={4} stepTitle="Seedance 分镜头剧本" projectId={pid} inputSection={inputSection} operationSection={operationSection} downloadButtons={downloadButtons}>
      {outputContent}
    </StepLayout>
  );
}
