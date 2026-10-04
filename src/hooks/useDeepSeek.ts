import { useCallback, useRef } from 'react';
import type { PipelineSettings } from '../lib/types';

interface StreamCallbacks {
  onChunk: (text: string) => void;
  onComplete: (fullText: string) => void;
  onError: (error: string) => void;
}

export function useDeepSeek() {
  const abortRef = useRef<AbortController | null>(null);

  const callPipelineStep = useCallback(
    async (step: number, body: object, settings?: PipelineSettings, callbacks?: StreamCallbacks) => {
      // Abort previous request if any
      if (abortRef.current) {
        abortRef.current.abort();
      }
      abortRef.current = new AbortController();

      try {
        const response = await fetch(`/api/pipeline/step-${step}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...body, settings }),
          signal: abortRef.current.signal,
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`API Error ${response.status}: ${errText}`);
        }

        // Handle SSE stream
        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let fullText = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;
              try {
                const parsed = JSON.parse(data);
                const content = parsed.token || '';
                if (content) {
                  fullText += content;
                  callbacks?.onChunk(fullText);
                }
              } catch {
                // Non-JSON line, treat as raw text
                fullText += data;
                callbacks?.onChunk(fullText);
              }
            }
          }
        }

        callbacks?.onComplete(fullText);
        return fullText;
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return '';
        const message = err instanceof Error ? err.message : 'Unknown error';
        callbacks?.onError(message);
        throw err;
      }
    },
    []
  );

  const abort = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  return { callPipelineStep, abort };
}
