import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { PipelineSettings, PurifiedScript, DiagnosisResult, RepairResult } from '../../src/lib/types.ts';
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
    purifiedScript: PurifiedScript;
    diagnosis: DiagnosisResult;
    settings: PipelineSettings;
    customPrompt?: string;
  }>(req);

  if (!body || !body.purifiedScript || !body.diagnosis) {
    sendError(res, 400, 'Missing purifiedScript or diagnosis');
    return;
  }

  const { purifiedScript, diagnosis, settings, customPrompt } = body;
  const sse = createSSE(res);

  try {
    const effectivePrompt = getEffectivePrompt('repair', customPrompt);

    const scriptText = purifiedScript.fullText || JSON.stringify(purifiedScript);
    const diagnosisText = JSON.stringify(diagnosis, null, 2);

    const context = {
      scriptText,
      diagnosis: diagnosisText,
    };
    const { rendered: renderedPrompt, missingVars } = renderPrompt(effectivePrompt, context);

    if (missingVars.length > 0) {
      console.warn('step2-repair: Missing variables in prompt:', missingVars);
    }

    const userMessage = `请根据以下诊断报告，对剧本进行修复。

## 诊断报告
${diagnosisText}

## 原始剧本
${scriptText}

请输出修复后的完整剧本文本，用【修复：xxx】标记修改点。`;

    const temperature = settings?.temperature ?? 0.4;
    const maxTokens = settings?.maxTokens ?? 16384;

    const fullText = await callDeepSeekStream(
      renderedPrompt,
      userMessage,
      temperature,
      maxTokens,
      (token) => sse.sendToken(token),
    );

    // Count fix markers
    const fixCount = (fullText.match(/【修复：/g) || []).length;
    const result: RepairResult = {
      repairedText: fullText,
      fixCount,
    };

    sse.sendDone(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    sse.sendError(message);
  }
}
