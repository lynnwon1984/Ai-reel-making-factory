import { useCallback } from 'react';

export interface StepData {
  stepNumber: number;
  timestamp: number;
  data: unknown;
  inputSource: 'inherited' | 'uploaded';
}

function storageKey(projectId: string, stepNumber: number, type: 'input' | 'output') {
  return `project-${projectId}-step${stepNumber}-${type}`;
}

export function useStepData(projectId: string) {
  const getStepInput = useCallback(
    (stepNumber: number): StepData | null => {
      const inherited = getInheritedInput(stepNumber);
      if (inherited) return inherited;
      try {
        const raw = localStorage.getItem(storageKey(projectId, stepNumber, 'input'));
        if (raw) return JSON.parse(raw);
      } catch { /* ignore */ }
      return null;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projectId],
  );

  const getStepOutput = useCallback(
    (stepNumber: number): StepData | null => {
      try {
        const raw = localStorage.getItem(storageKey(projectId, stepNumber, 'output'));
        if (raw) return JSON.parse(raw);
      } catch { /* ignore */ }
      return null;
    },
    [projectId],
  );

  const saveStepOutput = useCallback(
    (stepNumber: number, data: unknown) => {
      const entry: StepData = {
        stepNumber,
        timestamp: Date.now(),
        data,
        inputSource: 'inherited',
      };
      localStorage.setItem(storageKey(projectId, stepNumber, 'output'), JSON.stringify(entry));
    },
    [projectId],
  );

  const getInheritedInput = useCallback(
    (stepNumber: number): StepData | null => {
      if (stepNumber <= 1) return null;
      const prevOutput = getStepOutput(stepNumber - 1);
      if (prevOutput) {
        return {
          stepNumber,
          timestamp: prevOutput.timestamp,
          data: prevOutput.data,
          inputSource: 'inherited',
        };
      }
      return null;
    },
    [getStepOutput],
  );

  const setManualInput = useCallback(
    (stepNumber: number, data: unknown) => {
      const entry: StepData = {
        stepNumber,
        timestamp: Date.now(),
        data,
        inputSource: 'uploaded',
      };
      localStorage.setItem(storageKey(projectId, stepNumber, 'input'), JSON.stringify(entry));
    },
    [projectId],
  );

  const clearStepData = useCallback(
    (stepNumber: number) => {
      localStorage.removeItem(storageKey(projectId, stepNumber, 'input'));
      localStorage.removeItem(storageKey(projectId, stepNumber, 'output'));
    },
    [projectId],
  );

  return {
    getStepInput,
    getStepOutput,
    saveStepOutput,
    getInheritedInput,
    setManualInput,
    clearStepData,
  };
}
