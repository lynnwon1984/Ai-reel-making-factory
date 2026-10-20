import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { PipelineSettings, PurifiedScript, ScriptAnalysis, DiagnosisResult } from '../../src/lib/types.ts';
import { callDeepSeekStream, createSSE, parseBody, parseJSONResponse, sendError } from './utils.ts';
import { getEffectivePrompt } from './defaultPrompts.ts';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    sendError(res, 405, 'Method not allowed');
    return;
  }

  const body = parseBody<{
    purifiedScript: PurifiedScript;
    analysis: ScriptAnalysis;
    settings: PipelineSettings;
    customPrompt?: string;
  }>(req);

  if (!body || !body.purifiedScript || !body.analysis) {
    sendError(res, 400, 'Missing purifiedScript or analysis');
    return;
  }

  const { purifiedScript, analysis, settings, customPrompt } = body;
  const sse = createSSE(res);

  try {
    const systemPrompt = getEffectivePrompt('diagnose', customPrompt);

    const scriptText = purifiedScript.fullText || JSON.stringify(purifiedScript);
    const analysisText = JSON.stringify(analysis, null, 2);

    const userMessage = `请基于以下剧本分析结果，诊断剧本中的问题。

## 分析结果
${analysisText}

## 原始剧本
${scriptText}`;

    const temperature = settings?.temperature ?? 0.3;
    const maxTokens = settings?.maxTokens ?? 16384;

    const fullText = await callDeepSeekStream(
      systemPrompt,
      userMessage,
      temperature,
      maxTokens,
      (token) => sse.sendToken(token),
      { type: 'json_object' },
    );

    const result = parseJSONResponse<DiagnosisResult>(fullText);
    sse.sendDone(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    sse.sendError(message);
  }
}
