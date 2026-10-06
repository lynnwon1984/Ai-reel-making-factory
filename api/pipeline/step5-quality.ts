import type { VercelRequest, VercelResponse } from '@vercel/node';
import type {
  PipelineSettings,
  Shot,
  ScriptAnalysis,
  SeedancePrompt,
  QualityReport,
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
    shots: Shot[];
    analysis: ScriptAnalysis;
    seedancePrompts: SeedancePrompt[];
    settings: PipelineSettings;
    customPrompt?: string;
  }>(req);

  if (!body || !body.shots || !body.analysis || !body.seedancePrompts) {
    sendError(res, 400, 'Missing shots, analysis, or seedancePrompts');
    return;
  }

  const { shots, analysis, seedancePrompts, settings, customPrompt } = body;
  const sse = createSSE(res);

  try {
    const effectivePrompt = getEffectivePrompt('quality_check', customPrompt);

    const context = {
      shots: JSON.stringify(shots),
      analysis: JSON.stringify(analysis),
      seedancePrompts: JSON.stringify(seedancePrompts),
    };
    const { rendered: renderedPrompt, missingVars } = renderPrompt(effectivePrompt, context);

    if (missingVars.length > 0) {
      console.warn('step5-quality: Missing variables in prompt:', missingVars);
    }

    const userMessage = `请对以下分镜输出进行全面质检：

## 分镜数据（${shots.length} 个镜头）
${JSON.stringify(shots.slice(0, 50), null, 2)}
${shots.length > 50 ? `\n... 共 ${shots.length} 个镜头，以上展示前 50 个` : ''}

## Seedance Prompts（${seedancePrompts.length} 个）
${JSON.stringify(seedancePrompts.slice(0, 30), null, 2)}
${seedancePrompts.length > 30 ? `\n... 共 ${seedancePrompts.length} 个 prompt，以上展示前 30 个` : ''}

## 分析数据
${JSON.stringify(analysis, null, 2)}`;

    const temperature = settings?.temperature ?? 0.3;
    const maxTokens = settings?.maxTokens ?? 8192;

    const fullText = await callDeepSeekStream(
      renderedPrompt,
      userMessage,
      temperature,
      maxTokens,
      (token) => sse.sendToken(token),
    );

    const result = parseJSONResponse<QualityReport>(fullText);
    sse.sendDone(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    sse.sendError(message);
  }
}
