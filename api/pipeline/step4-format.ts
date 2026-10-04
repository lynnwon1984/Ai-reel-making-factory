import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { Shot, Scene, ScriptAnalysis, PipelineSettings, Storyboard } from '../../src/lib/types.ts';
import { callDeepSeekStream, createSSE, parseBody, sendError } from './utils.ts';

const SYSTEM_PROMPT = `你是分镜剧本编辑，负责将所有镜头数据整理成规范的分镜剧本文档。

根据传入的镜头、场景和分析数据，生成最终的分镜剧本 JSON 文档。

输出严格 JSON 格式，不要包含任何其他文字。JSON 结构如下：
{
  "title": "分镜剧本标题",
  "totalShots": 总镜头数,
  "totalDuration": 总时长（秒）,
  "scenes": [
    {
      "sceneNumber": 场景编号,
      "location": "地点",
      "time": "日/夜/晨/黄昏",
      "characters": ["角色数组"],
      "summary": "场景概要",
      "scriptContent": "原始剧本文本",
      "shots": [该场景下的所有镜头],
      "sceneDuration": 该场景总时长（秒）
    }
  ],
  "summary": "整体摘要，概括分镜剧本的核心内容和视觉风格"
}

要求：
1. 标题要贴合剧本内容，简洁有力
2. 场景按 sceneNumber 排序
3. 每个场景的 shots 按 shotNumber 排序
4. sceneDuration 为该场景下所有镜头 duration 之和
5. totalDuration 为所有场景 duration 之和
6. summary 要概括视觉风格、节奏特点和关键场景亮点`;

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
    scenes: Scene[];
    analysis: ScriptAnalysis;
    settings: PipelineSettings;
  }>(req);

  if (!body || !body.shots || !body.scenes || !body.analysis) {
    sendError(res, 400, 'Missing shots, scenes, or analysis');
    return;
  }

  const { shots, scenes, analysis, settings } = body;
  const sse = createSSE(res);

  try {
    const effectiveSystemPrompt = settings?.customPrompt
      ? `${SYSTEM_PROMPT}\n\n附加指令：${settings.customPrompt}`
      : SYSTEM_PROMPT;

    const totalDuration = shots.reduce((sum, s) => sum + s.duration, 0);
    const userPrompt = `请将以下分镜数据整理为规范的分镜剧本文档。

剧本信息：
- 类型：${analysis.scriptType}
- 风格：${analysis.style}
- 情绪基调：${analysis.mood}
- 角色：${analysis.characters.map((c) => `${c.name}（${c.role}）`).join('、')}

统计数据：
- 场景数：${scenes.length}
- 镜头数：${shots.length}
- 预估总时长：${totalDuration}秒

场景列表：
${scenes.map((s) => `场景${s.sceneNumber}：${s.location} / ${s.time} - ${s.summary}`).join('\n')}

镜头数据（JSON）：
${JSON.stringify(shots, null, 2)}

场景数据（JSON）：
${JSON.stringify(scenes, null, 2)}`;

    const temperature = settings?.temperature ?? 0.5;
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

    let storyboard: Storyboard;
    try {
      const jsonMatch = fullText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        storyboard = JSON.parse(jsonMatch[0]) as Storyboard;
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseErr) {
      sse.sendError(`Failed to parse storyboard result: ${parseErr}`);
      return;
    }

    sse.sendDone(storyboard);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    sse.sendError(message);
  }
}
