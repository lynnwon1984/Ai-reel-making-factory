export const SEVERITIES = ["高", "中", "低"];

/**
 * 解析质检输出。只认 `[高] 位置 | 规则 | 证据` 这种行，
 * 其它内容（模型偶尔加的开场白）一律忽略。
 */
export function parseQc(text) {
  const issues = [];
  for (const raw of String(text || "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(/^[-*\s]*[\[【]\s*(高|中|低)\s*[\]】]\s*(.*)$/);
    if (!m) continue;
    const parts = m[2].split("|").map((s) => s.trim());
    const where = parts[0] || "";
    if (!where) continue;
    issues.push({
      level: m[1],
      where,
      rule: parts[1] || "",
      evidence: parts.slice(2).join(" | "),
    });
  }
  return issues;
}

export function countByLevel(issues = []) {
  const out = { 高: 0, 中: 0, 低: 0 };
  for (const it of issues) {
    if (out[it.level] != null) out[it.level] += 1;
  }
  return out;
}

/** 高 → 中 → 低，同级保持原顺序 */
export function sortIssues(issues = []) {
  return issues
    .map((it, i) => ({ it, i }))
    .sort((a, b) => {
      const d = SEVERITIES.indexOf(a.it.level) - SEVERITIES.indexOf(b.it.level);
      return d !== 0 ? d : a.i - b.i;
    })
    .map((x) => x.it);
}

export function topIssues(issues = [], n = 3) {
  return sortIssues(issues).slice(0, n);
}

export function hasHigh(issues = []) {
  return issues.some((it) => it.level === "高");
}

/** 把每批各自的质检结果拼成一份 */
export function collectBatchIssues(batches = []) {
  return sortIssues(batches.flatMap((b) => b.qc || []));
}
