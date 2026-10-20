import { useState, useCallback, useRef } from 'react';
import type { StageId, PipelineStepState, PipelineSettings, PurifiedScript, StructuredScript, ScriptAnalysis, DiagnosisResult, RepairResult, Shot, StoryboardScript, QualityReport, RepairFinalResult } from '../lib/types';
import { FULL_PIPELINE_STEPS, DEFAULT_SETTINGS } from '../lib/constants';
import { callStepSSE } from './usePipeline';

const API_ENDPOINTS: Record<StageId, string> = {
  audit: '/api/pipeline/step1-audit',
  structure: '/api/pipeline/step1-structure',
  analyze: '/api/pipeline/step2-analyze',
  diagnose: '/api/pipeline/step2-diagnose',
  repair: '/api/pipeline/step2-repair',
  decompose: '/api/pipeline/step3-decompose',
  prompt_gen: '/api/pipeline/step4-prompt-gen',
  quality_check: '/api/pipeline/step5-quality',
  decompose_check: '/api/pipeline/step3-decompose-check',
  promptgen_check: '/api/pipeline/step4-check',
  repair_final: '/api/pipeline/step5-repair',
};

interface FullPipelineResults {
  purifiedScript?: PurifiedScript;
  structuredScript?: StructuredScript;
  analysis?: ScriptAnalysis;
  diagnosis?: DiagnosisResult;
  repair?: RepairResult;
  shots?: Shot[];
  storyboardScript?: StoryboardScript;
  qualityReport?: QualityReport;
  repairFinal?: RepairFinalResult;
}

function createInitialSteps(): PipelineStepState[] {
  return FULL_PIPELINE_STEPS.map((s) => ({
    id: s.id,
    name: s.name,
    status: 'idle' as const,
    streamText: '',
    result: undefined,
    error: undefined,
  }));
}

/** localStorage helpers for cross-step data passing */
interface StepData {
  stepNumber: number;
  timestamp: number;
  data: unknown;
  inputSource: string;
}

function readStepOutput(projectId: string, stepNumber: number): unknown | null {
  try {
    const raw = localStorage.getItem(`project-${projectId}-step${stepNumber}-output`);
    if (raw) {
      const entry: StepData = JSON.parse(raw);
      return entry.data;
    }
  } catch { /* ignore */ }
  return null;
}

function writeStepOutput(projectId: string, stepNumber: number, data: unknown) {
  const entry: StepData = {
    stepNumber,
    timestamp: Date.now(),
    data,
    inputSource: 'inherited',
  };
  localStorage.setItem(`project-${projectId}-step${stepNumber}-output`, JSON.stringify(entry));
}

function readScriptText(projectId: string): string {
  // Try step 1 input first
  try {
    const raw = localStorage.getItem(`project-${projectId}-step1-input`);
    if (raw) {
      const entry: StepData = JSON.parse(raw);
      if (typeof entry.data === 'string') return entry.data;
    }
  } catch { /* ignore */ }
  // Try project scriptText
  try {
    const raw = localStorage.getItem(`project-${projectId}`);
    if (raw) {
      const proj = JSON.parse(raw);
      if (proj.scriptText) return proj.scriptText;
    }
  } catch { /* ignore */ }
  return '';
}

export function useFullPipeline(projectId: string) {
  const [steps, setSteps] = useState<PipelineStepState[]>(createInitialSteps);
  const [isAutoRunning, setIsAutoRunning] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(-1);
  const resultsRef = useRef<FullPipelineResults>({});
  const settingsRef = useRef<PipelineSettings>(DEFAULT_SETTINGS);
  const abortRef = useRef<AbortController | null>(null);
  const scriptTextRef = useRef<string>('');

  const updateStep = useCallback((stepId: StageId, updates: Partial<PipelineStepState>) => {
    setSteps((prev) =>
      prev.map((step) => (step.id === stepId ? { ...step, ...updates } : step)),
    );
  }, []);

  /**
   * Build request body for a given step, reading previous results from
   * the in-memory resultsRef or falling back to localStorage.
   */
  const buildBody = useCallback(
    (stageId: StageId, settings: PipelineSettings): Record<string, unknown> => {
      const r = resultsRef.current;
      const customPrompt = settings.customPrompts?.[stageId] || undefined;

      // Helper: get a value from results or localStorage
      const getPurifiedScript = (): PurifiedScript | undefined => {
        if (r.purifiedScript) return r.purifiedScript;
        const stored = readStepOutput(projectId, 1);
        if (stored) return stored as PurifiedScript;
        return undefined;
      };

      const getAnalysis = (): ScriptAnalysis | undefined => {
        if (r.analysis) return r.analysis;
        const stored = readStepOutput(projectId, 2);
        if (stored) return stored as ScriptAnalysis;
        return undefined;
      };

      const getShots = (): Shot[] | undefined => {
        if (r.shots) return r.shots;
        const stored = readStepOutput(projectId, 3);
        if (stored && typeof stored === 'object' && 'shots' in (stored as Record<string, unknown>)) {
          return (stored as { shots: Shot[] }).shots;
        }
        return undefined;
      };

      const getDiagnosis = (): DiagnosisResult | undefined => {
        if (r.diagnosis) return r.diagnosis;
        return undefined;
      };

      const getStoryboardScript = (): StoryboardScript | undefined => {
        if (r.storyboardScript) return r.storyboardScript;
        const stored = readStepOutput(projectId, 4);
        if (stored) return stored as StoryboardScript;
        return undefined;
      };

      const getQualityReport = (): QualityReport | undefined => {
        if (r.qualityReport) return r.qualityReport;
        const stored = readStepOutput(projectId, 5);
        // Step 5 stores quality_check result directly
        if (stored && typeof stored === 'object' && 'overallScore' in (stored as Record<string, unknown>)) {
          return stored as QualityReport;
        }
        return undefined;
      };

      switch (stageId) {
        case 'audit':
          return { scriptText: scriptTextRef.current, settings, customPrompt };

        case 'structure': {
          const ps = getPurifiedScript();
          if (!ps) throw new Error('Missing purifiedScript from audit step');
          return { purifiedScript: ps, settings, customPrompt };
        }

        case 'analyze': {
          const ps = getPurifiedScript();
          if (!ps) throw new Error('Missing purifiedScript from audit step');
          return { purifiedScript: ps, settings, customPrompt };
        }

        case 'diagnose': {
          const ps = getPurifiedScript();
          const an = getAnalysis();
          if (!ps || !an) throw new Error('Missing data from previous steps');
          return { purifiedScript: ps, analysis: an, settings, customPrompt };
        }

        case 'repair': {
          const ps = getPurifiedScript();
          const diag = getDiagnosis();
          if (!ps || !diag) throw new Error('Missing diagnosis from previous step');
          return { purifiedScript: ps, diagnosis: diag, settings, customPrompt };
        }

        case 'decompose': {
          const ps = getPurifiedScript();
          const an = getAnalysis();
          if (!ps || !an) throw new Error('Missing data from previous steps');
          return { purifiedScript: ps, analysis: an, settings, customPrompt };
        }

        case 'decompose_check': {
          const an = getAnalysis();
          const sh = getShots();
          if (!sh || !an) throw new Error('Missing data from previous steps');
          return { shots: sh, analysis: an, settings, customPrompt };
        }

        case 'prompt_gen': {
          const sh = getShots();
          const an = getAnalysis();
          if (!sh || !an) throw new Error('Missing data from previous steps');
          return { shots: sh, analysis: an, settings, customPrompt };
        }

        case 'promptgen_check': {
          const sb = getStoryboardScript();
          if (!sb) throw new Error('Missing storyboardScript from previous step');
          return { storyboardScript: sb, settings, customPrompt };
        }

        case 'quality_check': {
          const sh = getShots();
          const an = getAnalysis();
          const sb = getStoryboardScript();
          if (!sh || !an || !sb) throw new Error('Missing data from previous steps');
          return { shots: sh, analysis: an, storyboardScript: sb, settings, customPrompt };
        }

        case 'repair_final': {
          const sh = getShots();
          const an = getAnalysis();
          const qr = getQualityReport();
          const sb = getStoryboardScript();
          if (!sh || !an || !qr) throw new Error('Missing data from previous steps');
          return { shots: sh, analysis: an, qualityReport: qr, storyboardScript: sb, settings, customPrompt };
        }

        default:
          throw new Error(`Unknown stage: ${stageId}`);
      }
    },
    [projectId],
  );

  /** Store result in resultsRef after step completes */
  const storeResult = useCallback((stageId: StageId, result: unknown) => {
    switch (stageId) {
      case 'audit':
        resultsRef.current.purifiedScript = result as PurifiedScript;
        break;
      case 'structure':
        resultsRef.current.structuredScript = result as StructuredScript;
        break;
      case 'analyze':
        resultsRef.current.analysis = result as ScriptAnalysis;
        break;
      case 'diagnose':
        resultsRef.current.diagnosis = result as DiagnosisResult;
        break;
      case 'repair':
        resultsRef.current.repair = result as RepairResult;
        break;
      case 'decompose': {
        const d = result as { shots: Shot[]; totalBatches?: number };
        resultsRef.current.shots = d.shots;
        break;
      }
      case 'prompt_gen':
        resultsRef.current.storyboardScript = result as StoryboardScript;
        break;
      case 'quality_check':
        resultsRef.current.qualityReport = result as QualityReport;
        break;
      case 'repair_final':
        resultsRef.current.repairFinal = result as RepairFinalResult;
        break;
    }
  }, []);

  /**
   * Run the full pipeline from step `fromIndex` to the end.
   * If fromIndex is 0 (or omitted), starts from the beginning.
   */
  const runFullPipeline = useCallback(
    async (options?: { scriptText?: string; settings?: PipelineSettings; fromIndex?: number }) => {
      if (isAutoRunning) return;

      const scriptText = options?.scriptText ?? readScriptText(projectId);
      const settings = options?.settings ?? settingsRef.current ?? DEFAULT_SETTINGS;
      const fromIndex = options?.fromIndex ?? 0;

      scriptTextRef.current = scriptText;
      settingsRef.current = settings;

      // If starting fresh, reset all steps
      if (fromIndex === 0) {
        resultsRef.current = {};
        setSteps(createInitialSteps());
      }

      setIsAutoRunning(true);

      const stepDefs = FULL_PIPELINE_STEPS;

      try {
        for (let i = fromIndex; i < stepDefs.length; i++) {
          const stepDef = stepDefs[i];
          const stageId = stepDef.id;

          // Check if this step is already done (e.g., resuming from middle)
          const currentStatus = steps[i]?.status;
          if (currentStatus === 'done') continue;

          setCurrentStepIndex(i);
          updateStep(stageId, { status: 'running', streamText: '', error: undefined });

          const controller = new AbortController();
          abortRef.current = controller;

          let body: Record<string, unknown>;
          try {
            body = buildBody(stageId, settings);
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Missing input data';
            updateStep(stageId, { status: 'error', error: message });
            throw err;
          }

          let accumulatedText = '';

          try {
            const result = await callStepSSE(
              API_ENDPOINTS[stageId],
              body,
              (token: string) => {
                accumulatedText += token;
                updateStep(stageId, { streamText: accumulatedText });
              },
              (progressData: unknown) => {
                const pd = progressData as { batchIndex?: number; totalBatches?: number; totalShotsSoFar?: number };
                if (pd.batchIndex !== undefined && pd.totalBatches !== undefined) {
                  const batchInfo = `[批次 ${pd.batchIndex + 1}/${pd.totalBatches}] 已完成 ${pd.totalShotsSoFar ?? '?'} 个镜头\n`;
                  accumulatedText += batchInfo;
                  updateStep(stageId, { streamText: accumulatedText });
                }
              },
              controller.signal,
            );

            // Store result in memory
            storeResult(stageId, result);

            // Save to localStorage for cross-page access
            writeStepOutput(projectId, stepDef.stepNumber, result);

            updateStep(stageId, { status: 'done', result, streamText: accumulatedText });
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            updateStep(stageId, { status: 'error', error: message, streamText: accumulatedText });
            throw err; // Stop the pipeline
          }
        }
      } catch {
        // Error already captured in step state — pipeline stops here
      } finally {
        setIsAutoRunning(false);
        setCurrentStepIndex(-1);
        abortRef.current = null;
      }
    },
    [isAutoRunning, projectId, buildBody, storeResult, updateStep, steps],
  );

  /**
   * Run from the current step page's context.
   * Finds the first idle step and runs from there to the end.
   */
  const runFromCurrentStep = useCallback(
    async (options?: { scriptText?: string; settings?: PipelineSettings }) => {
      // Find first non-done step
      const firstIdleIdx = steps.findIndex((s) => s.status === 'idle' || s.status === 'error');
      const fromIndex = firstIdleIdx >= 0 ? firstIdleIdx : 0;
      await runFullPipeline({ ...options, fromIndex });
    },
    [steps, runFullPipeline],
  );

  const abort = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setSteps((prev) =>
      prev.map((step) =>
        step.status === 'running'
          ? { ...step, status: 'error', error: '用户取消' }
          : step,
      ),
    );
    setIsAutoRunning(false);
    setCurrentStepIndex(-1);
  }, []);

  const updateSettings = useCallback((settings: PipelineSettings) => {
    settingsRef.current = settings;
  }, []);

  return {
    steps,
    isAutoRunning,
    currentStepIndex,
    runFullPipeline,
    runFromCurrentStep,
    abort,
    updateSettings,
  };
}
