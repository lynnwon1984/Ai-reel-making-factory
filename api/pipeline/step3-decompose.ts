import type { VercelRequest, VercelResponse } from '@vercel/node';
import type {
  PipelineSettings,
  PurifiedScript,
  ScriptAnalysis,
  BatchResult,
  BatchSummary,
  Shot,
  SceneIndexEntry,
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
    analysis: ScriptAnalysis;
    settings: PipelineSettings;
    customPrompt?: string;
    batchIndex?: number;
    previousBatchSummary?: BatchSummary;
  }>(req);

  if (!body || !body.purifiedScript || !body.analysis) {
    sendError(res, 400, 'Missing purifiedScript or analysis');
    return;
  }

  const { purifiedScript, analysis, settings, customPrompt, batchIndex, previousBatchSummary } = body;
  const sse = createSSE(res);

  try {
    const effectivePrompt = getEffectivePrompt('decompose', customPrompt);
    const temperature = settings?.temperature ?? 0.3;
    const maxTokens = settings?.maxTokens ?? 8192;
    const batchSize = settings?.batchSize || 3;
    const stylePreset = settings?.stylePreset || '';
    const tokenBudget = settings?.tokenBudget || 80000;
    const fullText = purifiedScript.fullText || '';
    const sceneIndex = purifiedScript.sceneIndex || [];

    // Inject stylePreset into system prompt
    const systemPromptWithStyle = stylePreset
      ? effectivePrompt + `\n\n整体分镜风格：${stylePreset}`
      : effectivePrompt;

    // Build batches from sceneIndex entries
    const batches: { entries: SceneIndexEntry[]; text: string }[] = [];

    if (sceneIndex.length > 0) {
      for (let i = 0; i < sceneIndex.length; i += batchSize) {
        const batchEntries = sceneIndex.slice(i, i + batchSize);
        if (batchEntries.length === 0) continue;

        // Get text range for this batch
        const startOffset = batchEntries[0].textOffset;
        const lastEntry = batchEntries[batchEntries.length - 1];
        const endOffset = lastEntry.textOffset + lastEntry.textLength;
        const batchText = fullText.slice(startOffset, endOffset);

        batches.push({ entries: batchEntries, text: batchText });
      }
    } else {
      // Fallback: if no sceneIndex, split fullText by rough character count
      const charsPerBatch = 2000;
      for (let i = 0; i < fullText.length; i += charsPerBatch) {
        const text = fullText.slice(i, i + charsPerBatch);
        batches.push({
          entries: [{ index: Math.floor(i / charsPerBatch), location: '', timeOfDay: '', characters: [], textOffset: i, textLength: text.length }],
          text,
        });
      }
      if (batches.length === 0 && fullText.length > 0) {
        batches.push({ entries: [], text: fullText });
      }
    }

    // If specified batchIndex, only process that batch
    const batchesToProcess = batchIndex !== undefined
      ? [batches[batchIndex]].filter(Boolean)
      : batches;

    const startBatchIndex = batchIndex !== undefined ? batchIndex : 0;
    const allShots: Shot[] = [];
    let summary: BatchSummary | null = previousBatchSummary || null;

    for (let i = 0; i < batchesToProcess.length; i++) {
      const batch = batchesToProcess[i];
      const currentBatchIndex = startBatchIndex + i;

      const context = {
        purifiedScript: fullText,
        analysis: JSON.stringify(analysis),
        currentBatchScenes: JSON.stringify(batch.entries),
        previousBatchSummary: summary ? JSON.stringify(summary) : '无（这是第一批）',
        stylePreset: stylePreset,
        tokenBudget: String(tokenBudget),
      };

      const { rendered: renderedPrompt, missingVars } = renderPrompt(systemPromptWithStyle, context);

      if (missingVars.length > 0) {
        console.warn(`step3-decompose batch ${currentBatchIndex}: Missing variables:`, missingVars);
      }

      const userMessage = `请对以下剧本片段进行分镜设计（第 ${currentBatchIndex + 1}/${batches.length} 批，Token 预算上限：${tokenBudget}），输出 BatchResult JSON（包含 shots 数组和 batchSummary）：\n\n剧本片段：\n${batch.text}`;

      const aiResponse = await callDeepSeekStream(
        renderedPrompt,
        userMessage,
        temperature,
        maxTokens,
        (token) => sse.sendToken(token),
      );

      const batchResult = parseJSONResponse<BatchResult>(aiResponse);
      allShots.push(...batchResult.shots);
      summary = batchResult.batchSummary;

      // Send batch progress
      sse.sendProgress({
        batchIndex: currentBatchIndex,
        totalBatches: batches.length,
        shotsInBatch: batchResult.shots.length,
        totalShotsSoFar: allShots.length,
        batchSummary: summary,
      });
    }

    // Verify and fix shot number continuity
    for (let i = 0; i < allShots.length; i++) {
      allShots[i].shotNumber = i + 1;
    }

    sse.sendDone({
      shots: allShots,
      totalBatches: batches.length,
      finalSummary: summary,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    sse.sendError(message);
  }
}
