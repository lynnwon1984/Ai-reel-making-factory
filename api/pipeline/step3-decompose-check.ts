import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { PipelineSettings, Shot, ScriptAnalysis } from '../../src/lib/types.ts';
import { callDeepSeekStream, createSSE, parseBody, parseJSONResponse, sendError } from './utils.ts';
import { getEffectivePrompt } from './defaultPrompts.ts';

export interface DecomposeCheckResult {
  totalShots: number;
  totalDuration: number;
  issues: {
    shotNumber: number;
    type: '镜头完整性' | '运镜合规性' | '景别合理性' | '音频标记' | '时长合理性';
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
    const effectivePrompt = getEffectivePrompt('decompose_check', customPrompt);

    const temperature = settings?.temperature ?? 0.3;
    const maxTokens = settings?.maxTokens ?? 16384;

    const totalDuration = shots.reduce((sum, s) => sum + (s.estimatedDuration || 0), 0);

    const userMessage = `请对以下 ${shots.length} 个分镜镜头进行质检（总时长约 ${totalDuration.toFixed(1)} 秒）：

分析数据（角色、场景、风格等）：
${JSON.stringify(analysis, null, 2)}

镜头列表：
${JSON.stringify(shots, null, 2)}`;

    const fullText = await callDeepSeekStream(
      effectivePrompt,
      userMessage,
      temperature,
      maxTokens,
      (token) => sse.sendToken(token),
      { type: 'json_object' },
    );

    const result = parseJSONResponse<DecomposeCheckResult>(fullText);
    sse.sendDone(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    sse.sendError(message);
  }
}
