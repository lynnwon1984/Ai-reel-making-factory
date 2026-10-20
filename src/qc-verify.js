import { flatten } from "./qc-engine.js";

const WHERE = /第\s*(\d+)\s*集[\s·]*分镜\s*(\d+)/;

/** 本批合法分镜：集号-镜号 */
export function allowedKeys(parsed) {
  const set = new Set();
  for (const ep of parsed.episodes) {
    for (const shot of ep.shots) set.add(`${ep.no}-${shot.no}`);
  }
  return set;
}

/**
 * 模型结论的笼子：定位必须在合法集合里，引用必须能在产出里搜到。
 * 通不过的一律丢弃，并记下原因。
 */
export function verifyModelIssues(issues, { parsed, outputText }) {
  const allowed = allowedKeys(parsed);
  const flatOut = flatten(outputText);
  const kept = [];
  const dropped = [];

  for (const it of issues) {
    const m = String(it.where || "").match(WHERE);
    if (!m) {
      dropped.push({ ...it, reason: "没有可定位的分镜" });
      continue;
    }
    const key = `${Number(m[1])}-${Number(m[2])}`;
    if (!allowed.has(key)) {
      dropped.push({ ...it, reason: "分镜不在本批范围内" });
      continue;
    }

    const quotes = [...String(it.evidence || "").matchAll(/["“「]([^"”」]{2,})["”」]/g)].map(
      (x) => x[1],
    );
    if (!quotes.length) {
      dropped.push({ ...it, reason: "没有引用原文" });
      continue;
    }
    if (!quotes.some((q) => flatOut.includes(flatten(q)))) {
      dropped.push({ ...it, reason: "引用的原文在产出里找不到" });
      continue;
    }

    kept.push(it);
  }

  return { kept, dropped };
}

export function droppedSummary(dropped = []) {
  const by = {};
  for (const d of dropped) by[d.reason] = (by[d.reason] || 0) + 1;
  return Object.entries(by).map(([reason, n]) => `${reason} ${n} 条`).join("；");
}
