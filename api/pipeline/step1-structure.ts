import type { VercelRequest, VercelResponse } from '@vercel/node';
import type {
  PipelineSettings,
  PurifiedScript,
  StructuredScript,
} from '../../src/lib/types.ts';
import { callDeepSeekStream, createSSE, parseBody, parseJSONResponse, sendError } from './utils.ts';
import { renderPrompt } from './promptRenderer.ts';
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
    settings: PipelineSettings;
    customPrompt?: string;
  }>(req);

  if (!body || !body.purifiedScript) {
    sendError(res, 400, 'Missing purifiedScript');
    return;
  }

  const { purifiedScript, settings, customPrompt } = body;
  const sse = createSSE(res);

  try {
    const effectivePrompt = getEffectivePrompt('structure', customPrompt);
    const temperature = settings?.temperature ?? 0.3;
    const maxTokens = settings?.maxTokens ?? 16384;

    const fullText = purifiedScript.fullText || '';
    const sceneIndex = purifiedScript.sceneIndex || [];
    const characterNames = purifiedScript.characterNames || [];

    const context = {
      purifiedScript: fullText,
      sceneIndex: JSON.stringify(sceneIndex),
      characterNames: JSON.stringify(characterNames),
    };

    const { rendered: renderedPrompt, missingVars } = renderPrompt(effectivePrompt, context);

    if (missingVars.length > 0) {
      console.warn('step1-structure: Missing variables:', missingVars);
    }

    const userMessage = `请对以下净化后的剧本进行结构化提取与标注，输出 StructuredScript JSON（包含 scenes 数组和 globalNotes）：\n\n剧本文本：\n${fullText}`;

    const aiResponse = await callDeepSeekStream(
      renderedPrompt,
      userMessage,
      temperature,
      maxTokens,
      (token) => sse.sendToken(token),
      { type: 'json_object' },
    );

    const result = parseJSONResponse<StructuredScript>(aiResponse);
    sse.sendDone(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    sse.sendError(message);
  }
}
