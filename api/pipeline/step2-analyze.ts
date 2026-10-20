import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { PipelineSettings, PurifiedScript, ScriptAnalysis } from '../../src/lib/types.ts';
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

  const body = parseBody<{ purifiedScript: PurifiedScript; settings: PipelineSettings; customPrompt?: string }>(req);
  if (!body || !body.purifiedScript) {
    sendError(res, 400, 'Missing purifiedScript');
    return;
  }

  const { purifiedScript, settings, customPrompt } = body;
  const sse = createSSE(res);

  try {
    const systemPrompt = getEffectivePrompt('analyze', customPrompt);

    const scriptContent = purifiedScript.fullText || JSON.stringify(purifiedScript, null, 2);
    const userMessage = `请对以下净化后的剧本进行深度分析，输出 ScriptAnalysis JSON：\n\n${scriptContent}`;

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

    const result = parseJSONResponse<ScriptAnalysis>(fullText);
    sse.sendDone(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    sse.sendError(message);
  }
}
