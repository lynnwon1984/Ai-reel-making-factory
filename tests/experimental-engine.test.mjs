import { test } from "node:test";
import assert from "node:assert/strict";

import { runExperimentalScript } from "../src/experimental-engine.js";

const SCRIPT = `第1集：测试
1-1 房间 内 日
人物：林岚（Lin，着装：白衬衫）
△林岚坐在桌后，盯着手机。
林岚（压低声音）：Who's there?
`;

const BRIEF = JSON.stringify({
  directorBrief: {
    dramaticQuestion: "门外是谁？",
    desire: "林岚想确认来客身份。",
    obstacle: "门外的人没有现身。",
    powerBefore: "林岚暂时掌握室内空间。",
    powerAfter: "未知来客让林岚失去确定感。",
    informationReveal: "林岚先开口询问门外的人。",
    visualCore: "桌后的手机与门口形成声音来源。",
    keyProp: "手机在桌后。",
    startHook: "林岚盯着手机。",
    endHook: "门外问题没有回答。",
  },
  sceneGeography: {
    anchors: ["办公桌", "门"],
    powerPosition: "林岚在桌后，门控制进出。",
    axis: "林岚与门外声音相对。",
    workingSide: "机位在桌子侧面。",
  },
});

const PLAN = JSON.stringify({
  schemaVersion: 3,
  sceneId: "1-1",
  shots: [
    {
      duration: 5,
      purpose: "让林岚的等待被门外声音打断",
      storyFunction: "pressure",
      cast: ["林岚"],
      props: ["手机"],
      startState: "林岚坐在桌后，手机在手中。",
      stateChange: "林岚听见声音，抬眼看向门口。",
      endState: "林岚仍坐在桌后，视线转向门口。",
      cameraReason: "固定近景让问句落向画外门口。",
      continuityNote: "场首。建立林岚在桌后和视线方向。",
      clips: [
        {
          duration: 5,
          size: "MCU",
          cameraMove: "固定机位",
          visualAction: "林岚盯着手机，随后抬眼看向门口并低声开口。",
          actionUnitIds: ["B01.1", "B01.2"],
          sourceBlockIds: ["B02"],
        },
      ],
    },
  ],
});

test("实验引擎：按导演提示单和 Schema v3 生成标准分镜剧本", async () => {
  const labels = [];
  const progress = [];
  const result = await runExperimentalScript({
    text: SCRIPT,
    briefInstructions: "导演提示单",
    sceneInstructions: "镜头计划",
    callModel: async ({ label }) => {
      labels.push(label);
      return { text: /导演提示单/.test(label) ? BRIEF : PLAN };
    },
    onProgress: (item) => progress.push(item),
  });
  assert.equal(labels.length, 2);
  assert.match(result.text, /^第1集：测试/);
  assert.match(result.text, /【分镜01】/);
  assert.match(result.text, /EN: 林岚: "Who's there\?"/);
  assert.equal(result.stats.episodes, 1);
  assert.equal(result.stats.scenes, 1);
  assert.equal(result.stats.chunks, 1);
  assert.ok(progress.some((item) => item.stage === "brief"));
  assert.ok(progress.some((item) => item.stage === "plan"));
});

test("实验引擎：已完成的集可跳过模型调用", async () => {
  let calls = 0;
  const result = await runExperimentalScript({
    text: SCRIPT,
    briefInstructions: "导演提示单",
    sceneInstructions: "镜头计划",
    completedEpisodes: { 1: "第1集：已有结果\n【分镜01】" },
    callModel: async () => {
      calls += 1;
      return { text: PLAN };
    },
  });
  assert.equal(calls, 0);
  assert.match(result.text, /已有结果/);
});

test("实验引擎：已完成场可跳过，未完成场继续调用", async () => {
  let calls = 0;
  const result = await runExperimentalScript({
    text: SCRIPT,
    briefInstructions: "导演提示单",
    sceneInstructions: "镜头计划",
    completedScenes: {
      "1:1-1": {
        sceneText: "【分镜01】\n[shot01 | 时长：5秒]",
        stats: {
          scene: "1-1",
          validation: { issues: [], stats: { shots: 1 } },
        },
      },
    },
    callModel: async () => {
      calls += 1;
      return { text: PLAN };
    },
  });
  assert.equal(calls, 0);
  assert.match(result.text, /【分镜01】/);
});

test("实验引擎：高危问题只发问题 shot，并接受替换计划", async () => {
  const brokenPlan = {
    schemaVersion: 3,
    sceneId: "1-1",
    shots: [
      {
        duration: 5,
        purpose: "建立林岚在桌后的等待",
        storyFunction: "establish",
        cast: ["林岚"],
        props: ["手机", "桌子"],
        startState: "林岚坐在桌后，手机在手中。",
        stateChange: "林岚继续盯着手机。",
        endState: "林岚坐在桌后，视线仍在手机上。",
        cameraReason: "固定近景先建立等待状态。",
        continuityNote: "场首。林岚坐在桌后，手机在手中。",
        clips: [
          {
            duration: 5,
            size: "MCU",
            cameraMove: "固定机位",
            visualAction: "林岚坐在桌后盯着手机。",
            actionUnitIds: ["B01.1"],
          },
        ],
      },
      {
        duration: 5,
        purpose: "让门外问句打破等待",
        storyFunction: "pressure",
        cast: ["林岚"],
        props: ["手机"],
        startState: "林岚坐在桌后，视线离开手机。",
        stateChange: "林岚听见门外声音。",
        endState: "林岚抬眼看向门口。",
        cameraReason: "固定近景把问句落向画外门口。",
        continuityNote: "承接林岚仍在桌后；门外声音进入。",
        clips: [
          {
            duration: 5,
            size: "MCU",
            cameraMove: "固定机位",
            visualAction: "林岚听见问句后抬眼。",
          },
        ],
      },
    ],
  };
  const replacement = {
    repairProtocol: "shot_replacements_v1",
    sceneId: "1-1",
    schemaVersion: 3,
    replacements: [
      {
        startShotIndex: 2,
        endShotIndex: 2,
        reason: "补齐门外台词的源引用",
        shots: [
          {
            ...brokenPlan.shots[1],
            clips: [
              {
                duration: 5,
                size: "MCU",
                cameraMove: "固定机位",
                visualAction: "林岚听见门外问句后抬眼。",
                actionUnitIds: ["B01.2"],
                sourceBlockIds: ["B02"],
              },
            ],
          },
        ],
      },
    ],
  };

  const labels = [];
  const repairInputs = [];
  const repairInstructions = [];
  const result = await runExperimentalScript({
    text: SCRIPT,
    briefInstructions: "导演提示单",
    sceneInstructions: "镜头计划",
    callModel: async ({ label, input, instructions }) => {
      labels.push(label);
      if (/定点修复/.test(label)) {
        repairInputs.push(input);
        repairInstructions.push(instructions);
        return { text: JSON.stringify(replacement) };
      }
      return {
        text: /导演提示单/.test(label)
          ? BRIEF
          : JSON.stringify(brokenPlan),
      };
    },
  });

  assert.equal(labels.filter((label) => /定点修复/.test(label)).length, 1);
  assert.match(repairInputs[0], /shot_replacements_v1/);
  assert.doesNotMatch(repairInputs[0], /【上一版镜头计划】/);
  assert.match(repairInstructions[0], /本次调用优先/);
  assert.match(result.text, /EN: 林岚: "Who's there\?"/);
  assert.equal(result.issues.filter((issue) => issue.level === "高").length, 0);
});

test("实验引擎：修复后仍有高危时，只对残余问题再修一轮", async () => {
  const validPlan = JSON.parse(PLAN);
  const brokenPlan = structuredClone(validPlan);
  brokenPlan.shots[0].clips[0].sourceBlockIds = [];
  brokenPlan.shots[0].clips[0].actionUnitIds = [];
  const replacementFor = (shot) => ({
    repairProtocol: "shot_replacements_v1",
    sceneId: "1-1",
    schemaVersion: 3,
    replacements: [
      {
        startShotIndex: 1,
        endShotIndex: 1,
        reason: "恢复源引用",
        shots: [shot],
      },
    ],
  });

  let planCalls = 0;
  const repairInputs = [];
  const result = await runExperimentalScript({
    text: SCRIPT,
    briefInstructions: "导演提示单",
    sceneInstructions: "镜头计划",
    maxRepairRounds: 2,
    callModel: async ({ label, input }) => {
      if (/导演提示单/.test(label)) return { text: BRIEF };
      if (/镜头计划/.test(label)) {
        planCalls += 1;
        return { text: JSON.stringify(brokenPlan) };
      }
      repairInputs.push(input);
      return {
        text: JSON.stringify(
          replacementFor(
            repairInputs.length === 1
              ? brokenPlan.shots[0]
              : validPlan.shots[0],
          ),
        ),
      };
    },
  });

  assert.equal(planCalls, 1);
  assert.equal(repairInputs.length, 2);
  assert.match(repairInputs[1], /源内容未覆盖/);
  assert.equal(result.issues.filter((issue) => issue.level === "高").length, 0);
});
