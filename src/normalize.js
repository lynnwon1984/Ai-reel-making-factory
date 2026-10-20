import { classifyDialogue } from "./qc-engine.js";
import { parseStoryboard } from "./storyboard.js";
import { flatten } from "./qc-engine.js";

const pad = (n) => String(n).padStart(2, "0");

/**
 * 每集 shot 编号重排：把 【分镜N】 与 [shotN 按出现顺序改成 01、02…
 * 只动编号，不动任何内容。返回 { text, changed }。
 */
export function renumberShots(text) {
  let changed = 0;
  const out = [];
  let counter = 0;
  for (const raw of String(text || "").split(/\r?\n/)) {
    const line = raw;
    if (/^\s*(?:\*\*)?第\s*\d+\s*集/.test(line)) counter = 0;
    let next = line;
    if (/^\s*(?:\*\*)?【分镜\s*\d+\s*】/.test(line)) {
      counter += 1;
      const want = pad(counter);
      next = line.replace(/【分镜\s*(\d+)\s*】/, (m, n) => (n === want ? m : `【分镜${want}】`));
    } else if (/^\s*\[\s*shot\s*\d+/.test(line)) {
      // shot 行紧随其后的【分镜】已计数；这里只对齐同一序号
      const want = pad(counter || 1);
      next = line.replace(/\[\s*shot\s*(\d+)/, (m, n) => (n === want ? m : `[shot${want}`));
    }
    if (next !== line) changed += 1;
    out.push(next);
  }
  return { text: out.join("\n"), changed };
}

/**
 * 把「多句原文拼成一条 EN 行」拆回多条。
 * 只按原文句子边界切，不改字。返回 { text, changed }。
 */
export function splitMergedEn(text, sourceText) {
  const srcList = [];
  for (const raw of String(sourceText || "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("△")) continue;
    const m = line.match(/^\*{0,2}([^：:*\n]{1,24})\*{0,2}\s*(?:（[^）]*）)?\s*[：:]\s*(.+)$/);
    if (!m) continue;
    const key = flatten(m[2].replace(/^["“「]|["”」]$/g, "").trim());
    if (key) srcList.push(key);
  }

  let changed = 0;
  const out = [];
  for (const line of String(text || "").split(/\r?\n/)) {
    const m = line.match(/^(\s*EN:\s*)(.+?)(（[^）]*）)?\s*:\s*["“](.+)["”]\s*$/);
    if (!m) {
      out.push(line);
      continue;
    }
    const [, prefix, speaker, mode, quote] = m;
    if (classifyDialogue(quote, srcList) !== "merged") {
      out.push(line);
      continue;
    }
    // 按原文句子长度贪心切
    let rest = quote;
    const chunks = [];
    while (rest) {
      const flatRest = flatten(rest);
      let bestLen = 0;
      for (const s of srcList) {
        if (s.length > bestLen && flatRest.startsWith(s)) bestLen = s.length;
      }
      if (!bestLen) break;
      // 按扁平长度回推原文位置：逐字累积计数
      let acc = 0;
      let cut = rest.length;
      for (let i = 0; i < rest.length; i += 1) {
        if (/[\p{L}\p{N}]/u.test(rest[i])) acc += 1;
        if (acc >= bestLen) {
          cut = i + 1;
          // 把紧跟的标点/空格带上，避免「Run」和「! Thank you」被切开
          while (cut < rest.length && !/[\p{L}\p{N}]/u.test(rest[cut])) cut += 1;
          break;
        }
      }
      chunks.push(rest.slice(0, cut).trim());
      rest = rest.slice(cut).trim();
    }
    if (chunks.length < 2) {
      out.push(line);
      continue;
    }
    changed += 1;
    for (const c of chunks) out.push(`${prefix}${speaker}${mode || ""}: "${c}"`);
  }
  return { text: out.join("\n"), changed };
}

/** 一次跑完两项规范化 */
export function normalizeStoryboard(text, sourceText) {
  const a = renumberShots(text);
  const b = splitMergedEn(a.text, sourceText);
  return { text: b.text, renumbered: a.changed, split: b.changed };
}

/** 给界面用：规范化前后的问题是否真的变少 */
export function countIssues(sourceText, text) {
  const parsed = parseStoryboard(text);
  let shots = 0;
  for (const ep of parsed.episodes) shots += ep.shots.length;
  return { episodes: parsed.episodes.length, shots };
}
