import type { VercelRequest, VercelResponse } from '@vercel/node';
import type {
  PipelineSettings,
  Shot,
  ScriptAnalysis,
  QualityReport,
  RepairFinalResult,
} from '../../src/lib/types.ts';
import { callDeepSeekStream, createSSE, parseBody, sendError } from './utils.ts';
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
    qualityReport: QualityReport;
    settings: PipelineSettings;
    customPrompt?: string;
  }>(req);

  if (!body || !body.shots || !body.analysis || !body.qualityReport) {
    sendError(res, 400, 'Missing shots, analysis, or qualityReport');
    return;
  }

  const { shots, analysis, qualityReport, settings, customPrompt } = body;
  const sse = createSSE(res);

  try {
    const effectivePrompt = getEffectivePrompt('repair_final', customPrompt);

    const context = {
      shots: JSON.stringify(shots),
      analysis: JSON.stringify(analysis),
      qualityReport: JSON.stringify(qualityReport),
    };
    const { rendered: renderedPrompt, missingVars } = renderPrompt(effectivePrompt, context);

    if (missingVars.length > 0) {
      console.warn('step5-repair: Missing variables in prompt:', missingVars);
    }

    const userMessage = `请基于以下质检报告，对分镜数据进行最终修复并格式化为标准分镜头剧本：

## 质检报告
${JSON.stringify(qualityReport, null, 2)}

## 分镜数据（${shots.length} 个镜头）
${JSON.stringify(shots.slice(0, 50), null, 2)}
${shots.length > 50 ? `\n... 共 ${shots.length} 个镜头，以上展示前 50 个` : ''}

## 分析数据
${JSON.stringify(analysis, null, 2)}

请输出两部分：
1. Part 1: 修复报告 JSON（fixedIssues, manualReviewItems, formatCompliance）
2. Part 2: 最终分镜头剧本（纯文本，按标准格式输出）`;

    const temperature = settings?.temperature ?? 0.2;
    const maxTokens = settings?.maxTokens ?? 16384;

    const fullText = await callDeepSeekStream(
      renderedPrompt,
      userMessage,
      temperature,
      maxTokens,
      (token) => sse.sendToken(token),
    );

    // Parse the response: try to extract JSON part and text part
    let result: RepairFinalResult;
    
    const jsonMatch = fullText.match(/\{[\s\S]*?"fixedIssues"[\s\S]*?\}/);
    const textAfterJson = jsonMatch 
      ? fullText.slice(fullText.indexOf(jsonMatch[0]) + jsonMatch[0].length).trim()
      : '';
    
    try {
      const jsonPart = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
      result = {
        fixedIssues: jsonPart?.fixedIssues ?? 0,
        manualReviewItems: jsonPart?.manualReviewItems ?? [],
        formatCompliance: jsonPart?.formatCompliance ?? 0,
        finalStoryboardText: textAfterJson || fullText,
      };
    } catch {
      // If JSON parsing fails, treat entire text as storyboard
      result = {
        fixedIssues: 0,
        manualReviewItems: ['JSON 解析失败，请检查输出'],
        formatCompliance: 0,
        finalStoryboardText: fullText,
      };
    }

    sse.sendDone(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    sse.sendError(message);
  }
}
