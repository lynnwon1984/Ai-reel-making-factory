import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { PipelineSettings, PurifiedScript } from '../../src/lib/types.ts';
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

  const body = parseBody<{ scriptText: string; settings: PipelineSettings; customPrompt?: string }>(req);
  if (!body || !body.scriptText) {
    sendError(res, 400, 'Missing scriptText');
    return;
  }

  const { scriptText, settings, customPrompt } = body;
  const sse = createSSE(res);

  try {
    const systemPrompt = getEffectivePrompt('audit', customPrompt);
    console.log(`[step1-audit] System prompt length: ${systemPrompt.length} chars`);

    const userMessage = `请对以下剧本进行审计与净化处理，输出 JSON 格式，包含 fullText（连续纯净剧本全文）、sceneIndex（轻量场景索引数组）、logicIssues（6类逻辑断链检测）、totalScenes、characterNames、auditNotes：\n\n${scriptText}`;

    const temperature = settings?.temperature ?? 0.3;
    const maxTokens = settings?.maxTokens ?? 16384;

    console.log(`[step1-audit] Calling DeepSeek with temperature=${temperature}, maxTokens=${maxTokens}`);

    const fullText = await callDeepSeekStream(
      systemPrompt,
      userMessage,
      temperature,
      maxTokens,
      (token) => sse.sendToken(token),
      { type: 'json_object' },
    );

    console.log(`[step1-audit] AI response length: ${fullText.length} chars, first 200: ${fullText.slice(0, 200)}`);

    const result = parseJSONResponse<PurifiedScript>(fullText);
    sse.sendDone(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    sse.sendError(message);
  }
}
