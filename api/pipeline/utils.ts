import type { VercelRequest, VercelResponse } from '@vercel/node';

const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';

export function getCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export function handleCORS(res: VercelResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export function sendError(res: VercelResponse, status: number, message: string) {
  handleCORS(res);
  res.status(status).setHeader('Content-Type', 'application/json').end(JSON.stringify({ error: message }));
}

export async function callDeepSeekStream(
  systemPrompt: string,
  userPrompt: string,
  temperature: number,
  maxTokens: number,
  onToken: (token: string) => void,
  responseFormat?: { type: 'json_object' | 'text' },
): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY not configured');
  }

  const messages: { role: string; content: string }[] = [];
  if (systemPrompt.trim()) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  messages.push({ role: 'user', content: userPrompt });

  console.log(`[DeepSeek] Calling API with model=deepseek-v4-flash, messages count=${messages.length}, system prompt length=${systemPrompt.length}, responseFormat=${responseFormat?.type || 'default'}`);

  const requestBody: Record<string, unknown> = {
    model: 'deepseek-v4-flash',
    messages,
    temperature,
    max_tokens: maxTokens,
    stream: true,
  };
  if (responseFormat) {
    requestBody.response_format = responseFormat;
  }

  const response = await fetch(DEEPSEEK_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  console.log(`[DeepSeek] Response status: ${response.status} ${response.statusText}`);

  if (!response.ok) {
    const errText = await response.text();
    console.error(`[DeepSeek] API error response: ${errText.slice(0, 500)}`);
    throw new Error(`DeepSeek API error ${response.status}: ${errText}`);
  }

  if (!response.body) {
    throw new Error('No response body from DeepSeek');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullText = '';
  let buffer = '';
  let chunkCount = 0;
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    chunkCount++;
    totalBytes += value?.length || 0;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data: ')) continue;

      const data = trimmed.slice(6);
      if (data === '[DONE]') {
        console.log(`[DeepSeek] Stream complete: ${chunkCount} chunks, ${totalBytes} bytes, ${fullText.length} chars parsed`);
        return fullText;
      }

      try {
        const parsed = JSON.parse(data);
        const choice = parsed.choices?.[0];
        const content = choice?.delta?.content;
        if (content) {
          fullText += content;
          onToken(content);
        }
        // 检测 finish_reason: "length" 表示响应被截断
        const finishReason = choice?.finish_reason;
        if (finishReason === 'length') {
          throw new Error('AI 响应被截断（token 不足）。请增大 maxTokens 设置或使用更短的剧本。');
        }
      } catch (e) {
        // 如果是截断错误，直接抛出
        if (e instanceof Error && e.message.includes('token 不足')) {
          throw e;
        }
        // Log first few parse errors for debugging
        if (chunkCount <= 3) {
          console.warn(`[DeepSeek] Failed to parse chunk: ${data.slice(0, 100)}`);
        }
      }
    }
  }

  console.log(`[DeepSeek] Stream ended without [DONE]: ${chunkCount} chunks, ${totalBytes} bytes, ${fullText.length} chars`);
  return fullText;
}

export function createSSE(res: VercelResponse) {
  handleCORS(res);
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  return {
    sendToken(token: string) {
      res.write(`data: ${JSON.stringify({ token })}\n\n`);
    },
    sendProgress(data: unknown) {
      res.write(`event: progress\ndata: ${JSON.stringify(data)}\n\n`);
    },
    sendDone(result: unknown) {
      res.write(`event: done\ndata: ${JSON.stringify(result)}\n\n`);
      res.end();
    },
    sendError(message: string) {
      res.write(`event: error\ndata: ${JSON.stringify({ error: message })}\n\n`);
      res.end();
    },
  };
}

export function parseBody<T>(req: VercelRequest): T | null {
  try {
    return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return null;
  }
}

/**
 * 从 AI 返回的文本中提取 JSON（处理 markdown 代码块包裹、嵌套对象等情况）
 */
export function parseJSONResponse<T>(text: string): T {
  // 0. 检查空内容（可能是 reasoning model 耗尽了所有 token）
  if (!text || !text.trim()) {
    throw new Error('AI 返回了空内容。可能原因：max_tokens 不足导致推理过程耗尽了所有 token。请增大 maxTokens 或缩短输入剧本。');
  }

  // 1. 尝试直接解析整段文本
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    // continue
  }

  // 2. 尝试从 markdown 代码块中提取 (```json ... ``` 或 ``` ... ```)
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1].trim()) as T;
    } catch {
      // continue
    }
  }

  // 3. 使用花括号计数器查找最外层的 JSON 对象或数组
  const extractOutermost = (text: string, openCh: string, closeCh: string): string | null => {
    const start = text.indexOf(openCh);
    if (start === -1) return null;

    let depth = 0;
    let inString = false;
    let escape = false;

    for (let i = start; i < text.length; i++) {
      const ch = text[i];

      if (escape) {
        escape = false;
        continue;
      }

      if (ch === '\\' && inString) {
        escape = true;
        continue;
      }

      if (ch === '"') {
        inString = !inString;
        continue;
      }

      if (inString) continue;

      if (ch === openCh) {
        depth++;
      } else if (ch === closeCh) {
        depth--;
        if (depth === 0) {
          return text.slice(start, i + 1);
        }
      }
    }

    return null;
  };

  // 尝试提取 JSON 对象 {}
  const objCandidate = extractOutermost(trimmed, '{', '}');
  if (objCandidate) {
    try {
      return JSON.parse(objCandidate) as T;
    } catch {
      // continue
    }
  }

  // 尝试提取 JSON 数组 []
  const arrCandidate = extractOutermost(trimmed, '[', ']');
  if (arrCandidate) {
    try {
      return JSON.parse(arrCandidate) as T;
    } catch {
      // continue
    }
  }

  // 4. 全部尝试失败
  throw new Error(`无法从 AI 响应中解析 JSON。原始文本前 500 字符：\n${trimmed.slice(0, 500)}`);
}
