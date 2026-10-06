import { useState, useCallback, useRef } from 'react';
import type {
  StageId,
  PipelineStepState,
  PipelineSettings,
  PurifiedScript,
  ScriptAnalysis,
  Shot,
  SeedancePrompt,
  QualityReport,
  Storyboard,
  DiagnosisResult,
  RepairResult,
  RepairFinalResult,
} from '../lib/types';
import { PIPELINE_STEPS, DEFAULT_SETTINGS } from '../lib/constants';

const API_ENDPOINTS: Record<StageId, string> = {
  audit: '/api/pipeline/step1-audit',
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

function createInitialSteps(): PipelineStepState[] {
  return PIPELINE_STEPS.map((s) => ({
    id: s.id,
    name: s.name,
    status: 'idle' as const,
    streamText: '',
    result: undefined,
    error: undefined,
    customPrompt: undefined,
  }));
}

/** SSE streaming call — handles token, progress, done, error events */
async function callStepSSE(
  endpoint: string,
  body: Record<string, unknown>,
  onToken: (token: string) => void,
  onProgress?: (data: unknown) => void,
  signal?: AbortSignal,
): Promise<unknown> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`API error ${response.status}: ${errText}`);
  }

  if (!response.body) {
    throw new Error('No response body');
  }

  return new Promise<unknown>((resolve, reject) => {
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    const abortHandler = () => {
      reader.cancel().catch(() => {});
      reject(new Error('Operation cancelled'));
    };
    if (signal) {
      signal.addEventListener('abort', abortHandler, { once: true });
    }

    const cleanup = () => {
      if (signal) {
        signal.removeEventListener('abort', abortHandler);
      }
    };

    function pump(): void {
      reader.read().then(({ done, value }) => {
        if (done) {
          cleanup();
          reject(new Error('Stream ended without completion'));
          return;
        }

        buffer += decoder.decode(value, { stream: true });

        // Check for done event
        const doneIdx = buffer.indexOf('event: done');
        if (doneIdx !== -1) {
          const afterDone = buffer.slice(doneIdx);
          const dataMatch = afterDone.match(/data:\s*(.+)/);
          if (dataMatch) {
            try {
              const result = JSON.parse(dataMatch[1]);
              cleanup();
              resolve(result);
              return;
            } catch {
              // continue
            }
          }
        }

        // Check for error event
        const errorIdx = buffer.indexOf('event: error');
        if (errorIdx !== -1) {
          const afterError = buffer.slice(errorIdx);
          const dataMatch = afterError.match(/data:\s*(.+)/);
          if (dataMatch) {
            try {
              const errData = JSON.parse(dataMatch[1]) as { error: string };
              cleanup();
              reject(new Error(errData.error || 'Unknown API error'));
              return;
            } catch {
              // continue
            }
          }
        }

        // Check for progress events (step3 batching)
        const progressIdx = buffer.indexOf('event: progress');
        if (progressIdx !== -1) {
          const afterProgress = buffer.slice(progressIdx);
          const dataMatch = afterProgress.match(/data:\s*(.+)/);
          if (dataMatch) {
            try {
              const progressData = JSON.parse(dataMatch[1]);
              onProgress?.(progressData);
              // Remove processed progress event from buffer
              const endOfData = afterProgress.indexOf('\n\n');
              if (endOfData !== -1) {
                buffer = buffer.slice(0, progressIdx) + afterProgress.slice(endOfData + 2);
              }
            } catch {
              // skip malformed progress
            }
          }
        }

        // Process token lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          if (trimmed.startsWith('data: ')) {
            try {
              const parsed = JSON.parse(trimmed.slice(6)) as { token?: string };
              if (parsed.token) {
                onToken(parsed.token);
              }
            } catch {
              // skip malformed data lines
            }
          }
        }

        pump();
      }).catch((err) => {
        cleanup();
        reject(err);
      });
    }

    pump();
  });
}

export interface PipelineResults {
  purifiedScript?: PurifiedScript;
  analysis?: ScriptAnalysis;
  diagnosis?: DiagnosisResult;
  repair?: RepairResult;
  shots?: Shot[];
  seedancePrompts?: SeedancePrompt[];
  qualityReport?: QualityReport;
  repairFinal?: RepairFinalResult;
}

export function usePipeline() {
  const [steps, setSteps] = useState<PipelineStepState[]>(createInitialSteps);
  const [isRunning, setIsRunning] = useState(false);
  const [storyboard, setStoryboard] = useState<Storyboard | null>(null);
  const resultsRef = useRef<PipelineResults>({});
  const scriptTextRef = useRef<string>('');
  const settingsRef = useRef<PipelineSettings>(DEFAULT_SETTINGS);
  const abortRef = useRef<AbortController | null>(null);

  const updateStep = useCallback((stepId: StageId, updates: Partial<PipelineStepState>) => {
    setSteps((prev) =>
      prev.map((step) => (step.id === stepId ? { ...step, ...updates } : step)),
    );
  }, []);

  const getCustomPrompt = useCallback((stageId: StageId): string | undefined => {
    const cp = settingsRef.current.customPrompts;
    return cp?.[stageId] || undefined;
  }, []);

  const executeStep = useCallback(
    async (stageId: StageId): Promise<unknown> => {
      const endpoint = API_ENDPOINTS[stageId];
      if (!endpoint) throw new Error(`Unknown stage: ${stageId}`);

      updateStep(stageId, { status: 'running', streamText: '', error: undefined });

      const results = resultsRef.current;
      const settings = settingsRef.current;
      const customPrompt = getCustomPrompt(stageId);

      let body: Record<string, unknown>;

      switch (stageId) {
        case 'audit':
          body = { scriptText: scriptTextRef.current, settings, customPrompt };
          break;
        case 'analyze':
          if (!results.purifiedScript) throw new Error('Missing purifiedScript from audit step');
          body = { purifiedScript: results.purifiedScript, settings, customPrompt };
          break;
        case 'decompose':
          if (!results.purifiedScript || !results.analysis) throw new Error('Missing data from previous steps');
          body = { purifiedScript: results.purifiedScript, analysis: results.analysis, settings, customPrompt };
          break;
        case 'prompt_gen':
          if (!results.shots || !results.analysis) throw new Error('Missing data from previous steps');
          body = { shots: results.shots, analysis: results.analysis, settings, customPrompt };
          break;
        case 'quality_check':
          if (!results.shots || !results.analysis || !results.seedancePrompts)
            throw new Error('Missing data from previous steps');
          body = {
            shots: results.shots,
            analysis: results.analysis,
            seedancePrompts: results.seedancePrompts,
            settings,
            customPrompt,
          };
          break;
        case 'decompose_check':
          if (!results.shots || !results.analysis) throw new Error('Missing data from previous steps');
          body = { shots: results.shots, analysis: results.analysis, settings, customPrompt };
          break;
        case 'promptgen_check':
          if (!results.seedancePrompts) throw new Error('Missing data from previous steps');
          body = { seedancePrompts: results.seedancePrompts, settings, customPrompt };
          break;
        case 'repair_final':
          if (!results.shots || !results.analysis || !results.qualityReport)
            throw new Error('Missing data from previous steps');
          body = {
            shots: results.shots,
            analysis: results.analysis,
            qualityReport: results.qualityReport,
            settings,
            customPrompt,
          };
          break;
        default:
          throw new Error(`Unknown stage: ${stageId}`);
      }

      const controller = new AbortController();
      abortRef.current = controller;

      let accumulatedText = '';

      try {
        const result = await callStepSSE(
          endpoint,
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

        // Store result
        switch (stageId) {
          case 'audit':
            resultsRef.current.purifiedScript = result as PurifiedScript;
            break;
          case 'analyze':
            resultsRef.current.analysis = result as ScriptAnalysis;
            break;
          case 'decompose': {
            const decomposeResult = result as { shots: Shot[]; totalBatches: number };
            resultsRef.current.shots = decomposeResult.shots;
            break;
          }
          case 'prompt_gen':
            resultsRef.current.seedancePrompts = result as SeedancePrompt[];
            break;
          case 'quality_check':
            resultsRef.current.qualityReport = result as QualityReport;
            break;
          case 'repair_final':
            resultsRef.current.repairFinal = result as RepairFinalResult;
            break;
        }

        updateStep(stageId, { status: 'done', result, streamText: accumulatedText });
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        updateStep(stageId, { status: 'error', error: message, streamText: accumulatedText });
        throw err;
      }
    },
    [updateStep, getCustomPrompt],
  );

  // Assemble final storyboard from all results
  const assembleStoryboard = useCallback(() => {
    const r = resultsRef.current;
    if (r.purifiedScript && r.analysis && r.shots && r.seedancePrompts && r.qualityReport) {
      const sb: Storyboard = {
        purifiedScript: r.purifiedScript,
        analysis: r.analysis,
        shots: r.shots,
        seedancePrompts: r.seedancePrompts,
        qualityReport: r.qualityReport,
        metadata: {
          title: '未命名分镜',
          createdAt: new Date().toISOString(),
          seedanceVersion: settingsRef.current.targetSeedanceVersion || '2.5',
          totalBatches: Math.ceil(r.purifiedScript.totalScenes / (settingsRef.current.batchSize || 3)),
        },
      };
      setStoryboard(sb);
    }
  }, []);

  // Only execute first step (audit), then pause
  const startPipeline = useCallback(
    async (scriptText: string, settings?: PipelineSettings) => {
      scriptTextRef.current = scriptText;
      settingsRef.current = settings ?? DEFAULT_SETTINGS;
      resultsRef.current = {};
      setStoryboard(null);
      setSteps(createInitialSteps());
      setIsRunning(true);

      try {
        await executeStep('audit');
      } catch {
        // Error captured in step state
      } finally {
        setIsRunning(false);
      }
    },
    [executeStep],
  );

  // Execute next idle step, then pause
  const continueStep = useCallback(async () => {
    if (isRunning) return;

    const stepOrder: StageId[] = ['audit', 'analyze', 'decompose', 'prompt_gen', 'quality_check'];
    const nextStep = steps.find((s) => s.status === 'idle');
    if (!nextStep) return; // All steps done

    setIsRunning(true);
    try {
      await executeStep(nextStep.id);

      // If this was the last step, assemble storyboard
      const allDone = stepOrder.every((id) => {
        if (id === nextStep.id) return true; // current step just finished
        const step = steps.find((s) => s.id === id);
        return step?.status === 'done';
      });

      if (allDone && nextStep.id === 'quality_check') {
        assembleStoryboard();
      }
    } catch {
      // Error captured in step state
    } finally {
      setIsRunning(false);
    }
  }, [isRunning, steps, executeStep, assembleStoryboard]);

  // Execute all remaining steps to completion
  const continueAll = useCallback(async () => {
    if (isRunning) return;

    const stepOrder: StageId[] = ['audit', 'analyze', 'decompose', 'prompt_gen', 'quality_check'];
    const remainingSteps = stepOrder.filter((id) => {
      const step = steps.find((s) => s.id === id);
      return step?.status === 'idle';
    });

    if (remainingSteps.length === 0) return;

    setIsRunning(true);
    try {
      for (const stepId of remainingSteps) {
        await executeStep(stepId);
      }
      assembleStoryboard();
    } catch {
      // Error captured in step state
    } finally {
      setIsRunning(false);
    }
  }, [isRunning, steps, executeStep, assembleStoryboard]);

  // Retry: auto-execute remaining steps (user confirmed retry)
  const retryStep = useCallback(
    async (stepIndex: number, newScriptText?: string) => {
      if (isRunning) return;

      const stepOrder: StageId[] = ['audit', 'analyze', 'decompose', 'prompt_gen', 'quality_check'];

      if (newScriptText !== undefined) {
        scriptTextRef.current = newScriptText;
      }

      // Reset this step and all subsequent steps
      setSteps((prev) =>
        prev.map((step, i) =>
          i >= stepIndex
            ? { ...step, status: 'idle' as const, result: undefined, error: undefined, streamText: '' }
            : step,
        ),
      );

      // Clear results from this step onward
      const results = resultsRef.current;
      if (stepIndex <= 0) {
        results.purifiedScript = undefined;
        results.analysis = undefined;
        results.diagnosis = undefined;
        results.repair = undefined;
        results.shots = undefined;
        results.seedancePrompts = undefined;
        results.qualityReport = undefined;
      } else if (stepIndex <= 1) {
        results.analysis = undefined;
        results.diagnosis = undefined;
        results.repair = undefined;
        results.shots = undefined;
        results.seedancePrompts = undefined;
        results.qualityReport = undefined;
      } else if (stepIndex <= 2) {
        results.diagnosis = undefined;
        results.repair = undefined;
        results.shots = undefined;
        results.seedancePrompts = undefined;
        results.qualityReport = undefined;
      } else if (stepIndex <= 3) {
        results.repair = undefined;
        results.shots = undefined;
        results.seedancePrompts = undefined;
        results.qualityReport = undefined;
      } else if (stepIndex <= 4) {
        results.shots = undefined;
        results.seedancePrompts = undefined;
        results.qualityReport = undefined;
      } else if (stepIndex <= 5) {
        results.seedancePrompts = undefined;
        results.qualityReport = undefined;
      } else {
        results.qualityReport = undefined;
      }

      if (stepIndex >= 6) {
        setStoryboard(null);
      }

      setIsRunning(true);

      try {
        for (let i = stepIndex; i < stepOrder.length; i++) {
          await executeStep(stepOrder[i]);
        }
        assembleStoryboard();
      } catch {
        // Error already captured in step state
      } finally {
        setIsRunning(false);
      }
    },
    [isRunning, executeStep, assembleStoryboard],
  );

  const abort = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setSteps(prev => prev.map(step =>
      step.status === 'running'
        ? { ...step, status: 'error', error: '用户取消' }
        : step
    ));
    setIsRunning(false);
  }, []);

  const updateSettings = useCallback((settings: PipelineSettings) => {
    settingsRef.current = settings;
  }, []);

  const setScriptText = useCallback((text: string) => {
    scriptTextRef.current = text;
  }, []);

  const setPrevResults = useCallback((results: Partial<PipelineResults>) => {
    resultsRef.current = { ...resultsRef.current, ...results };
  }, []);

  return {
    steps,
    isRunning,
    storyboard,
    startPipeline,
    continueStep,
    continueAll,
    retryStep,
    abort,
    updateSettings,
    settingsRef,
    setScriptText,
    setPrevResults,
    executeStep,
  };
}
