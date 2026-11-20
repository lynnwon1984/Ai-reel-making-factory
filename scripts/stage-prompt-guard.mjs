export const FACT_FIELDS = [
  "source_id",
  "locator",
  "sequence",
  "when",
  "where",
  "who",
  "event",
  "change",
  "quotes",
  "motifs",
  "stage_trap",
];

export function parseFactLedger(content) {
  const lines = String(content)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith('{"source_id"'));
  const facts = [];
  const issues = [];

  for (const [index, line] of lines.entries()) {
    try {
      facts.push(JSON.parse(line));
    } catch {
      issues.push({
        code: "FACT_JSON_INVALID",
        severity: "P0",
        sourceId: "",
        detail: `FACTS_JSONL 第 ${index + 1} 行不是合法 JSON`,
      });
    }
  }

  if (!facts.length) {
    issues.push({
      code: "FACT_LEDGER_EMPTY",
      severity: "P0",
      sourceId: "",
      detail: "没有解析到 FACTS_JSONL",
    });
  }

  return { facts, issues };
}

export function extractDirectQuotes(source) {
  const quotes = [];
  const pattern = /[“"]([^”"\n]+)[”"]/g;
  for (const match of String(source).matchAll(pattern)) {
    const text = match[1].trim();
    if (text && !quotes.includes(text)) quotes.push(text);
  }
  return quotes;
}

export function extractDialogueQuotes(source) {
  const quotes = [];
  const pattern = /(?:说|问|答|喊|叫|道)[：:]\s*[“"]([^”"\n]+)[”"]/g;
  for (const match of String(source).matchAll(pattern)) {
    const text = match[1].trim();
    if (text && !quotes.includes(text)) quotes.push(text);
  }
  return quotes;
}

function editDistance(left, right) {
  const a = Array.from(left);
  const b = Array.from(right);
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);

  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }

  return previous[b.length];
}

function findUniqueQuoteCandidate(text, sourceQuotes) {
  if (sourceQuotes.includes(text)) {
    return { text, distance: 0, exact: true };
  }

  const ranked = sourceQuotes
    .map((candidate) => ({
      text: candidate,
      distance: editDistance(text, candidate),
    }))
    .sort((a, b) => a.distance - b.distance);
  if (!ranked.length) return null;

  const bestDistance = ranked[0].distance;
  const best = ranked.filter((candidate) => candidate.distance === bestDistance);
  const threshold = Array.from(text).length <= 8 ? 1 : 2;
  if (best.length !== 1 || bestDistance > threshold) {
    return { text: "", distance: bestDistance, exact: false, ambiguous: best.length !== 1 };
  }
  return { ...best[0], exact: false };
}

export function restoreProtectedQuotes(content, sourceQuotes) {
  let text = String(content ?? "");
  const corrections = [];

  for (const quote of sourceQuotes) {
    if (!quote || text.includes(quote)) continue;
    const chars = Array.from(text);
    const targetLength = Array.from(quote).length;
    if (targetLength < 4) continue;

    let bestDistance = Number.POSITIVE_INFINITY;
    let candidates = [];
    for (const length of [targetLength - 1, targetLength, targetLength + 1]) {
      if (length <= 0) continue;
      for (let index = 0; index <= chars.length - length; index += 1) {
        const candidate = chars.slice(index, index + length).join("");
        if (candidate.includes("\n")) continue;
        const distance = editDistance(candidate, quote);
        if (distance < bestDistance) {
          bestDistance = distance;
          candidates = [{ candidate, index, length }];
        } else if (distance === bestDistance) {
          candidates.push({ candidate, index, length });
        }
      }
    }

    const threshold = targetLength <= 12 ? 1 : 2;
    const boundaryPenalty = (candidate) => {
      const value = Array.from(candidate.candidate);
      const target = Array.from(quote);
      return (
        (value[0] === target[0] ? 0 : 1) +
        (value.at(-1) === target.at(-1) ? 0 : 1)
      );
    };
    const closestBoundary = Math.min(...candidates.map(boundaryPenalty));
    const boundaryCandidates = candidates.filter(
      (candidate) => boundaryPenalty(candidate) === closestBoundary,
    );
    const closestLength = Math.min(
      ...boundaryCandidates.map((candidate) => Math.abs(candidate.length - targetLength)),
    );
    const closest = boundaryCandidates.filter(
      (candidate) => Math.abs(candidate.length - targetLength) === closestLength,
    );
    if (bestDistance <= threshold && closest.length === 1) {
      const best = closest[0];
      const before = chars.slice(0, best.index).join("");
      const after = chars.slice(best.index + best.length).join("");
      text = `${before}${quote}${after}`;
      corrections.push({ from: best.candidate, to: quote, distance: bestDistance });
    }
  }

  return { text, corrections };
}

/**
 * 原始模型输出必须先落盘。这里只处理已经落盘的 JSONL：
 * 逐字引语只在存在唯一近似原句时恢复，否则阻断，不靠模型自检。
 */
export function guardSourceFacts(facts, source) {
  const guarded = structuredClone(facts);
  const sourceQuotes = extractDirectQuotes(source);
  const corrections = [];
  const issues = [];

  guarded.forEach((fact, index) => {
    const id = fact.source_id || `第${index + 1}条`;
    const missing = FACT_FIELDS.filter((key) => !(key in fact));
    if (missing.length) {
      issues.push({
        code: "FACT_FIELD_MISSING",
        severity: "P0",
        sourceId: id,
        detail: `缺少字段：${missing.join(", ")}`,
      });
    }

    if (!String(fact.change ?? "").trim() || fact.change === "[待确认]") {
      issues.push({
        code: "FACT_CHANGE_MISSING",
        severity: "P0",
        sourceId: id,
        detail: "change 为空或未确认",
      });
    }
    if (fact.sequence !== index + 1) {
      issues.push({
        code: "FACT_SEQUENCE_INVALID",
        severity: "P0",
        sourceId: id,
        detail: `sequence 应为 ${index + 1}，实际为 ${fact.sequence}`,
      });
    }

    for (const key of ["when", "where"]) {
      const value = String(fact[key] ?? "").trim();
      if (!value) {
        issues.push({
          code: "FACT_FIELD_EMPTY",
          severity: "P0",
          sourceId: id,
          detail: `${key} 为空，无法判断时应写 [暂缺]`,
        });
      } else if (/原文|无则写|示例/.test(value)) {
        issues.push({
          code: "FACT_FIELD_POLLUTED",
          severity: "P0",
          sourceId: id,
          detail: `${key} 抄入了字段说明：${value}`,
        });
      }
    }

    if (!Array.isArray(fact.who) || !fact.who.length) {
      issues.push({
        code: "FACT_WHO_INVALID",
        severity: "P0",
        sourceId: id,
        detail: "who 为空或不是数组",
      });
    }
    if (!Array.isArray(fact.quotes)) {
      issues.push({
        code: "FACT_QUOTES_INVALID",
        severity: "P0",
        sourceId: id,
        detail: "quotes 不是数组",
      });
    }
    if (!String(fact.stage_trap ?? "").trim()) {
      issues.push({
        code: "FACT_STAGE_TRAP_MISSING",
        severity: "P0",
        sourceId: id,
        detail: "stage_trap 为空",
      });
    }

    if (!Array.isArray(fact.quotes)) return;
    for (const [quoteIndex, quote] of fact.quotes.entries()) {
      if (!fact.who?.includes(quote.speaker)) {
        issues.push({
          code: "QUOTE_SPEAKER_INVALID",
          severity: "P0",
          sourceId: id,
          detail: `引语说话人 ${quote.speaker || "(空)"} 不在 who 中`,
        });
      }

      const match = findUniqueQuoteCandidate(String(quote.text ?? "").trim(), sourceQuotes);
      if (match?.exact) continue;
      if (match && !match.ambiguous && match.text) {
        corrections.push({
          sourceId: id,
          quoteIndex,
          from: quote.text,
          to: match.text,
          distance: match.distance,
        });
        quote.text = match.text;
      } else {
        issues.push({
          code: "QUOTE_TEXT_UNVERIFIED",
          severity: "P0",
          sourceId: id,
          detail: match?.ambiguous
            ? `引语无法唯一匹配原文：${quote.text}`
            : `引语在原文中没有可靠匹配：${quote.text}`,
        });
      }
    }
  });

  const presentQuotes = new Set(
    guarded.flatMap((fact) => (Array.isArray(fact.quotes) ? fact.quotes : []))
      .map((quote) => String(quote.text ?? "").trim())
      .filter(Boolean),
  );
  for (const quote of extractDialogueQuotes(source)) {
    if (!presentQuotes.has(quote)) {
      issues.push({
        code: "QUOTE_MISSING_FROM_LEDGER",
        severity: "P0",
        sourceId: "",
        detail: `原文对白未进入事实账本：${quote}`,
      });
    }
  }

  return { facts: guarded, corrections, issues };
}
