/**
 * Prompt 模板变量插值引擎
 * 使用 {{variableName}} 双花括号语法
 */

export interface RenderResult {
  rendered: string;
  missingVars: string[];
}

/**
 * 渲染 prompt 模板，将 {{variable}} 替换为实际值
 * - 对象类型序列化为格式化 JSON
 * - 未匹配的占位符保留原样
 */
export function renderPrompt(
  template: string,
  context: Record<string, unknown>
): RenderResult {
  const missingVars: string[] = [];

  const rendered = template.replace(
    /\{\{(\w+(?:\.\w+)*)\}\}/g,
    (match, path: string) => {
      const value = getNestedValue(context, path);
      if (value === undefined) {
        missingVars.push(path);
        return match; // 保留原始占位符
      }
      return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    }
  );

  return { rendered, missingVars };
}

/**
 * 获取嵌套对象值（支持 a.b.c 路径）
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((current: unknown, key: string) => {
    if (current && typeof current === 'object' && key in (current as Record<string, unknown>)) {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

/**
 * 估算文本的 token 数（中文场景粗略估算）
 * DeepSeek 中文约 1.5 字符/token
 */
export function estimateTokens(text: string): number {
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const otherChars = text.length - chineseChars;
  return Math.ceil(chineseChars / 1.5 + otherChars / 4);
}

/**
 * 将场景列表按 token 预算分批
 */
export function splitIntoBatches<T>(
  items: T[],
  overheadTokens: number,
  budgetPerBatch: number,
  estimateItemTokens: (item: T) => number
): T[][] {
  const batches: T[][] = [];
  let currentBatch: T[] = [];
  let currentTokens = overheadTokens;

  for (const item of items) {
    const itemTokens = estimateItemTokens(item);
    if (currentTokens + itemTokens > budgetPerBatch && currentBatch.length > 0) {
      batches.push(currentBatch);
      currentBatch = [item];
      currentTokens = overheadTokens + itemTokens;
    } else {
      currentBatch.push(item);
      currentTokens += itemTokens;
    }
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
}
