import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { Scene, Shot, ScriptAnalysis, PipelineSettings } from '../../src/lib/types.ts';
import { callDeepSeekStream, createSSE, parseBody, sendError } from './utils.ts';

const SYSTEM_PROMPT = `你是一位资深电影导演和分镜师，精通视觉叙事和镜头语言。你的任务是将每个场景拆解为具体的拍摄镜头。

对每个镜头，你需要精心设计以下要素：
- shotNumber：镜号（全局递增，从1开始）
- sceneNumber：所属场景编号
- shotType：景别（远景/全景/中景/近景/特写）
  - 远景：展现环境全貌，建立空间感
  - 全景：展现人物全身及周围环境
  - 中景：人物膝盖以上，展现动作和互动
  - 近景：人物胸部以上，捕捉表情和情绪
  - 特写：局部细节，强调关键物品或表情
- angle：机位角度（平视/俯拍/仰拍/斜侧）
- movement：运镜方式（固定/推/拉/摇/移/跟/升/降/环绕）
- visual：画面描述——要详细生动，描述构图、光影、色彩、人物动作和表情
- dialogue：该镜头对应的台词或旁白（没有则为空字符串）
- soundEffect：音效和配乐建议（环境音、情绪音乐等）
- duration：预估时长（秒），一般2-8秒
- transition：转场方式（硬切/淡入淡出/叠化/划变/闪白/闪黑）
- notes：导演备注（表演指导、拍摄技巧、特殊要求等）

镜头设计原则：
1. 遵循"远-中-近-特"的节奏变化，避免连续使用相同景别
2. 对话场景优先使用正反打（近景/特写交替）
3. 动作场景使用跟镜和移镜增强动感
4. 情绪高潮使用特写和慢运镜
5. 场景建立使用远景或全景
6. 每个镜头时长要合理，总时长与场景内容匹配

输出严格 JSON 数组格式，不要包含任何其他文字。`;

function buildUserPrompt(
  scenes: Scene[],
  analysis: ScriptAnalysis,
  startShotNumber: number,
): string {
  const scenesText = scenes
    .map(
      (s) =>
        `【场景${s.sceneNumber}】${s.location} / ${s.time}\n在场角色：${s.characters.join('、')}\n概要：${s.summary}\n剧本内容：\n${s.scriptContent}`,
    )
    .join('\n\n---\n\n');

  return `剧本类型：${analysis.scriptType}
风格：${analysis.style}
情绪基调：${analysis.mood}

当前需要处理的场景（镜号从 ${startShotNumber} 开始）：

${scenesText}

请将以上场景拆解为具体拍摄镜头，输出 JSON 数组。`;
}

async function processBatch(
  scenes: Scene[],
  analysis: ScriptAnalysis,
  startShotNumber: number,
  settings: PipelineSettings,
  effectiveSystemPrompt: string,
  onToken: (token: string) => void,
): Promise<Shot[]> {
  const userPrompt = buildUserPrompt(scenes, analysis, startShotNumber);
  const temperature = settings?.temperature ?? 0.7;
  const maxTokens = settings?.maxTokens ?? 4096;

  const fullText = await callDeepSeekStream(
    effectiveSystemPrompt,
    userPrompt,
    temperature,
    maxTokens,
    onToken,
  );

  const jsonMatch = fullText.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error(`No JSON array found in shot decomposition for scenes ${scenes.map((s) => s.sceneNumber).join(',')}`);
  }

  return JSON.parse(jsonMatch[0]) as Shot[];
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
    scenes: Scene[];
    analysis: ScriptAnalysis;
    settings: PipelineSettings;
  }>(req);

  if (!body || !body.scenes || !body.analysis) {
    sendError(res, 400, 'Missing scenes or analysis');
    return;
  }

  const { scenes, analysis, settings } = body;
  const sse = createSSE(res);

  try {
    const effectiveSystemPrompt = settings?.customPrompt
      ? `${SYSTEM_PROMPT}\n\n附加指令：${settings.customPrompt}`
      : SYSTEM_PROMPT;

    const allShots: Shot[] = [];
    const BATCH_SIZE = 2; // Process 2 scenes at a time

    for (let i = 0; i < scenes.length; i += BATCH_SIZE) {
      const batch = scenes.slice(i, i + BATCH_SIZE);
      const startShotNumber = allShots.length + 1;

      const batchShots = await processBatch(
        batch,
        analysis,
        startShotNumber,
        settings ?? { temperature: 0.7, maxTokens: 4096, stylePreset: '电影感' },
        effectiveSystemPrompt,
        (token) => {
          sse.sendToken(token);
        },
      );

      allShots.push(...batchShots);
    }

    // Re-number shots sequentially
    const renumbered = allShots.map((shot, idx) => ({
      ...shot,
      shotNumber: idx + 1,
    }));

    sse.sendDone(renumbered);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    sse.sendError(message);
  }
}
