import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { ScriptAnalysis, PipelineSettings } from '../../src/lib/types.ts';
import { callDeepSeekStream, createSSE, parseBody, sendError } from './utils.ts';

const SYSTEM_PROMPT = `你是专业影视剧本分析师。分析用户提供的剧本，识别剧本类型（短剧/电影/广告/MV/纪录片/其他）、提取角色列表（名字、描述、角色类型）、预估场景数量、判断整体风格和情绪基调。

输出严格 JSON 格式，不要包含任何其他文字。JSON 结构如下：
{
  "scriptType": "短剧|电影|广告|MV|纪录片|其他",
  "characters": [
    { "name": "角色名", "description": "角色描述", "role": "主角|配角|群演" }
  ],
  "estimatedScenes": 数字,
  "style": "风格描述",
  "mood": "情绪基调",
  "summary": "剧本摘要"
}`;

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

  const body = parseBody<{ scriptText: string; settings: PipelineSettings }>(req);
  if (!body || !body.scriptText) {
    sendError(res, 400, 'Missing scriptText');
    return;
  }

  const { scriptText, settings } = body;
  const sse = createSSE(res);

  try {
    const effectiveSystemPrompt = settings?.customPrompt
      ? `${SYSTEM_PROMPT}\n\n附加指令：${settings.customPrompt}`
      : SYSTEM_PROMPT;

    const userPrompt = `请分析以下剧本：\n\n${scriptText}`;
    const temperature = settings?.temperature ?? 0.7;
    const maxTokens = settings?.maxTokens ?? 4096;

    const fullText = await callDeepSeekStream(
      effectiveSystemPrompt,
      userPrompt,
      temperature,
      maxTokens,
      (token) => {
        sse.sendToken(token);
      },
    );

    // Parse the accumulated text as JSON
    let analysis: ScriptAnalysis;
    try {
      // Try to extract JSON from the response (handle markdown code blocks)
      const jsonMatch = fullText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]) as ScriptAnalysis;
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseErr) {
      sse.sendError(`Failed to parse analysis result: ${parseErr}`);
      return;
    }

    sse.sendDone(analysis);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    sse.sendError(message);
  }
}
