import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { ScriptAnalysis, Scene, PipelineSettings } from '../../src/lib/types.ts';
import { callDeepSeekStream, createSSE, parseBody, sendError } from './utils.ts';

const SYSTEM_PROMPT = `你是专业的分镜师。根据剧本和分析结果，将剧本按场景拆分。每个场景包含：
- sceneNumber：场景编号（从1开始）
- location：地点
- time：时间（日/夜/晨/黄昏）
- characters：在场角色名字数组
- summary：场景概要
- scriptContent：该场景的原始剧本文本

输出严格 JSON 数组格式，不要包含任何其他文字。示例：
[
  {
    "sceneNumber": 1,
    "location": "咖啡厅",
    "time": "日",
    "characters": ["小明", "小红"],
    "summary": "两人在咖啡厅初次见面",
    "scriptContent": "原始剧本内容..."
  }
]`;

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
    scriptText: string;
    analysis: ScriptAnalysis;
    settings: PipelineSettings;
  }>(req);

  if (!body || !body.scriptText || !body.analysis) {
    sendError(res, 400, 'Missing scriptText or analysis');
    return;
  }

  const { scriptText, analysis, settings } = body;
  const sse = createSSE(res);

  try {
    const effectiveSystemPrompt = settings?.customPrompt
      ? `${SYSTEM_PROMPT}\n\n附加指令：${settings.customPrompt}`
      : SYSTEM_PROMPT;

    const userPrompt = `剧本内容：
${scriptText}

剧本分析结果：
- 类型：${analysis.scriptType}
- 角色：${analysis.characters.map((c) => c.name).join('、')}
- 预估场景数：${analysis.estimatedScenes}
- 风格：${analysis.style}
- 情绪基调：${analysis.mood}

请根据以上信息进行场景拆分。`;

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

    let scenes: Scene[];
    try {
      const jsonMatch = fullText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        scenes = JSON.parse(jsonMatch[0]) as Scene[];
      } else {
        throw new Error('No JSON array found in response');
      }
    } catch (parseErr) {
      sse.sendError(`Failed to parse scene break result: ${parseErr}`);
      return;
    }

    sse.sendDone(scenes);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    sse.sendError(message);
  }
}
