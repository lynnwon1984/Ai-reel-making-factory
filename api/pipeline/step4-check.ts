import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { PipelineSettings, SeedancePrompt } from '../../src/lib/types.ts';
import { callDeepSeekStream, createSSE, parseBody, parseJSONResponse, sendError } from './utils.ts';
import { renderPrompt } from './promptRenderer.ts';
import { getEffectivePrompt } from './defaultPrompts.ts';

export interface PromptgenCheckResult {
  totalPrompts: number;
  formatCompliance: number;
  issues: {
    shotNumber: number;
    type: '格式违规' | '内容问题' | '完整性缺失' | '可执行性问题';
    severity: '严重' | '中等' | '轻微';
    description: string;
    suggestion: string;
  }[];
  score: number;
  summary: string;
}

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
    seedancePrompts: SeedancePrompt[];
    settings: PipelineSettings;
    customPrompt?: string;
  }>(req);

  if (!body || !body.seedancePrompts) {
    sendError(res, 400, 'Missing seedancePrompts');
    return;
  }

  const { seedancePrompts, settings, customPrompt } = body;
  const sse = createSSE(res);

  try {
    const effectivePrompt = getEffectivePrompt('promptgen_check', customPrompt);

    const context = {
      seedancePrompts: JSON.stringify(seedancePrompts),
      targetVersion: settings?.targetSeedanceVersion || '2.5',
    };
    const { rendered: renderedPrompt, missingVars } = renderPrompt(effectivePrompt, context);

    if (missingVars.length > 0) {
      console.warn('step4-check: Missing variables in prompt:', missingVars);
    }

    const userMessage = `请对以下 ${seedancePrompts.length} 个 Seedance Prompt 进行合规检查（目标版本：${settings?.targetSeedanceVersion || '2.5'}）：\n\n${JSON.stringify(seedancePrompts, null, 2)}`;

    const temperature = settings?.temperature ?? 0.3;
    const maxTokens = settings?.maxTokens ?? 8192;

    const fullText = await callDeepSeekStream(
      renderedPrompt,
      userMessage,
      temperature,
      maxTokens,
      (token) => sse.sendToken(token),
    );

    const result = parseJSONResponse<PromptgenCheckResult>(fullText);
    sse.sendDone(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    sse.sendError(message);
  }
}
