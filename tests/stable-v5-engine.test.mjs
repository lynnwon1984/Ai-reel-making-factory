import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runStableV5Script } from "../src/stable-v5-engine.js";

const SCRIPT = `第1集：测试
1-1 办公室 内 日
人物：林岚（Lin，着装：白衬衫）、访客（Visitor，着装：深色外套）
△林岚坐在桌后，盯着手机。
林岚（压低声音）：Who's there?
△门被推开，访客站在门口。
△访客把一个信封放在桌上。
林岚（O.S.）（警觉）：That's not my name.
`;

const SHOT1 = {
  duration: 6,
  cast: ["林岚"],
  props: ["手机"],
  startState: "林岚坐在桌后，右手持手机，视线落在门方向。",
  stateChange: "林岚低头看手机后抬眼质问门口。",
  endState: "林岚仍坐在桌后，右手持手机，视线落在门口。",
  cameraReason: "固定近景让手机和门口视线同时可读。",
  continuityNote: "场首。林岚坐在桌后，右手持手机。",
  clips: [
    {
      duration: 6,
      size: "MCU",
      cameraMove: "固定机位",
      visualAction: "林岚低头看手机，随后抬眼质问门口。",
      beat: "警觉",
      actionUnitIds: ["B01.1", "B01.2"],
      sourceBlockIds: ["B02"],
    },
  ],
};

const SHOT2 = {
  duration: 8,
  cast: ["林岚", "访客"],
  props: ["信封"],
  startState: "林岚坐在桌后看向门口，右手持手机；访客尚未入画。",
  stateChange: "访客推门进入，把信封放在桌面。",
  endState: "林岚仍在桌后，右手持手机；访客站在桌前，信封落在桌面。",
  cameraReason: "固定中景交代门口到桌面的完整动线。",
  continuityNote: "承接林岚看向门口，访客从门口入画并走到桌前。",
  clips: [
    {
      duration: 4,
      size: "MCU",
      cameraMove: "固定机位",
      visualAction: "门被推开，访客站在门口。",
      beat: "进入",
      actionUnitIds: ["B03.1", "B03.2"],
    },
    {
      duration: 4,
      size: "MCU",
      cameraMove: "固定机位",
      visualAction: "访客走到桌前，把信封放在桌面，林岚开口。",
      beat: "递信",
      actionUnitIds: ["B04.1"],
      sourceBlockIds: ["B05"],
    },
  ],
};

function plan(shots) {
  return {
    schemaVersion: 4,
    sceneId: "1-1",
    shots: structuredClone(shots),
  };
}

test("稳定 v5：模型只出计划，最终 Markdown 由本地编译", async () => {
  const calls = [];
  const result = await runStableV5Script({
    text: SCRIPT,
    planInstructions: "测试用镜头计划规则",
    callModel: async (args) => {
      calls.push(args);
      return { text: JSON.stringify(plan([SHOT1, SHOT2])) };
    },
  });
  assert.equal(calls.length, 1);
  assert.match(calls[0].instructions, /测试用镜头计划规则/);
  assert.match(calls[0].input, /B01\.1/);
  assert.match(result.text, /EN: 林岚: "Who's there\?"/);
  assert.match(result.text, /EN: 林岚（O\.S\.）: "That's not my name\."/);
  assert.match(result.text, /把信封放在桌面/);
  assert.equal(result.issues.length, 0);
  assert.equal(result.stats.chunks, 1);
});

test("稳定 v5：首稿漏动作微单元时，只请求问题 shot 的替换包", async () => {
  const calls = [];
  const brokenShot2 = structuredClone(SHOT2);
  brokenShot2.clips = [
    {
      duration: 8,
      size: "MCU",
      cameraMove: "固定机位",
      visualAction: "门被推开，访客站在门口。",
      beat: "进入",
      actionUnitIds: ["B03.1", "B03.2"],
    },
  ];
  const repair = {
    repairProtocol: "shot_replacements_v1",
    sceneId: "1-1",
    schemaVersion: 4,
    replacements: [
      {
        startShotIndex: 2,
        endShotIndex: 2,
        reason: "补回漏掉的递信动作和台词",
        shots: [SHOT2],
      },
    ],
  };
  const result = await runStableV5Script({
    text: SCRIPT,
    planInstructions: "测试用镜头计划规则",
    callModel: async (args) => {
      calls.push(args);
      return {
        text: JSON.stringify(
          calls.length === 1 ? plan([SHOT1, brokenShot2]) : repair,
        ),
      };
    },
  });
  assert.equal(calls.length, 2);
  assert.match(calls[1].label, /定点修复 r1/);
  assert.match(calls[1].input, /shot_replacements_v1/);
  assert.match(calls[1].input, /B04\.1/);
  assert.match(result.text, /That's not my name/);
  assert.equal(result.stats.high, 0);
});

test("稳定 v5：Schema 契约锁定轻量字段和动作/台词引用", () => {
  const file = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "../src/schemas/stable-plan-v4.schema.json",
  );
  const schema = JSON.parse(readFileSync(file, "utf8"));
  assert.equal(schema.properties.schemaVersion.const, 4);
  assert.deepEqual(schema.properties.shots.items.required, [
    "duration",
    "cast",
    "props",
    "startState",
    "stateChange",
    "endState",
    "cameraReason",
    "continuityNote",
    "clips",
  ]);
  const clip = schema.properties.shots.items.properties.clips.items;
  assert.equal(clip.properties.duration.minimum, 4);
  assert.equal(clip.properties.duration.maximum, 15);
  assert.ok(
    clip.anyOf.some((variant) => variant.required?.includes("actionUnitIds")),
  );
  assert.ok(
    clip.anyOf.some((variant) => variant.required?.includes("sourceBlockIds")),
  );
});
