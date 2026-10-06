import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { PipelineSettings, Shot, ScriptAnalysis, SeedancePrompt } from '../../src/lib/types.ts';
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
    shots: Shot[];
    analysis: ScriptAnalysis;
    settings: PipelineSettings;
    customPrompt?: string;
  }>(req);

  if (!body || !body.shots || !body.analysis) {
    sendError(res, 400, 'Missing shots or analysis');
    return;
  }

  const { shots, analysis, settings, customPrompt } = body;
  const sse = createSSE(res);

  try {
    const effectivePrompt = getEffectivePrompt('prompt_gen', customPrompt);
    const targetVersion = settings?.targetSeedanceVersion || '2.5';

    const context = {
      shots: JSON.stringify(shots),
      analysis: JSON.stringify(analysis),
      targetVersion,
    };
    const { rendered: renderedPrompt, missingVars } = renderPrompt(effectivePrompt, context);

    if (missingVars.length > 0) {
      console.warn('step4-prompt-gen: Missing variables in prompt:', missingVars);
    }

    const userMessage = `请为以下 ${shots.length} 个镜头生成 Seedance ${targetVersion} 格式的 prompt，输出 SeedancePrompt[] JSON：\n\n镜头数据：\n${JSON.stringify(shots, null, 2)}`;

    const temperature = settings?.temperature ?? 0.3;
    const maxTokens = settings?.maxTokens ?? 8192;

    const fullText = await callDeepSeekStream(
      renderedPrompt,
      userMessage,
      temperature,
      maxTokens,
      (token) => sse.sendToken(token),
    );

    const result = parseJSONResponse<SeedancePrompt[]>(fullText);
    sse.sendDone(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    sse.sendError(message);
  }
}
