import { useState, useCallback, useRef } from 'react';
import type {
  PipelineStep,
  PipelineSettings,
  ScriptAnalysis,
  Scene,
  Shot,
  Storyboard,
} from '../lib/types';
import { PIPELINE_STEPS, DEFAULT_SETTINGS } from '../lib/constants';

const API_ENDPOINTS = [
  '/api/pipeline/step1-analyze',
  '/api/pipeline/step2-scene-break',
  '/api/pipeline/step3-shot-decompose',
  '/api/pipeline/step4-format',
];

const MAX_RETRIES = 2;

/** Internal step type with streaming text support */
interface StepState extends PipelineStep {
  streamText?: string;
}

interface StepResult {
  analysis?: ScriptAnalysis;
  scenes?: Scene[];
  shots?: Shot[];
  storyboard?: Storyboard;
}

function createInitialSteps(): StepState[] {
  return PIPELINE_STEPS.map((s) => ({
    ...s,
    status: 'idle' as const,
    output: undefined,
    error: undefined,
    streamText: undefined,
  }));
}

async function callStepSSE(
  endpoint: string,
  body: Record<string, unknown>,
  onToken: (token: string) => void,
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

    // Warning 5 fix: use { once: true } and clean up on settle
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

        // Critical 1 fix: detect done/error events BEFORE for-loop consumes lines
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

export function usePipeline() {
  const [steps, setSteps] = useState<StepState[]>(createInitialSteps);
  const [isRunning, setIsRunning] = useState(false);
  const [storyboard, setStoryboard] = useState<Storyboard | null>(null);
  const resultsRef = useRef<StepResult>({});
  const scriptTextRef = useRef<string>('');
  const settingsRef = useRef<PipelineSettings>(DEFAULT_SETTINGS);
  const abortRef = useRef<AbortController | null>(null);

  const updateStep = useCallback((stepIndex: number, updates: Partial<StepState>) => {
    setSteps((prev) =>
      prev.map((step, i) => (i === stepIndex ? { ...step, ...updates } : step)),
    );
  }, []);

  const executeStep = useCallback(
    async (stepIndex: number, retries = 0): Promise<void> => {
      const endpoint = API_ENDPOINTS[stepIndex];
      if (!endpoint) throw new Error(`Invalid step index: ${stepIndex}`);

      updateStep(stepIndex, { status: 'running', error: undefined, streamText: '' });

      const results = resultsRef.current;
      const settings = settingsRef.current;
      let body: Record<string, unknown>;

      switch (stepIndex) {
        case 0:
          body = { scriptText: scriptTextRef.current, settings };
          break;
        case 1:
          if (!results.analysis) throw new Error('Missing analysis from step 1');
          body = { scriptText: scriptTextRef.current, analysis: results.analysis, settings };
          break;
        case 2:
          if (!results.scenes || !results.analysis) throw new Error('Missing data from previous steps');
          body = { scenes: results.scenes, analysis: results.analysis, settings };
          break;
        case 3:
          if (!results.shots || !results.scenes || !results.analysis)
            throw new Error('Missing data from previous steps');
          body = { shots: results.shots, scenes: results.scenes, analysis: results.analysis, settings };
          break;
        default:
          throw new Error(`Unknown step: ${stepIndex}`);
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
            updateStep(stepIndex, { streamText: accumulatedText });
          },
          controller.signal,
        );

        switch (stepIndex) {
          case 0:
            resultsRef.current.analysis = result as ScriptAnalysis;
            break;
          case 1:
            resultsRef.current.scenes = result as Scene[];
            break;
          case 2:
            resultsRef.current.shots = result as Shot[];
            break;
          case 3:
            resultsRef.current.storyboard = result as Storyboard;
            setStoryboard(result as Storyboard);
            break;
        }

        updateStep(stepIndex, { status: 'done', output: result });
      } catch (err) {
        if (err instanceof Error && err.message === 'Operation cancelled') return;

        const message = err instanceof Error ? err.message : 'Unknown error';

        if (retries < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, 1000 * (retries + 1)));
          return executeStep(stepIndex, retries + 1);
        }

        updateStep(stepIndex, { status: 'error', error: message });
        throw err;
      }
    },
    [updateStep],
  );

  const startPipeline = useCallback(
    async (scriptText: string, settings?: PipelineSettings) => {
      scriptTextRef.current = scriptText;
      settingsRef.current = settings ?? DEFAULT_SETTINGS;
      resultsRef.current = {};
      setStoryboard(null);
      setSteps(createInitialSteps());
      setIsRunning(true);

      try {
        for (let i = 0; i < 4; i++) {
          await executeStep(i);
        }
      } catch {
        // Error already captured in step state
      } finally {
        setIsRunning(false);
      }
    },
    [executeStep],
  );

  const executePipeline = startPipeline;

  const resetPipeline = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    resultsRef.current = {};
    scriptTextRef.current = '';
    settingsRef.current = DEFAULT_SETTINGS;
    setStoryboard(null);
    setSteps(createInitialSteps());
    setIsRunning(false);
  }, []);

  const retryStep = useCallback(
    async (stepId: number, newScriptText?: string) => {
      if (isRunning) return;

      const stepIndex = stepId - 1;

      if (newScriptText !== undefined) {
        scriptTextRef.current = newScriptText;
      }

      setIsRunning(true);

      setSteps((prev) =>
        prev.map((step, i) =>
          i >= stepIndex
            ? { ...step, status: 'idle' as const, output: undefined, error: undefined, streamText: undefined }
            : step,
        ),
      );

      const results = resultsRef.current;
      if (stepIndex <= 0) {
        results.analysis = undefined;
        results.scenes = undefined;
        results.shots = undefined;
        results.storyboard = undefined;
      } else if (stepIndex <= 1) {
        results.scenes = undefined;
        results.shots = undefined;
        results.storyboard = undefined;
      } else if (stepIndex <= 2) {
        results.shots = undefined;
        results.storyboard = undefined;
      } else {
        results.storyboard = undefined;
      }

      if (stepIndex === 3) {
        setStoryboard(null);
      }

      try {
        for (let i = stepIndex; i < 4; i++) {
          await executeStep(i);
        }
      } catch {
        // Error already captured in step state
      } finally {
        setIsRunning(false);
      }
    },
    [isRunning, executeStep],
  );

  const abort = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsRunning(false);
  }, []);

  return {
    steps,
    isRunning,
    storyboard,
    startPipeline,
    executePipeline,
    resetPipeline,
    retryStep,
    abort,
  };
}
