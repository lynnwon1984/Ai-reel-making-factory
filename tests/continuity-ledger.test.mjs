import test from "node:test";
import assert from "node:assert/strict";

import { auditHandContinuity, heldItems } from "../src/continuity-ledger.js";

test("持物账本：能拆出左右手持物", () => {
  assert.deepEqual(heldItems("休斯右手拿着一串烤肉，左手托着火球。"), [
    { side: "右手", object: "一串烤肉" },
    { side: "左手", object: "火球" },
  ]);
});

test("持物账本：右手换到左手且没有来源动作 → 高危", () => {
  const result = auditHandContinuity({
    shots: [
      { endState: "休斯右手拿着烤肉串。" },
      {
        startState: "休斯左手拿着烤肉串。",
        continuityNote: "承接上一镜。",
        clips: [{ visualAction: "休斯继续说话。" }],
      },
    ],
  });
  assert.equal(result.issues.length, 1);
  assert.match(result.issues[0].msg, /持物换手无来源/);
});

test("持物账本：写了换手动作 → 不报", () => {
  const result = auditHandContinuity({
    shots: [
      { endState: "休斯右手拿着烤肉串。" },
      {
        startState: "休斯左手拿着烤肉串。",
        continuityNote: "承接上一镜，休斯把烤肉串换到左手。",
        clips: [{ visualAction: "休斯继续说话。" }],
      },
    ],
  });
  assert.deepEqual(result.issues, []);
});

test("持物账本：不同物件不误报", () => {
  const result = auditHandContinuity({
    shots: [
      { endState: "休斯右手拿着烤肉串。" },
      {
        startState: "休斯左手托着火球。",
        continuityNote: "休斯左手凝聚火球，右手仍持烤肉。",
        clips: [{ visualAction: "休斯说话。" }],
      },
    ],
  });
  assert.deepEqual(result.issues, []);
});

test("持物账本：同一句写左手烤肉、右手火焰，不会被错误串到同一边", () => {
  assert.deepEqual(
    heldItems("休斯左手的烤肉串垂在身侧，右掌在胸前托着火焰。"),
    [
      { side: "左手", object: "烤肉串" },
      { side: "右掌", object: "火焰" },
    ],
  );
});
