import { useState, useCallback, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import StepLayout, { InputSection } from './StepLayout';
import PromptEditor from '../../components/PromptEditor';
import { usePipeline } from '../../hooks/usePipeline';
import { useStepData } from '../../hooks/useStepData';
import { loadSettings } from '../../components/SettingsPanel';
import type { PipelineSettings, Shot, ScriptAnalysis, SeedancePrompt, QualityReport, RepairFinalResult } from '../../lib/types';
import { STAGE_CONFIGS } from '../../lib/constants';
import { downloadFile, exportFinalStoryboard, exportFinalQualityReport } from '../../utils/exporter';

export default function Step5Page() {
  const { id: projectId } = useParams<{ id: string }>();
  const pid = projectId || '';
  const [inputText, setInputText] = useState('');
  const [settings, setSettings] = useState<PipelineSettings>(loadSettings);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showRepairPrompt, setShowRepairPrompt] = useState(false);
  const { steps, isRunning, setScriptText, setPrevResults, executeStep, updateSettings } = usePipeline();
  const { getStepOutput, saveStepOutput } = useStepData(pid);

  const qualityStep = steps.find((s) => s.id === 'quality_check');
  const repairStep = steps.find((s) => s.id === 'repair_final');
  const qualityReport: QualityReport | null =
    qualityStep?.status === 'done' && qualityStep.result
      ? (qualityStep.result as QualityReport)
      : null;
  const repairResult: RepairFinalResult | null =
    repairStep?.status === 'done' && repairStep.result
      ? (repairStep.result as RepairFinalResult)
      : null;

  const qualityConfig = STAGE_CONFIGS.find((s) => s.id === 'quality_check');
  const repairConfig = STAGE_CONFIGS.find((s) => s.id === 'repair_final');

  const handleRunQuality = useCallback(() => {
    if (!inputText.trim()) return;
    const step2Output = getStepOutput(2);
    const step3Output = getStepOutput(3);
    const step4Output = getStepOutput(4);
    const prev: Record<string, unknown> = {};
    if (step2Output) prev.analysis = step2Output.data;
    if (step3Output) {
      const step3Data = step3Output.data as { shots?: Shot[] };
      if (step3Data.shots) prev.shots = step3Data.shots;
    }
    if (step4Output) prev.seedancePrompts = step4Output.data;
    setPrevResults(prev as { shots?: Shot[]; analysis?: ScriptAnalysis; seedancePrompts?: SeedancePrompt[] });
    setScriptText(inputText);
    executeStep('quality_check');
  }, [inputText, setScriptText, setPrevResults, executeStep, getStepOutput]);

  const handleRunRepair = useCallback(() => {
    if (!qualityReport) return;
    const step2Output = getStepOutput(2);
    const step3Output = getStepOutput(3);
    const prev: Record<string, unknown> = {};
    if (step2Output) prev.analysis = step2Output.data;
    if (step3Output) {
      const step3Data = step3Output.data as { shots?: Shot[] };
      if (step3Data.shots) prev.shots = step3Data.shots;
    }
    prev.qualityReport = qualityReport;
    setPrevResults(prev as { shots?: Shot[]; analysis?: ScriptAnalysis; seedancePrompts?: SeedancePrompt[] });
    executeStep('repair_final');
  }, [qualityReport, setPrevResults, executeStep, getStepOutput]);

  useEffect(() => {
    if (qualityReport && qualityStep?.status === 'done') {
      saveStepOutput(5, qualityStep.result);
    }
  }, [qualityReport, qualityStep, saveStepOutput]);

  const handleQualityPromptChange = (prompt: string) => {
    const next = { ...settings, customPrompts: { ...settings.customPrompts, quality_check: prompt } };
    setSettings(next);
    updateSettings(next);
  };

  const handleRepairPromptChange = (prompt: string) => {
    const next = { ...settings, customPrompts: { ...settings.customPrompts, repair_final: prompt } };
    setSettings(next);
    updateSettings(next);
  };

  const handleDownloadReport = () => {
    if (!qualityReport) return;
    const lines: string[] = ['# 质检报告', ''];
    lines.push(`- 总镜头数: ${qualityReport.totalShots}`);
    lines.push(`- 总时长: ${qualityReport.totalDuration}s`);
    lines.push(`- Seedance 质量评分: ${qualityReport.seedanceQualityScore}/100`);
    lines.push('');
    if (qualityReport.continuityIssues.length > 0) {
      lines.push('## 连贯性问题');
      qualityReport.continuityIssues.forEach((issue, i) => {
        lines.push(`${i + 1}. ${issue}`);
      });
      lines.push('');
    }
    if (qualityReport.qualityNotes.length > 0) {
      lines.push('## 质量备注');
      qualityReport.qualityNotes.forEach((note, i) => {
        lines.push(`${i + 1}. ${note}`);
      });
    }
    downloadFile(lines.join('\n'), 'quality-report.md', 'text/markdown');
  };

  const handleDownloadJSON = () => {
    if (!qualityReport) return;
    downloadFile(JSON.stringify(qualityReport, null, 2), 'quality-report.json', 'application/json');
  };

  const handleDownloadFinalStoryboard = () => {
    if (!repairResult) return;
    exportFinalStoryboard(repairResult.finalStoryboardText, '分镜项目');
  };

  const handleDownloadFinalReport = () => {
    if (!repairResult) return;
    exportFinalQualityReport(
      { fixedIssues: repairResult.fixedIssues, manualReviewItems: repairResult.manualReviewItems, formatCompliance: repairResult.formatCompliance },
      '分镜项目'
    );
  };

  const qualityDone = qualityStep?.status === 'done';
  const repairRunning = repairStep?.status === 'running';

  return (
    <StepLayout stepNumber={5} stepTitle="质检与输出" projectId={pid}>
      <InputSection stepNumber={5} projectId={pid} value={inputText} onChange={setInputText} />

      <div className="px-4 py-3 border-b border-gray-700/50">
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={handleRunQuality}
            disabled={isRunning || !inputText.trim()}
            className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${
              isRunning || !inputText.trim()
                ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:from-blue-500 hover:to-cyan-500 shadow-md active:scale-[0.98]'
            }`}
          >
            {isRunning && qualityStep?.status === 'running' ? '⏳ 质检中...' : '▶ 执行质检'}
          </button>
          <button
            onClick={handleRunRepair}
            disabled={isRunning || !qualityDone}
            className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${
              isRunning || !qualityDone
                ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-amber-600 to-orange-600 text-white hover:from-amber-500 hover:to-orange-500 shadow-md active:scale-[0.98]'
            }`}
          >
            {repairRunning ? '⏳ 修复格式化中...' : '🔧 修复 + 格式化'}
          </button>
          <button
            onClick={() => setShowPrompt(!showPrompt)}
            className={`px-3 py-2 text-xs rounded-lg transition-colors ${
              showPrompt ? 'bg-amber-600/20 text-amber-400' : 'text-gray-400 bg-gray-800 hover:bg-gray-700'
            }`}
          >
            P 质检提示词
          </button>
          <button
            onClick={() => setShowRepairPrompt(!showRepairPrompt)}
            className={`px-3 py-2 text-xs rounded-lg transition-colors ${
              showRepairPrompt ? 'bg-orange-600/20 text-orange-400' : 'text-gray-400 bg-gray-800 hover:bg-gray-700'
            }`}
          >
            P 修复提示词
          </button>
        </div>

        {qualityStep?.status === 'running' && qualityStep.streamText && (
          <div className="mt-3 p-3 bg-gray-950 rounded-lg max-h-32 overflow-auto">
            <pre className="text-xs text-green-400/80 font-mono whitespace-pre-wrap" style={{ textAlign: 'left' }}>
              {qualityStep.streamText}
            </pre>
          </div>
        )}
        {qualityStep?.status === 'error' && qualityStep.error && (
          <div className="mt-3 p-3 bg-red-950/30 rounded-lg">
            <p className="text-xs text-red-400" style={{ textAlign: 'left' }}>{qualityStep.error}</p>
          </div>
        )}

        {repairStep?.status === 'running' && repairStep.streamText && (
          <div className="mt-3 p-3 bg-gray-950 rounded-lg max-h-32 overflow-auto">
            <pre className="text-xs text-orange-400/80 font-mono whitespace-pre-wrap" style={{ textAlign: 'left' }}>
              {repairStep.streamText}
            </pre>
          </div>
        )}
        {repairStep?.status === 'error' && repairStep.error && (
          <div className="mt-3 p-3 bg-red-950/30 rounded-lg">
            <p className="text-xs text-red-400" style={{ textAlign: 'left' }}>{repairStep.error}</p>
          </div>
        )}

        {showPrompt && qualityConfig && (
          <div className="mt-3 p-3 bg-gray-800/50 rounded-lg border border-gray-700/30">
            <PromptEditor
              stageId="quality_check"
              defaultPrompt={qualityConfig.defaultSystemPrompt}
              customPrompt={settings.customPrompts?.quality_check}
              onPromptChange={handleQualityPromptChange}
              availableVariables={qualityConfig.availableVariables}
              onReset={() => {
                const next = { ...settings, customPrompts: { ...settings.customPrompts } };
                (next.customPrompts as Record<string, string | undefined>)['quality_check'] = undefined;
                setSettings(next);
                updateSettings(next);
              }}
            />
          </div>
        )}

        {showRepairPrompt && repairConfig && (
          <div className="mt-3 p-3 bg-gray-800/50 rounded-lg border border-gray-700/30">
            <PromptEditor
              stageId="repair_final"
              defaultPrompt={repairConfig.defaultSystemPrompt}
              customPrompt={settings.customPrompts?.repair_final}
              onPromptChange={handleRepairPromptChange}
              availableVariables={repairConfig.availableVariables}
              onReset={() => {
                const next = { ...settings, customPrompts: { ...settings.customPrompts } };
                (next.customPrompts as Record<string, string | undefined>)['repair_final'] = undefined;
                setSettings(next);
                updateSettings(next);
              }}
            />
          </div>
        )}
      </div>

      <div className="p-4 space-y-6">
        {/* 质检报告 */}
        <div>
          <h3 className="text-sm font-semibold text-gray-300 mb-3">质检报告</h3>
          {qualityReport ? (
            <div className="space-y-4">
              <div className="bg-gray-800/50 rounded-lg border border-cyan-500/20 p-4">
                <h4 className="text-xs font-semibold text-cyan-400 mb-2">总览</h4>
                <div className="text-xs text-gray-400 space-y-1">
                  <p>总镜头数: {qualityReport.totalShots}</p>
                  <p>总时长: {qualityReport.totalDuration}s</p>
                  <p>质量评分: <span className={`font-bold ${qualityReport.seedanceQualityScore >= 80 ? 'text-green-400' : qualityReport.seedanceQualityScore >= 60 ? 'text-amber-400' : 'text-red-400'}`}>{qualityReport.seedanceQualityScore}/100</span></p>
                </div>
              </div>

              {qualityReport.continuityIssues.length > 0 && (
                <div className="bg-gray-800/50 rounded-lg border border-amber-500/20 p-4">
                  <h4 className="text-xs font-semibold text-amber-400 mb-2">连贯性问题 ({qualityReport.continuityIssues.length})</h4>
                  <div className="text-xs text-gray-400 space-y-1">
                    {qualityReport.continuityIssues.map((issue, i) => (
                      <p key={i} style={{ textAlign: 'left' }}>{i + 1}. {issue}</p>
                    ))}
                  </div>
                </div>
              )}

              {qualityReport.qualityNotes.length > 0 && (
                <div className="bg-gray-800/50 rounded-lg border border-gray-600/20 p-4">
                  <h4 className="text-xs font-semibold text-gray-400 mb-2">质量备注</h4>
                  <div className="text-xs text-gray-400 space-y-1">
                    {qualityReport.qualityNotes.map((note, i) => (
                      <p key={i} style={{ textAlign: 'left' }}>{i + 1}. {note}</p>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={handleDownloadReport} className="flex-1 px-3 py-2 text-xs font-medium bg-cyan-600 hover:bg-cyan-700 rounded-lg text-white transition-colors">
                  📥 下载质检报告 (.md)
                </button>
                <button onClick={handleDownloadJSON} className="flex-1 px-3 py-2 text-xs font-medium bg-blue-600 hover:bg-blue-700 rounded-lg text-white transition-colors">
                  📥 下载 JSON
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 text-sm">
              <div className="text-4xl mb-3 opacity-30">✅</div>
              <p>执行质检后，报告将在此显示</p>
            </div>
          )}
        </div>

        {/* 修复报告 + 最终分镜头剧本 */}
        <div>
          <h3 className="text-sm font-semibold text-gray-300 mb-3">修复与格式化输出</h3>
          {repairResult ? (
            <div className="space-y-4">
              {/* 修复报告摘要 */}
              <div className="bg-gray-800/50 rounded-lg border border-orange-500/20 p-4">
                <h4 className="text-xs font-semibold text-orange-400 mb-2">修复报告</h4>
                <div className="text-xs text-gray-400 space-y-1">
                  <p>已修复问题: <span className="text-green-400 font-bold">{repairResult.fixedIssues}</span></p>
                  <p>格式合规度: <span className={`font-bold ${repairResult.formatCompliance >= 80 ? 'text-green-400' : repairResult.formatCompliance >= 60 ? 'text-amber-400' : 'text-red-400'}`}>{repairResult.formatCompliance}/100</span></p>
                  <p>需人工确认: <span className={repairResult.manualReviewItems.length > 0 ? 'text-amber-400 font-bold' : 'text-gray-500'}>{repairResult.manualReviewItems.length} 项</span></p>
                </div>
              </div>

              {repairResult.manualReviewItems.length > 0 && (
                <div className="bg-gray-800/50 rounded-lg border border-amber-500/20 p-4">
                  <h4 className="text-xs font-semibold text-amber-400 mb-2">需人工确认项</h4>
                  <div className="text-xs text-gray-400 space-y-1">
                    {repairResult.manualReviewItems.map((item, i) => (
                      <p key={i} style={{ textAlign: 'left' }}>{i + 1}. {item}</p>
                    ))}
                  </div>
                </div>
              )}

              {/* 最终分镜头剧本预览 */}
              <div className="bg-gray-800/50 rounded-lg border border-gray-600/20 p-4">
                <h4 className="text-xs font-semibold text-gray-400 mb-2">最终分镜头剧本</h4>
                <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap max-h-96 overflow-auto" style={{ textAlign: 'left' }}>
                  {repairResult.finalStoryboardText}
                </pre>
              </div>

              <div className="flex gap-2">
                <button onClick={handleDownloadFinalStoryboard} className="flex-1 px-3 py-2 text-xs font-medium bg-orange-600 hover:bg-orange-700 rounded-lg text-white transition-colors">
                  📥 最终分镜头剧本 (.md)
                </button>
                <button onClick={handleDownloadFinalReport} className="flex-1 px-3 py-2 text-xs font-medium bg-amber-600 hover:bg-amber-700 rounded-lg text-white transition-colors">
                  📥 质检报告 (.md)
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 text-sm">
              <div className="text-4xl mb-3 opacity-30">🔧</div>
              <p>质检完成后，点击「修复 + 格式化」生成最终分镜头剧本</p>
            </div>
          )}
        </div>
      </div>
    </StepLayout>
  );
}
