function classify(label = "") {
  if (/修复/.test(label)) return "repair";
  if (/导演提示单/.test(label)) return "brief";
  return "draft";
}

function emptyBucket() {
  return {
    calls: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    reasoningTokens: 0,
    cachedTokens: 0,
    elapsedMs: 0,
  };
}

export function summarizeModelCalls(calls = []) {
  const total = emptyBucket();
  const byKind = {
    brief: emptyBucket(),
    draft: emptyBucket(),
    repair: emptyBucket(),
  };
  const rows = [];
  for (const call of calls) {
    const kind = call.kind || classify(call.label);
    const usage = call.usage || {};
    const row = {
      label: call.label || "",
      kind,
      inputTokens: usage.input_tokens || 0,
      outputTokens: usage.output_tokens || 0,
      totalTokens: usage.total_tokens || 0,
      reasoningTokens: usage.output_tokens_details?.reasoning_tokens || 0,
      cachedTokens: usage.input_tokens_details?.cached_tokens || 0,
      elapsedMs: Number(call.elapsedMs) || 0,
    };
    rows.push(row);
    for (const bucket of [total, byKind[kind]]) {
      bucket.calls += 1;
      bucket.inputTokens += row.inputTokens;
      bucket.outputTokens += row.outputTokens;
      bucket.totalTokens += row.totalTokens;
      bucket.reasoningTokens += row.reasoningTokens;
      bucket.cachedTokens += row.cachedTokens;
      bucket.elapsedMs += row.elapsedMs;
    }
  }
  const pct = (value, denom) =>
    denom > 0 ? Number(((value / denom) * 100).toFixed(1)) : 0;
  return {
    total,
    byKind,
    rows,
    cacheHitPct: pct(total.cachedTokens, total.inputTokens),
    reasoningPctOfOutput: pct(total.reasoningTokens, total.outputTokens),
    repairTokenPct: pct(byKind.repair.totalTokens, total.totalTokens),
    repairTimePct: pct(byKind.repair.elapsedMs, total.elapsedMs),
    avgTokensPerCall:
      total.calls > 0 ? Math.round(total.totalTokens / total.calls) : 0,
  };
}
