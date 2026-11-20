import { test } from "node:test";
import assert from "node:assert/strict";

import {
  applyShotRepairPlan,
  buildShotRepairRequest,
  collectShotRepairTargets,
  renderShotRepairInstructions,
} from "../src/shot-repair.js";

const PLAN = {
  schemaVersion: 3,
  sceneId: "1-1",
  shots: [
    {
      duration: 5,
      purpose: "建立人物位置",
      clips: [
        {
          duration: 5,
          visualAction: "林岚坐在桌后。",
          actionUnitIds: ["B01.1"],
        },
      ],
    },
    {
      duration: 5,
      purpose: "完成发现",
      clips: [
        {
          duration: 5,
          visualAction: "林岚看到来信。",
        },
      ],
    },
    {
      duration: 5,
      purpose: "给出反应",
      clips: [
        {
          duration: 5,
          visualAction: "林岚抬头。",
          actionUnitIds: ["B03.1"],
        },
      ],
    },
  ],
};

const ISSUES = [
  { level: "高", where: "1-1 shot2 Clip A", msg: "没有源引用" },
  { level: "高", where: "1-1 shot2", msg: "缺少状态变化" },
  { level: "中", where: "1-1", msg: "中景占比过高" },
];

test("定点修复：只选中问题 shot，邻镜仅作为上下文", () => {
  const targets = collectShotRepairTargets(PLAN, ISSUES);
  assert.deepEqual(targets.targetIndexes, [2]);
  assert.deepEqual(targets.contextIndexes, [1, 3]);
  assert.equal(targets.targetedIssues.length, 2);
  assert.equal(targets.globalIssues.length, 1);
});

test("定点修复：请求只带问题 shot 和协议，不再重发整版计划", () => {
  const request = buildShotRepairRequest({
    initialInput: '{"sceneId":"1-1","blocks":[]}',
    plan: PLAN,
    issues: ISSUES,
    expectedSchemaVersion: 3,
  });
  assert.match(request, /shot_replacements_v1/);
  assert.match(request, /"replaceableShotIndexes": \[\s*2\s*\]/);
  assert.match(request, /"shotIndex": 2/);
  assert.doesNotMatch(request, /【上一版镜头计划】/);
  assert.match(request, /不得返回整版镜头计划/);
});

test("定点修复：整场问题无法定位 shot 时仍有明确兜底", () => {
  const targets = collectShotRepairTargets(PLAN, [
    {
      level: "高",
      where: "1-1",
      msg: "源内容重复引用：B01.1",
    },
  ]);
  assert.equal(targets.fallback, "mentioned-source");
  assert.deepEqual(targets.targetIndexes, [1]);
});

test("定点修复：系统指令明确禁止重新输出整版计划", () => {
  const instructions = renderShotRepairInstructions("原始镜头计划规则");
  assert.match(instructions, /本次调用优先/);
  assert.match(instructions, /不要输出 schemaVersion 3 的整版 scene plan/);
  assert.match(instructions, /replaceableShotIndexes/);
});

test("定点修复：替换范围必须合法、不能重叠", () => {
  const replacement = {
    repairProtocol: "shot_replacements_v1",
    sceneId: "1-1",
    replacements: [
      {
        startShotIndex: 2,
        endShotIndex: 2,
        reason: "补齐动作和引用",
        shots: [{ ...PLAN.shots[1], duration: 6 }],
      },
    ],
  };
  const result = applyShotRepairPlan(PLAN, replacement);
  assert.equal(result.mode, "shot-replacements");
  assert.equal(result.plan.shots.length, 3);
  assert.equal(result.plan.shots[1].duration, 6);
  assert.deepEqual(
    result.plan.shots.map((shot) => shot.shotIndex),
    [1, 2, 3],
  );

  assert.throws(
    () =>
      applyShotRepairPlan(PLAN, {
        ...replacement,
        replacements: [
          replacement.replacements[0],
          {
            startShotIndex: 2,
            endShotIndex: 3,
            shots: [PLAN.shots[1]],
          },
        ],
      }),
    /重叠/,
  );
  assert.throws(
    () =>
      applyShotRepairPlan(PLAN, {
        ...replacement,
        replacements: [
          {
            startShotIndex: 4,
            endShotIndex: 4,
            shots: [PLAN.shots[1]],
          },
        ],
      }),
    /超出/,
  );
});

test("定点修复：兼容模型意外返回整版计划的旧路径", () => {
  const result = applyShotRepairPlan(PLAN, {
    ...PLAN,
    shots: PLAN.shots.map((shot) => ({ ...shot })),
  });
  assert.equal(result.mode, "full-plan-compat");
});
