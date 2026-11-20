import { test } from "node:test";
import assert from "node:assert/strict";

import { summarizeModelCalls } from "../src/run-metrics.js";

test("运行指标：区分提示单、首稿和修复调用", () => {
  const metrics = summarizeModelCalls([
    {
      label: "导演提示单 1-1",
      usage: { input_tokens: 100, output_tokens: 20, total_tokens: 120 },
      elapsedMs: 10,
    },
    {
      label: "导演版分镜 1-1",
      usage: {
        input_tokens: 200,
        output_tokens: 80,
        total_tokens: 280,
        output_tokens_details: { reasoning_tokens: 50 },
        input_tokens_details: { cached_tokens: 60 },
      },
      elapsedMs: 30,
    },
    {
      label: "导演版分镜修复 1-1",
      usage: { input_tokens: 150, output_tokens: 50, total_tokens: 200 },
      elapsedMs: 20,
    },
  ]);
  assert.equal(metrics.total.calls, 3);
  assert.equal(metrics.byKind.brief.calls, 1);
  assert.equal(metrics.byKind.draft.calls, 1);
  assert.equal(metrics.byKind.repair.calls, 1);
  assert.equal(metrics.cacheHitPct, 13.3);
  assert.equal(metrics.reasoningPctOfOutput, 33.3);
  assert.equal(metrics.repairTokenPct, 33.3);
});
