/**
 * 分块连续输出 —— 一段输出被上游截断（incomplete）时，自动接续，直到跑完或到轮次上限。
 *
 * 抽出来的理由：这是流程一里最容易被忽略、出问题又看不出来的一段。
 * 8.5 万字的产出没人会逐字核对，续跑逻辑要是坏了，你只会拿到一份**被静默截断**的剧本。
 * 抽成纯函数之后，就能拿假的上游流把它钉住。
 */

export const MAX_ROUNDS = 6;
/** 接续时回带给模型的"已输出内容结尾"长度 */
export const TAIL_KEEP = 1200;

/** 拼出这一轮要发出去的 input。前缀放在最前，以命中上下文缓存。 */
export function buildRoundInput({ prefix = "", seed = "", next = "", full = "" }) {
  const tail =
    full === ""
      ? seed
      : `${next}\n\n【已输出内容的结尾】\n${full.slice(-TAIL_KEEP)}\n\n请直接从上面的结尾处继续输出，不要重复已输出的内容。`;
  return `${prefix}\n\n${tail}`;
}

/**
 * @param callModel  ({ input, round, onText }) => { text, status }
 *         status === "incomplete" 表示被截断，需要再来一轮；其它值都算跑完。
 * @param onRound    (n) => void        每轮开始
 * @param onProgress (full) => void     每轮结束（用于把中间结果实时落盘）
 */
export async function runChunked({
  callModel,
  prefix = "",
  seed = "",
  next = "",
  existing = "",
  maxRounds = MAX_ROUNDS,
  onRound,
  onProgress,
}) {
  let full = existing ?? "";
  let rounds = 0;
  let status = "completed";

  for (let n = 1; n <= maxRounds; n += 1) {
    rounds = n;
    onRound?.(n);
    const res = await callModel({
      input: buildRoundInput({ prefix, seed, next, full }),
      round: n,
    });
    full += res?.text ?? "";
    status = res?.status ?? "completed";
    onProgress?.(full);
    if (status !== "incomplete") break;
  }

  return { text: full, rounds, status, truncated: status === "incomplete" };
}
