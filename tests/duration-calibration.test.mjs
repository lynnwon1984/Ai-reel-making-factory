import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  analyzePlanDurationBudget,
  estimateShotContentBudget,
} from "../src/duration-calibration.js";
import {
  getScenePlanPolicy,
  parseScenePlan,
} from "../src/scene-engine.js";

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const ACTION_UNIT_RUN = JSON.parse(
  readFileSync(path.join(DIR, "director-action-units-chunk1.raw.json"), "utf8"),
);

test("时长预算：台词、动作微单元和最短 shot 分别计入", () => {
  const sceneInput = {
    blocks: [
      {
        id: "B01",
        kind: "action",
        text: "动作",
        source: "动作",
        actionUnits: [
          { id: "B01.1", text: "抬眼", source: "抬眼" },
          { id: "B01.2", text: "转身", source: "转身" },
        ],
      },
      {
        id: "B02",
        kind: "dialogue",
        text: "走吧",
        source: "角色：走吧",
      },
    ],
  };
  const shot = {
    duration: 5,
    clips: [
      {
        duration: 5,
        sourceBlockIds: ["B02"],
        actionUnitIds: ["B01.1", "B01.2"],
      },
    ],
  };
  const result = estimateShotContentBudget(
    shot,
    sceneInput,
    getScenePlanPolicy("flexible6"),
  );
  assert.equal(result.actionUnits, 2);
  assert.equal(result.dialogueBlocks, 1);
  assert.equal(result.actionSec, 1.6);
  assert.ok(result.dialogueSec > 0.8);
  assert.equal(result.suggestedDurationSec, 5);
  assert.equal(result.status, "fit");
});

test("时长标定：真实 v3 分块只发现一个内容预算偏紧的 shot", () => {
  const sceneInput = JSON.parse(ACTION_UNIT_RUN.input);
  const plan = parseScenePlan(ACTION_UNIT_RUN.output);
  const result = analyzePlanDurationBudget(
    plan,
    sceneInput,
    getScenePlanPolicy("flexible6"),
  );
  assert.equal(result.shots.length, 5);
  assert.equal(result.contentTotal, 19.6);
  assert.equal(result.suggestedTotal, 27);
  assert.equal(result.actualTotal, 25);
  assert.equal(result.shortShots, 1);
  assert.equal(result.shots.at(-1).status, "short");
  assert.equal(result.shots.at(-1).deficitSec, 1);
});

test("时长标定结果可重复：同一计划连续计算两次数值一致", () => {
  const sceneInput = JSON.parse(ACTION_UNIT_RUN.input);
  const plan = parseScenePlan(ACTION_UNIT_RUN.output);
  const policy = getScenePlanPolicy("flexible6");
  const a = analyzePlanDurationBudget(plan, sceneInput, policy);
  const b = analyzePlanDurationBudget(plan, sceneInput, policy);
  assert.deepEqual(a, b);
});
