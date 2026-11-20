import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseScript } from "../src/split.js";
import {
  ACTION_UNIT_SCHEMA_VERSION,
  analyzeDirectorFields,
  auditShotActionDensity,
  auditShotContinuity,
  auditShotResponsibilities,
  buildSceneInput,
  arbitrateShotTimeline,
  DIRECTOR_SCHEMA_VERSION,
  parseScenePlan,
  renderScenePlanPrompt,
  renderSceneInput,
  splitSceneInput,
  mergeScenePlans,
  repairScenePlan,
  validateDirectorBrief,
  validateScenePlan,
  compileScenePlan,
  SCENE_PLAN_POLICIES,
} from "../src/scene-engine.js";
import { runEngineQc } from "../src/qc-engine.js";

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const MODEL_RUN = JSON.parse(readFileSync(path.join(DIR, "scene-plan-1-1.raw.json"), "utf8"));
const FLEX_RUN = JSON.parse(
  readFileSync(path.join(DIR, "scene-plan-1-1-flexible6.raw.json"), "utf8"),
);
const CHUNKED_FLEX_RUN = JSON.parse(
  readFileSync(path.join(DIR, "scene-plan-1-1-chunked-flexible6.plan.json"), "utf8"),
);
const DIRECTOR_BRIEF_RUN = JSON.parse(
  readFileSync(path.join(DIR, "director-pilot-1-1-brief.raw.json"), "utf8"),
);
const DIRECTOR_CHUNK_RUN = JSON.parse(
  readFileSync(path.join(DIR, "director-pilot-1-1-chunk1.raw.json"), "utf8"),
);
const DIRECTOR_OFFICIAL_RUN = JSON.parse(
  readFileSync(path.join(DIR, "director-official-rules-chunk1.raw.json"), "utf8"),
);
const DIRECTOR_ACTION_UNIT_RUN = JSON.parse(
  readFileSync(path.join(DIR, "director-action-units-chunk1.raw.json"), "utf8"),
);

const SCRIPT = `第1集：测试
1-1 办公室 内 日
人物：林岚（Lin，着装：白衬衫）、访客（Visitor，着装：深色外套）
△林岚坐在桌后，盯着手机。
林岚（压低声音）：Who's there?
△门被推开，访客站在门口。
△访客把一个信封放在桌上。
林岚（O.S.）（警觉）：That's not my name.
`;

const PLAN = {
  sceneId: "1-1",
  shots: [
    {
      duration: 10,
      cast: ["林岚"],
      props: ["手机"],
      startPosition: "林岚坐在桌后，手机在手中；访客尚未入画。",
      clips: [
        {
          duration: 5,
          size: "MCU",
          cameraMove: "缓慢推近",
          visualAction: "林岚低头盯着手机，手指停住。",
          beat: "建立",
          sourceBlockIds: ["B01", "B02"],
        },
        {
          duration: 5,
          size: "CU",
          cameraMove: "固定机位",
          visualAction: "林岚抬眼，视线转向门口。",
          beat: "反应",
          sourceBlockIds: ["B03"],
        },
      ],
    },
    {
      duration: 8,
      cast: ["林岚", "访客"],
      props: ["信封"],
      startPosition: "林岚坐在桌后，访客站在门口，门已打开。",
      clips: [
        {
          duration: 8,
          size: "MCU",
          cameraMove: "固定机位",
          visualAction: "访客向前一步，把信封放在桌上。",
          beat: "揭示",
          sourceBlockIds: ["B04", "B05"],
        },
      ],
    },
  ],
};

const DIRECTOR_BRIEF = {
  dramaticQuestion: "林岚能否确认门外来客是否知道她的真实身份？",
  desire: "林岚想确认对方身份并保持主动。",
  obstacle: "访客掌握她不知道的信息，并且已经进入房间。",
  powerBefore: "林岚坐在桌后，掌握室内空间和手机。",
  powerAfter: "访客递出信封后，信息主动权转向访客。",
  informationReveal: "访客知道林岚另一个名字，并在递出信封时揭示这一点。",
  visualCore: "桌后的手机与桌面上的信封形成信息交换。",
  keyProp: "信封：从访客手中转移到桌面。",
  startHook: "林岚盯着手机，警觉门外动静。",
  endHook: "信封落到桌上，身份问题仍未解决。",
};

const SCENE_GEOGRAPHY = {
  anchors: ["办公桌", "房门", "桌后的座椅"],
  powerPosition: "林岚坐在桌后；访客站在门口，控制进入和离开的通道。",
  axis: "林岚与访客隔着办公桌相对。",
  workingSide: "机位在办公桌侧面，保持两人分居画面左右。",
};

const ACTION_UNIT_PLAN = {
  schemaVersion: ACTION_UNIT_SCHEMA_VERSION,
  sceneId: "1-1",
  shots: [
    {
      duration: 6,
      purpose: "用林岚等待和第一句质问建立警觉",
      storyFunction: "pressure",
      cast: ["林岚"],
      props: ["手机"],
      startState: "林岚坐在桌后，右手持手机，访客尚未入画。",
      stateChange: "林岚从盯手机转为低声质问门外。",
      endState: "林岚仍坐在桌后，手机在手中，视线转向门口。",
      cameraReason: "缓慢推近，让质问落下时靠近林岚的反应。",
      continuityNote: "场首。保持林岚在桌后、手机在右手。",
      clips: [
        {
          duration: 6,
          size: "MCU",
          cameraMove: "缓慢推近",
          visualAction: "林岚坐在桌后盯着手机，随后抬眼低声质问。",
          actionUnitIds: ["B01.1", "B01.2"],
          sourceBlockIds: ["B02"],
        },
      ],
    },
    {
      duration: 7,
      purpose: "让访客进门并把信封放下，完成主动权转移",
      storyFunction: "shift",
      cast: ["林岚", "访客"],
      props: ["信封"],
      startState: "林岚坐在桌后看向门口，访客尚未入画。",
      stateChange: "访客推门进入，把信封放在桌面。",
      endState: "林岚仍在桌后，访客站在桌前，信封落在桌面。",
      cameraReason: "固定机位让观众看清门口到桌面的空间变化。",
      continuityNote: "承接林岚看向门口；下一镜从信封已在桌面开始。",
      clips: [
        {
          duration: 3,
          size: "MCU",
          cameraMove: "固定机位",
          visualAction: "门被推开，访客站在门口。",
          actionUnitIds: ["B03.1", "B03.2"],
        },
        {
          duration: 4,
          size: "MCU",
          cameraMove: "固定机位",
          visualAction: "访客走到桌前放下信封，林岚开口。",
          actionUnitIds: ["B04.1"],
          sourceBlockIds: ["B05"],
        },
      ],
    },
  ],
};

function sceneFixture() {
  const parsed = parseScript(SCRIPT);
  const episode = parsed.episodes[0];
  const scene = episode.scenes[0];
  return { episode, scene, input: buildSceneInput({ episode, scene }) };
}

function directedPlan() {
  const plan = structuredClone(PLAN);
  plan.schemaVersion = DIRECTOR_SCHEMA_VERSION;
  plan.directorBrief = structuredClone(DIRECTOR_BRIEF);
  plan.sceneGeography = structuredClone(SCENE_GEOGRAPHY);
  plan.shots[0].purpose = "用手机来信让林岚进入警觉";
  plan.shots[0].storyFunction = "pressure";
  plan.shots[0].startState = plan.shots[0].startPosition;
  plan.shots[0].stateChange = "林岚从低头看手机转为抬眼看向门口。";
  plan.shots[0].endState = "林岚坐在桌后，手机仍在手中，视线落向门口。";
  plan.shots[0].cameraReason = "推近让观众靠近林岚确认信息的反应。";
  plan.shots[0].continuityNote = "场首。保持林岚在桌后、手机在手中。";
  plan.shots[1].purpose = "用递信封完成信息主动权转移";
  plan.shots[1].storyFunction = "shift";
  plan.shots[1].startState = "林岚坐在桌后看向门口，访客站在门边。";
  plan.shots[1].stateChange = "访客走到桌前，把信封放在桌面。";
  plan.shots[1].endState = "林岚仍在桌后，访客站在桌前，信封落在桌面。";
  plan.shots[1].cameraReason = "固定机位让观众看清信封落桌和两人的距离变化。";
  plan.shots[1].continuityNote = "承接林岚看向门口；下一镜从信封已在桌面开始。";
  return plan;
}

test("场景输入：源块编号连续，台词保留原文", () => {
  const { input } = sceneFixture();
  assert.equal(input.sceneId, "1-1");
  assert.equal(input.aspectRatio, "9:16");
  assert.equal("directorBrief" in input, false);
  assert.equal("sceneGeography" in input, false);
  assert.deepEqual(input.blocks.map((block) => block.id), ["B01", "B02", "B03", "B04", "B05"]);
  assert.equal(input.blocks[1].kind, "dialogue");
  assert.equal(input.blocks[1].text, "Who's there?");
});

test("场景输入：传入导演上下文时才启用 Schema v2 必要上下文", () => {
  const parsed = parseScript(SCRIPT);
  const episode = parsed.episodes[0];
  const scene = episode.scenes[0];
  const input = buildSceneInput({
    episode,
    scene,
    directorBrief: DIRECTOR_BRIEF,
    sceneGeography: SCENE_GEOGRAPHY,
  });
  assert.deepEqual(input.directorBrief, DIRECTOR_BRIEF);
  assert.deepEqual(input.sceneGeography, SCENE_GEOGRAPHY);
});

test("模型输入：去掉重复展示字段，稳定上下文排在变化内容之前", () => {
  const parsed = parseScript(SCRIPT);
  const episode = parsed.episodes[0];
  const input = buildSceneInput({
    episode,
    scene: episode.scenes[0],
    directorBrief: DIRECTOR_BRIEF,
    sceneGeography: SCENE_GEOGRAPHY,
  });
  const rendered = renderSceneInput(input);
  const modelInput = JSON.parse(rendered);
  assert.deepEqual(Object.keys(modelInput).slice(0, 7), [
    "aspectRatio",
    "sceneId",
    "episode",
    "sceneHeading",
    "castNames",
    "directorBrief",
    "sceneGeography",
  ]);
  assert.equal("cast" in modelInput, false);
  assert.equal(rendered.includes('"source"'), false);
  assert.equal(rendered.includes('"blockId"'), false);
  assert.ok(rendered.length < JSON.stringify(input, null, 2).length);
});

test("场景输入：人物行缺失时仍从台词说话人建立已知人物表", () => {
  const parsed = parseScript(SCRIPT);
  const episode = parsed.episodes[0];
  const scene = { ...episode.scenes[0], cast: "" };
  const input = buildSceneInput({ episode, scene });
  assert.deepEqual(input.castNames, ["林岚"]);
});

test("场景计划：合法的 JSON 计划通过校验", () => {
  const { input } = sceneFixture();
  const result = validateScenePlan(PLAN, input);
  assert.equal(result.issues.length, 0);
  assert.deepEqual(result.stats, {
    shots: 2,
    clips: 3,
    blocks: 5,
    widePct: 0,
    overloadedClips: 0,
    totalDuration: 18,
  });
});

test("导演版 Schema：完整字段通过，旧版计划继续兼容", () => {
  const { input } = sceneFixture();
  const directed = validateScenePlan(directedPlan(), input);
  const legacy = validateScenePlan(PLAN, input);
  assert.deepEqual(directed.issues, []);
  assert.deepEqual(legacy.issues, []);
});

test("导演版 Schema：缺职责、运镜理由和起止状态会被拦下", () => {
  const { input } = sceneFixture();
  const broken = directedPlan();
  delete broken.directorBrief.desire;
  delete broken.shots[0].purpose;
  delete broken.shots[0].cameraReason;
  delete broken.shots[0].endState;
  broken.shots[1].storyFunction = "装饰";
  const result = validateScenePlan(broken, input);
  assert.ok(result.issues.some((issue) => issue.msg.includes("导演提示单缺少 desire")));
  assert.ok(result.issues.some((issue) => issue.msg.includes("缺少镜头职责")));
  assert.ok(result.issues.some((issue) => issue.msg.includes("缺少运镜理由")));
  assert.ok(result.issues.some((issue) => issue.msg.includes("缺少终点状态")));
  assert.ok(result.issues.some((issue) => issue.msg.includes("不在允许值")));
});

test("动作微单元 Schema v3：动作和台词分别覆盖后通过", () => {
  const parsed = parseScript(SCRIPT);
  const episode = parsed.episodes[0];
  const input = buildSceneInput({
    episode,
    scene: episode.scenes[0],
    directorBrief: DIRECTOR_BRIEF,
    sceneGeography: SCENE_GEOGRAPHY,
  });
  const result = validateScenePlan(
    ACTION_UNIT_PLAN,
    input,
    SCENE_PLAN_POLICIES.flexible6,
  );
  assert.deepEqual(result.issues, []);
});

test("动作微单元 Schema v3：漏掉动作单元或退回整块引用都会被拦下", () => {
  const parsed = parseScript(SCRIPT);
  const episode = parsed.episodes[0];
  const input = buildSceneInput({
    episode,
    scene: episode.scenes[0],
    directorBrief: DIRECTOR_BRIEF,
    sceneGeography: SCENE_GEOGRAPHY,
  });
  const broken = structuredClone(ACTION_UNIT_PLAN);
  broken.shots[0].clips[0].actionUnitIds = ["B01.1"];
  broken.shots[1].clips[0].sourceBlockIds = ["B03"];
  const result = validateScenePlan(
    broken,
    input,
    SCENE_PLAN_POLICIES.flexible6,
  );
  assert.ok(result.issues.some((issue) => /B01\.2/.test(issue.msg)));
  assert.ok(result.issues.some((issue) => /必须用 actionUnitIds/.test(issue.msg)));
});

test("导演提示单：场景地理缺锚点时单独可校验", () => {
  const result = validateDirectorBrief(
    DIRECTOR_BRIEF,
    { ...SCENE_GEOGRAPHY, anchors: [] },
    "1-1",
  );
  assert.equal(result.issues.length, 1);
  assert.match(result.issues[0].msg, /anchors/);
});

test("导演字段统计：完整镜头和功能枚举分别计数", () => {
  const stats = analyzeDirectorFields(directedPlan());
  assert.equal(stats.schemaVersion, DIRECTOR_SCHEMA_VERSION);
  assert.equal(stats.shots, 2);
  assert.equal(stats.completeShots, 2);
  assert.equal(stats.completePct, 100);
  assert.equal(stats.validStoryFunction, 2);
  assert.equal(stats.hasDirectorBrief, true);
  assert.equal(stats.hasSceneGeography, true);
});

test("分镜提示词：竖屏导演版要求 v2 字段", () => {
  const prompt = readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/prompts/scene-plan.md"),
    "utf8",
  );
  assert.match(prompt, /9:16 竖屏/);
  assert.match(prompt, /"schemaVersion": 3/);
  assert.match(prompt, /actionUnitIds/);
  assert.match(prompt, /cameraReason/);
  assert.match(prompt, /startState/);
  assert.match(prompt, /动作阶段/);
  assert.match(prompt, /15 秒上限.*填满的目标/);
  assert.match(prompt, /拆成两个 shot/);
  assert.match(prompt, /只是同一动作的不同角度/);
  assert.match(prompt, /反应镜只有出现新的判断/);
  assert.match(prompt, /不得写“无”“同上”/);
  assert.match(prompt, /新人物进入/);
  assert.match(prompt, /你是 9:16 竖屏短剧/);
  assert.doesNotMatch(prompt, /16:9 横屏/);
});

test("导演版 JSON Schema：分镜和提示单契约可解析且字段一致", () => {
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/schemas");
  const planSchema = JSON.parse(
    readFileSync(path.join(root, "scene-plan-v2.schema.json"), "utf8"),
  );
  const briefSchema = JSON.parse(
    readFileSync(path.join(root, "director-brief-v1.schema.json"), "utf8"),
  );
  const actionUnitSchema = JSON.parse(
    readFileSync(path.join(root, "scene-plan-v3.schema.json"), "utf8"),
  );
  assert.equal(planSchema.properties.schemaVersion.const, DIRECTOR_SCHEMA_VERSION);
  assert.deepEqual(
    planSchema.properties.shots.items.required,
    [
      "duration",
      "purpose",
      "storyFunction",
      "cast",
      "props",
      "startState",
      "stateChange",
      "endState",
      "cameraReason",
      "continuityNote",
      "clips",
    ],
  );
  assert.deepEqual(
    briefSchema.properties.directorBrief.required,
    [
      "dramaticQuestion",
      "desire",
      "obstacle",
      "powerBefore",
      "powerAfter",
      "informationReveal",
      "visualCore",
      "keyProp",
      "startHook",
      "endHook",
    ],
  );
  assert.equal(actionUnitSchema.properties.schemaVersion.const, ACTION_UNIT_SCHEMA_VERSION);
  assert.ok(
    actionUnitSchema.properties.shots.items.properties.clips.items.anyOf.some(
      (variant) => variant.required?.includes("actionUnitIds"),
    ),
  );
});

test("动作密度审计：单个镜头中的复合运镜会被单独标出", () => {
  const audit = auditShotActionDensity(
    {
      shots: [
        {
          duration: 5,
          stateChange: "大魔导师抬眼。",
          clips: [
            {
              duration: 5,
              cameraMove: "快速下摇后固定",
              visualAction: "大魔导师抬眼看向天空。",
              sourceBlockIds: ["B01"],
            },
          ],
        },
      ],
    },
    {
      sceneId: "1-1",
      blocks: [{ id: "B01", kind: "action", source: "大魔导师抬眼看向天空。" }],
    },
  );
  assert.equal(audit.compoundCameraMoves, 1);
  assert.match(audit.issues[0].msg, /只指定一种主要运镜/);
});

test("场景计划：shot 级人物和道具只写本镜实际出现的对象", () => {
  const { input } = sceneFixture();
  const text = compileScenePlan(PLAN, input);
  assert.match(
    text,
    /\[shot01 \| 时长：10秒 \| 场景：办公室 内 日 \| 人物：林岚（Lin，着装：白衬衫） \| 道具：手机\]/,
  );
  assert.match(
    text,
    /\[shot02 \| 时长：8秒 \| 场景：办公室 内 日 \| 人物：林岚（Lin，着装：白衬衫）、访客（Visitor，着装：深色外套） \| 道具：信封\]/,
  );
});

test("场景计划：未登记人物和漏登记说话人会被拦下", () => {
  const { input } = sceneFixture();
  const broken = structuredClone(PLAN);
  broken.shots[0].cast = ["陌生人"];
  broken.shots[1].cast = ["访客"];
  const result = validateScenePlan(broken, input);
  assert.ok(result.issues.some((issue) => /未登记人物/.test(issue.msg)));
  assert.ok(result.issues.some((issue) => /说话人 林岚/.test(issue.msg)));
});

test("场景计划：台词块缺失、重复和超时都会被拦下", () => {
  const { input } = sceneFixture();
  const broken = structuredClone(PLAN);
  broken.shots[0].duration = 16;
  broken.shots[1].clips[0].sourceBlockIds = ["B04", "B04"];
  const result = validateScenePlan(broken, input);
  assert.ok(result.issues.some((issue) => /shot 时长/.test(issue.msg)));
  assert.ok(result.issues.some((issue) => /源块未覆盖/.test(issue.msg)));
  assert.ok(result.issues.some((issue) => /源块重复引用/.test(issue.msg)));
});

test("场景计划：一个 Clip 承接过多台词或动作时按内容预算拦下", () => {
  const { input } = sceneFixture();
  const broken = structuredClone(PLAN);
  broken.shots[0].clips[0].sourceBlockIds = ["B01", "B02", "B03"];
  broken.shots[0].clips[0].duration = 2;
  broken.shots[0].duration = 7;
  const result = validateScenePlan(broken, input);
  assert.ok(result.issues.some((issue) => /内容预算约/.test(issue.msg)));
});

test("编译器：台词由源块回填，不采用模型改写文本", () => {
  const { input } = sceneFixture();
  const text = compileScenePlan(PLAN, input);
  assert.match(text, /【分镜01】/);
  assert.match(text, /EN: 林岚: "Who's there\?"/);
  assert.match(text, /EN: 林岚（O\.S\.）: "That's not my name\."/);
  assert.doesNotMatch(text, /台词\{/);
});

test("解析器：容忍 Markdown JSON 围栏", () => {
  assert.deepEqual(parseScenePlan("```json\n{\"sceneId\":\"1-1\",\"shots\":[]}\n```"), {
    sceneId: "1-1",
    shots: [],
  });
});

test("解析器：容忍模型尾逗号，但不破坏字符串里的逗号", () => {
  const parsed = parseScenePlan(
    '{"sceneId":"1-1","note":"甲，乙","shots":[],}',
  );
  assert.equal(parsed.note, "甲，乙");
  assert.deepEqual(parsed.shots, []);
});

test("规则配置：严格 3 Clip 与灵活 6 Clip 会生成不同提示词", () => {
  const template = "{{shotMin}}-{{shotMax}} / {{clipMin}}-{{clipMax}} / {{maxClips}}";
  assert.equal(renderScenePlanPrompt(template, SCENE_PLAN_POLICIES.strict3), "5-15 / 4-15 / 3");
  assert.equal(renderScenePlanPrompt(template, SCENE_PLAN_POLICIES.flexible6), "5-15 / 2-8 / 6");
});

test("规则配置：灵活规则允许 6 个 2 秒 Clip，严格规则会拦下", () => {
  const input = {
    sceneId: "9-1",
    sceneHeading: "街口 外 夜",
    cast: "",
    castNames: [],
    blocks: Array.from({ length: 6 }, (_, index) => ({
      id: `B0${index + 1}`,
      kind: "action",
      text: `动作${index + 1}`,
    })),
  };
  const plan = {
    sceneId: "9-1",
    shots: [
      {
        duration: 12,
        cast: [],
        props: [],
        startPosition: "空镜。",
        clips: Array.from({ length: 6 }, (_, index) => ({
          duration: 2,
          size: "CU",
          cameraMove: "固定机位",
          visualAction: `动作${index + 1}`,
          sourceBlockIds: [`B0${index + 1}`],
        })),
      },
    ],
  };
  assert.equal(validateScenePlan(plan, input, SCENE_PLAN_POLICIES.flexible6).issues.length, 0);
  assert.ok(validateScenePlan(plan, input, SCENE_PLAN_POLICIES.strict3).issues.length > 0);
});

test("规划分块：长场按源块顺序切成小单元，不丢块", () => {
  const blocks = Array.from({ length: 25 }, (_, index) => ({
    id: `B${String(index + 1).padStart(2, "0")}`,
    kind: "action",
    text: `动作${index + 1}`,
    source: `动作${index + 1}`,
  }));
  const chunks = splitSceneInput(
    {
      sceneId: "1-1",
      episode: "第1集",
      sceneHeading: "街口 外 夜",
      cast: "",
      castNames: [],
      previousEnd: "上一场结尾",
      nextScene: "下一场开头",
      estimatedSeconds: 20,
      blocks,
    },
    { targetSeconds: 5, maxBlocks: 8, policy: SCENE_PLAN_POLICIES.flexible6 },
  );
  assert.ok(chunks.length > 1);
  assert.equal(chunks.flatMap((chunk) => chunk.blocks).length, 25);
  assert.deepEqual(
    chunks.flatMap((chunk) => chunk.blocks.map((block) => block.id)),
    blocks.map((block) => block.id),
  );
  assert.ok(chunks.every((chunk) => chunk.blocks.length <= 8));
  assert.match(chunks[1].previousEnd, /动作4/);
  assert.match(chunks[1].previousEnd, /动作6/);
});

test("规划分块：合并后保留所有 shot 的连续性顺序", () => {
  const merged = mergeScenePlans(
    [
      { shots: [{ duration: 5, clips: [] }, { duration: 6, clips: [] }] },
      { shots: [{ duration: 7, clips: [] }] },
    ],
    "1-1",
  );
  assert.equal(merged.sceneId, "1-1");
  assert.deepEqual(merged.shots.map((shot) => shot.duration), [5, 6, 7]);
  assert.deepEqual(merged.shots.map((shot) => shot.shotIndex), [1, 2, 3]);
});

test("规划分块：合并时保留导演提示单和场景地理", () => {
  const merged = mergeScenePlans(
    [{ schemaVersion: DIRECTOR_SCHEMA_VERSION, shots: [] }],
    "1-1",
    {
      directorBrief: DIRECTOR_BRIEF,
      sceneGeography: SCENE_GEOGRAPHY,
    },
  );
  assert.equal(merged.schemaVersion, DIRECTOR_SCHEMA_VERSION);
  assert.deepEqual(merged.directorBrief, DIRECTOR_BRIEF);
  assert.deepEqual(merged.sceneGeography, SCENE_GEOGRAPHY);
});

test("时长裁决：80 秒方案保持为一集", () => {
  const result = arbitrateShotTimeline(Array.from({ length: 8 }, () => ({ duration: 10 })));
  assert.deepEqual(result.stats, {
    episodes: 1,
    totalDuration: 80,
    inWindow: 1,
    short: 0,
    over: 0,
  });
});

test("时长裁决：200 秒方案在 shot 边界拆成两集", () => {
  const result = arbitrateShotTimeline(Array.from({ length: 20 }, () => ({ duration: 10 })));
  assert.equal(result.stats.episodes, 2);
  assert.equal(result.stats.inWindow, 2);
  assert.equal(result.stats.short, 0);
  assert.deepEqual(result.groups.map((group) => group.duration), [100, 100]);
  assert.equal(
    result.groups.reduce((sum, group) => sum + group.shots.length, 0),
    20,
  );
});

test("时长裁决：145 秒方案明确标出无法避免的短集", () => {
  const shots = Array.from({ length: 15 }, (_, index) => ({
    duration: index === 14 ? 5 : 10,
  }));
  const result = arbitrateShotTimeline(shots);
  assert.equal(result.stats.episodes, 2);
  assert.equal(result.stats.short, 1);
  assert.deepEqual(result.groups.map((group) => group.duration), [70, 75]);
  assert.ok(result.issues.some((issue) => /不在 75–105s/.test(issue.msg)));
});

test("回归样本：真实云端计划覆盖 62 个源块并生成 32 shot / 50 Clip", () => {
  const sceneInput = JSON.parse(MODEL_RUN.input);
  const plan = parseScenePlan(MODEL_RUN.output);
  const result = validateScenePlan(plan, sceneInput);
  assert.equal(MODEL_RUN.status, "completed");
  assert.deepEqual(result.stats, {
    shots: 32,
    clips: 50,
    blocks: 62,
    widePct: 6,
    overloadedClips: 0,
    totalDuration: 278,
  });
  assert.equal(result.issues.length, 0);
});

test("回归样本：编译后通过现有台词、人物、道具和空镜质检", () => {
  const sceneInput = JSON.parse(MODEL_RUN.input);
  const plan = parseScenePlan(MODEL_RUN.output);
  const output = `${sceneInput.episode}\n${compileScenePlan(plan, sceneInput)}`;
  const source = [
    sceneInput.episode,
    sceneInput.sceneHeading,
    `人物：${sceneInput.cast}`,
    ...sceneInput.blocks.map((block) => block.source),
  ].join("\n");
  assert.deepEqual(runEngineQc(source, output), []);
});

test("灵活 6 Clip 回归：结构合法，但内容预算暴露 13 个过载 Clip", () => {
  const sceneInput = JSON.parse(FLEX_RUN.input);
  const plan = parseScenePlan(FLEX_RUN.output);
  const result = validateScenePlan(plan, sceneInput, SCENE_PLAN_POLICIES.flexible6);
  assert.deepEqual(result.stats, {
    shots: 12,
    clips: 33,
    blocks: 62,
    widePct: 24.2,
    overloadedClips: 13,
    totalDuration: 96,
  });
  assert.equal(result.issues.length, 13);
  assert.ok(result.issues.every((issue) => /内容预算约/.test(issue.msg)));
});

test("导演提示单回归：真实模型产出字段完整", () => {
  const plan = parseScenePlan(DIRECTOR_BRIEF_RUN.output);
  const result = validateDirectorBrief(
    plan.directorBrief,
    plan.sceneGeography,
    "1-1",
  );
  assert.equal(DIRECTOR_BRIEF_RUN.status, "completed");
  assert.deepEqual(result.issues, []);
  assert.match(plan.directorBrief.endHook, /Wait|是谁|新问题/);
});

test("导演版分镜回归：旧样本字段完整，但按官方动作规则抓出复杂镜头", () => {
  const sceneInput = JSON.parse(DIRECTOR_CHUNK_RUN.input);
  const plan = parseScenePlan(DIRECTOR_CHUNK_RUN.output);
  const result = validateScenePlan(plan, sceneInput, SCENE_PLAN_POLICIES.flexible6);
  const director = analyzeDirectorFields(plan);
  const action = auditShotActionDensity(plan, sceneInput);
  assert.equal(DIRECTOR_CHUNK_RUN.status, "completed");
  assert.equal(sceneInput.blocks.length, 21);
  assert.equal(result.stats.shots, 4);
  assert.equal(result.stats.clips, 12);
  assert.equal(director.completePct, 100);
  assert.equal(director.validStoryFunction, 4);
  assert.equal(action.complexShots, 3);
  assert.equal(action.denseActionClips, 1);
  assert.equal(
    result.issues.filter((issue) => /动作密度过高/.test(issue.msg)).length,
    2,
  );
  assert.ok(result.issues.every((issue) => !/内容预算约/.test(issue.msg)));
});

test("官方动作规则回归：单 Clip 过载被继续拆分，剩余阶段问题仍如实报告", () => {
  const sceneInput = JSON.parse(DIRECTOR_CHUNK_RUN.input);
  const oldPlan = parseScenePlan(DIRECTOR_CHUNK_RUN.output);
  const officialPlan = parseScenePlan(DIRECTOR_OFFICIAL_RUN.output);
  const oldAudit = auditShotActionDensity(oldPlan, sceneInput);
  const officialAudit = auditShotActionDensity(
    officialPlan,
    sceneInput,
  );
  const validation = validateScenePlan(
    officialPlan,
    sceneInput,
    SCENE_PLAN_POLICIES.flexible6,
  );
  assert.equal(DIRECTOR_OFFICIAL_RUN.status, "completed");
  assert.equal(oldPlan.shots.length, 4);
  assert.equal(officialPlan.shots.length, 6);
  assert.equal(oldAudit.denseActionClips, 1);
  assert.equal(officialAudit.denseActionClips, 0);
  assert.equal(
    validation.issues.filter((issue) => /单个 Clip 动作阶段过载/.test(issue.msg)).length,
    0,
  );
  assert.equal(
    validation.issues.filter((issue) => /动作密度过高/.test(issue.msg)).length,
    2,
  );
});

test("动作微单元真实回归：模型按 v3 输出，动作阶段与运镜审计为零", () => {
  const sceneInput = JSON.parse(DIRECTOR_ACTION_UNIT_RUN.input);
  const plan = parseScenePlan(DIRECTOR_ACTION_UNIT_RUN.output);
  const validation = validateScenePlan(
    plan,
    sceneInput,
    SCENE_PLAN_POLICIES.flexible6,
  );
  const action = auditShotActionDensity(plan, sceneInput);
  assert.equal(DIRECTOR_ACTION_UNIT_RUN.status, "completed");
  assert.equal(plan.schemaVersion, ACTION_UNIT_SCHEMA_VERSION);
  assert.equal(plan.shots.length, 5);
  assert.equal(action.complexShots, 0);
  assert.equal(action.denseActionClips, 0);
  assert.equal(action.compoundCameraMoves, 0);
  assert.equal(
    validation.issues.filter((issue) => /动作密度|动作阶段过载|复合运镜/.test(issue.msg))
      .length,
    0,
  );
  assert.equal(
    validation.issues.filter((issue) => /内容预算约/.test(issue.msg)).length,
    2,
  );
  assert.ok(
    plan.shots.flatMap((shot) => shot.clips).some((clip) => clip.actionUnitIds?.length),
  );
  assert.deepEqual(auditShotResponsibilities(plan).issues, []);
  assert.deepEqual(auditShotContinuity(plan, sceneInput).issues, []);
});

test("镜头职责审计：同职责同动作的不同角度会报重复", () => {
  const audit = auditShotResponsibilities({
    shots: [
      {
        purpose: "让弟子确认黑龙被击退",
        storyFunction: "reaction",
        cast: ["男弟子"],
        stateChange: "男弟子震惊地看着黑龙飞走。",
        endState: "男弟子僵在原地。",
        clips: [
          {
            visualAction: "男弟子瞪大眼睛看着黑龙飞走。",
            sourceBlockIds: ["B01"],
          },
        ],
      },
      {
        purpose: "让弟子确认黑龙被击退",
        storyFunction: "reaction",
        cast: ["男弟子"],
        stateChange: "男弟子震惊地看着黑龙飞走。",
        endState: "男弟子僵在原地。",
        clips: [
          {
            visualAction: "男弟子瞪大眼睛看着黑龙飞走。",
            sourceBlockIds: ["B02"],
          },
        ],
      },
    ],
  });
  assert.equal(audit.issues.length, 1);
  assert.equal(audit.issues[0].level, "高");
  assert.match(audit.issues[0].msg, /职责或动作描述完全相同/);
});

test("镜头职责审计：反应后出现新判断，不误报为重复", () => {
  const audit = auditShotResponsibilities({
    shots: [
      {
        purpose: "让弟子看见黑龙被击退并震惊",
        storyFunction: "reaction",
        cast: ["男弟子"],
        stateChange: "男弟子僵住。",
        endState: "男弟子仍望着天空。",
        clips: [{ visualAction: "男弟子瞪大眼睛。", sourceBlockIds: ["B01"] }],
      },
      {
        purpose: "让弟子转向师傅质问战斗结果",
        storyFunction: "shift",
        cast: ["男弟子", "大魔导师"],
        stateChange: "男弟子转头向大魔导师发问。",
        endState: "男弟子等待回答。",
        clips: [{ visualAction: "男弟子转头开口。", sourceBlockIds: ["B02"] }],
      },
    ],
  });
  assert.deepEqual(audit.issues, []);
});

test("镜头职责审计：重复引用同一动作会直接报高", () => {
  const shared = {
    storyFunction: "impact",
    cast: ["亚瑟"],
    purpose: "展示苹果击中龙眼",
    stateChange: "苹果击中龙眼。",
    endState: "黑龙后退。",
    clips: [{ visualAction: "苹果击中龙眼。", sourceBlockIds: ["B01"] }],
  };
  const audit = auditShotResponsibilities({
    shots: [{ ...shared }, { ...shared, purpose: "换角度再看苹果击中龙眼" }],
  });
  assert.equal(audit.issues.length, 1);
  assert.equal(audit.issues[0].level, "高");
  assert.match(audit.issues[0].msg, /重复引用 1 个源动作/);
});

test("连续性审计：同一人物、姿势、持物和视线可以直接承接", () => {
  const audit = auditShotContinuity({
    shots: [
      {
        cast: ["林岚"],
        props: ["手机"],
        startState: "林岚站在门口，右手持手机。",
        endState: "林岚站在门口，右手持手机，视线看向屋内。",
        continuityNote: "场首。建立林岚在门口和屋内方向。",
        clips: [{ visualAction: "林岚站在门口看向屋内。" }],
      },
      {
        cast: ["林岚"],
        props: ["手机"],
        startState: "林岚站在门口，右手持手机，视线看向屋内。",
        endState: "林岚仍站在门口，右手持手机。",
        continuityNote: "承接上一镜结尾：林岚仍在门口、右手持手机、看向屋内。",
        clips: [{ visualAction: "林岚保持原地观察。" }],
      },
    ],
  });
  assert.deepEqual(audit.issues, []);
});

test("连续性审计：姿势无来源跳变和通用说明会报高", () => {
  const audit = auditShotContinuity({
    shots: [
      {
        cast: ["林岚"],
        startState: "林岚站在门口。",
        endState: "林岚站在门口。",
        continuityNote: "场首。",
        clips: [{ visualAction: "林岚站在门口。" }],
      },
      {
        cast: ["林岚"],
        startState: "林岚坐在桌后。",
        endState: "林岚坐在桌后。",
        continuityNote: "沿用上一镜状态。",
        clips: [{ visualAction: "林岚坐在桌后。" }],
      },
    ],
  });
  assert.equal(audit.issues.filter((issue) => issue.level === "高").length, 2);
  assert.ok(audit.issues.some((issue) => /姿势从上一镜/.test(issue.msg)));
  assert.ok(audit.issues.some((issue) => /通用说明/.test(issue.msg)));
});

test("连续性审计：人物切镜进出画只记录，不把画外当作真正离场", () => {
  const base = {
    shots: [
      {
        cast: ["林岚"],
        startState: "林岚坐在桌后。",
        endState: "林岚坐在桌后看向门口。",
        continuityNote: "场首。林岚坐在桌后。",
        clips: [{ visualAction: "林岚坐在桌后。" }],
      },
      {
        cast: ["林岚", "访客"],
        startState: "林岚坐在桌后，访客站在门口。",
        endState: "访客站在门口。",
        continuityNote: "承接林岚看向门口；切到门口后，访客进入画面。",
        clips: [{ visualAction: "访客站在门口。" }],
      },
    ],
  };
  const audit = auditShotContinuity(base);
  assert.deepEqual(audit.issues, []);
  assert.deepEqual(audit.transitions[0].entering, ["访客"]);
});

test("确定性修复：自动统一人物短名、补足短 shot 并清掉内容过载", () => {
  const sceneInput = JSON.parse(MODEL_RUN.input);
  const policy = SCENE_PLAN_POLICIES.flexible6;
  const repaired = repairScenePlan(CHUNKED_FLEX_RUN.plan, sceneInput, policy);
  const result = validateScenePlan(repaired.plan, sceneInput, policy);
  assert.equal(result.issues.length, 0);
  assert.equal(result.stats.overloadedClips, 0);
  assert.ok(result.stats.shots >= CHUNKED_FLEX_RUN.plan.shots.length);
  assert.ok(repaired.repairs.some((item) => item.includes("皇家大魔导师")));
  assert.ok(repaired.repairs.some((item) => item.includes("补足 1 秒")));
});

test("确定性修复：从对白源块补回漏登记的说话人", () => {
  const { input } = sceneFixture();
  const broken = structuredClone(PLAN);
  broken.shots[0].cast = [];
  broken.shots[1].cast = [];
  const repaired = repairScenePlan(broken, input);
  assert.deepEqual(repaired.plan.shots[0].cast, ["林岚", "访客"]);
  assert.ok(repaired.plan.shots[1].cast.includes("访客"));
  assert.deepEqual(validateScenePlan(repaired.plan, input).issues, []);
});

test("确定性修复：群体泛称归并到登记人物，并收起带台词的宽景别", () => {
  const { input } = sceneFixture();
  const castInput = {
    ...input,
    castNames: [...input.castNames, "村民群像", "男弟子", "女弟子", "亚瑟"],
    cast: `${input.cast}、村民群像（Villagers，着装：粗布衣）、男弟子（Male Disciple，着装：法袍）、女弟子（Female Disciple，着装：法袍）、亚瑟（Arthur，着装：旅行装）`,
  };
  const broken = structuredClone(PLAN);
  broken.shots[0].cast = ["村民", "弟子们", "亚瑟（O.S.）"];
  broken.shots[0].clips[0].size = "WS";
  const repaired = repairScenePlan(broken, castInput);
  assert.deepEqual(repaired.plan.shots[0].cast, [
    "村民群像",
    "男弟子",
    "女弟子",
    "亚瑟",
    "林岚",
    "访客",
  ]);
  assert.equal(repaired.plan.shots[0].clips[0].size, "MCU");
  assert.ok(repaired.repairs.some((item) => item.includes("村民")));
  assert.ok(repaired.repairs.some((item) => item.includes("含台词的 WS")));
});

test("确定性修复：内容补足后超过 15 秒的 shot 在 Clip 边界继续拆开", () => {
  const { input } = sceneFixture();
  const broken = {
    sceneId: "1-1",
    shots: [
      {
        duration: 18,
        cast: ["林岚", "访客"],
        props: ["信封"],
        startPosition: "林岚坐在桌后，访客站在门口。",
        clips: [
          {
            duration: 5,
            size: "MCU",
            cameraMove: "固定机位",
            visualAction: "林岚抬头看向门口。",
            sourceBlockIds: ["B01", "B02"],
          },
          {
            duration: 5,
            size: "CU",
            cameraMove: "缓慢推近",
            visualAction: "林岚视线停在门边。",
            sourceBlockIds: ["B03"],
          },
          {
            duration: 8,
            size: "MCU",
            cameraMove: "固定机位",
            visualAction: "访客把信封放在桌上。",
            sourceBlockIds: ["B04", "B05"],
          },
        ],
      },
    ],
  };
  const repaired = repairScenePlan(broken, input);
  assert.deepEqual(
    repaired.plan.shots.map((shot) => shot.duration),
    [10, 8],
  );
  assert.equal(repaired.plan.shots.flatMap((shot) => shot.clips).length, 3);
  assert.match(repaired.plan.shots[1].startPosition, /承接上一镜结尾/);
  assert.ok(
    repaired.repairs.some((item) => item.includes("在 Clip 边界拆为 10 + 8 秒")),
  );
  assert.deepEqual(validateScenePlan(repaired.plan, input).issues, []);
});

test("确定性修复：动作原文可精确命中时，回填缺失的动作微单元引用", () => {
  const parsed = parseScript(`第1集：测试
1-1 房间 内 日
人物：林岚（Lin，着装：白衬衫）
△林岚坐在桌后，低头盯着手机。
△门被推开。
`);
  const episode = parsed.episodes[0];
  const scene = episode.scenes[0];
  const input = buildSceneInput({
    episode,
    scene,
    directorBrief: DIRECTOR_BRIEF,
    sceneGeography: SCENE_GEOGRAPHY,
  });
  const plan = {
    schemaVersion: 3,
    sceneId: "1-1",
    directorBrief: DIRECTOR_BRIEF,
    sceneGeography: SCENE_GEOGRAPHY,
    shots: [
      {
        duration: 5,
        purpose: "建立林岚在桌后的等待",
        storyFunction: "establish",
        cast: ["林岚"],
        props: ["手机", "桌子"],
        startState: "林岚坐在桌后，手机在手中。",
        stateChange: "林岚低头盯住手机。",
        endState: "林岚坐在桌后，视线落在手机上。",
        cameraReason: "固定近景建立等待状态。",
        continuityNote: "场首。林岚坐在桌后，手机在手中。",
        clips: [
          {
            duration: 5,
            size: "MCU",
            cameraMove: "固定机位",
            visualAction: "△林岚坐在桌后，低头盯着手机。",
            sourceBlockIds: ["B02"],
          },
        ],
      },
    ],
  };
  const repaired = repairScenePlan(plan, input);
  assert.deepEqual(repaired.plan.shots[0].clips[0].actionUnitIds, [
    "B01.1",
    "B01.2",
  ]);
  assert.ok(
    repaired.repairs.some((item) => item.includes("回填动作微单元")),
  );
});

test("确定性修复：单个 shot 挤入过多短动作阶段时按 Clip 边界拆开并保持顺序", () => {
  const parsed = parseScript(`第1集：测试
1-1 庭院 外 夜
人物：休斯（Hughes，着装：皮甲）、亚瑟（Arthur，着装：旅行装）
△休斯坐着吃烤肉，转头看向亚瑟，不屑地笑，抬起右臂，身体前倾，随后站起。
△亚瑟看着休斯，保持沉默。
`);
  const episode = parsed.episodes[0];
  const scene = episode.scenes[0];
  const input = buildSceneInput({
    episode,
    scene,
    directorBrief: DIRECTOR_BRIEF,
    sceneGeography: SCENE_GEOGRAPHY,
  });
  const plan = {
    schemaVersion: 3,
    sceneId: "1-1",
    directorBrief: DIRECTOR_BRIEF,
    sceneGeography: SCENE_GEOGRAPHY,
    shots: [
      {
        duration: 7,
        purpose: "让休斯从吃肉转为起身挑衅",
        storyFunction: "pressure",
        cast: ["休斯"],
        props: ["烤肉"],
        startState: "休斯坐在庭院中，右手拿着烤肉。",
        stateChange: "休斯从坐着吃肉转为转头讥笑；随后抬臂并站起。",
        endState: "休斯站直身体，右臂抬起，面带讥笑。",
        cameraReason: "固定机位看清休斯从吃到起身的连续动作。",
        continuityNote: "场首。休斯坐在庭院中，右手拿着烤肉。",
        clips: [
          {
            duration: 3,
            size: "MCU",
            cameraMove: "固定机位",
            visualAction: "休斯坐着吃烤肉，转头看向亚瑟。",
            actionUnitIds: ["B01.1", "B01.2"],
          },
          {
            duration: 2,
            size: "CU",
            cameraMove: "固定机位",
            visualAction: "休斯不屑地笑，抬起右臂。",
            actionUnitIds: ["B01.3", "B01.4"],
          },
          {
            duration: 2,
            size: "MCU",
            cameraMove: "固定机位",
            visualAction: "休斯身体前倾，随后站起。",
            actionUnitIds: ["B01.5", "B01.6"],
          },
        ],
      },
      {
        duration: 5,
        purpose: "保留后续反应镜头",
        storyFunction: "reaction",
        cast: ["亚瑟"],
        props: [],
        startState: "亚瑟站在庭院另一侧。",
        stateChange: "亚瑟看着休斯起身。",
        endState: "亚瑟仍站在原地。",
        cameraReason: "固定近景保留反应。",
        continuityNote: "承接休斯站起；亚瑟看向休斯。",
        clips: [
          {
            duration: 5,
            size: "CU",
            cameraMove: "固定机位",
            visualAction: "亚瑟看着休斯站起来。",
            actionUnitIds: ["B02.1", "B02.2"],
          },
        ],
      },
    ],
  };
  const repaired = repairScenePlan(plan, input, SCENE_PLAN_POLICIES.flexible6);
  assert.equal(repaired.plan.shots.length, 3);
  assert.equal(repaired.plan.shots[0].clips.length, 1);
  assert.equal(repaired.plan.shots[1].clips.length, 2);
  assert.match(repaired.plan.shots[1].startState, /^承接上一镜结尾/);
  assert.equal(
    repaired.plan.shots[2].clips[0].visualAction,
    "亚瑟看着休斯站起来。",
  );
  assert.ok(
    repaired.repairs.some((item) => item.includes("在 Clip 边界拆为")),
  );
  assert.deepEqual(
    validateScenePlan(
      repaired.plan,
      input,
      SCENE_PLAN_POLICIES.flexible6,
    ).issues.filter((issue) => issue.level === "高"),
    [],
  );
});

test("确定性修复：只命中一个短动作分句时，不跨镜回填源引用", () => {
  const { input } = sceneFixture();
  const plan = directedPlan();
  plan.schemaVersion = 3;
  plan.shots[1].clips[0].actionUnitIds = [];
  plan.shots[1].clips[0].sourceBlockIds = ["B02"];
  plan.shots[1].clips[0].visualAction = "画面外有人说话，林岚仍盯着手机。";
  const repaired = repairScenePlan(plan, input);
  assert.deepEqual(repaired.plan.shots[1].clips[0].actionUnitIds, []);
});

test("确定性修复：动作 Clip 内容超载时按微单元边界拆分，不删内容", () => {
  const parsed = parseScript(`第1集：测试
1-1 房间 内 日
人物：林岚（Lin，着装：白衬衫）
△林岚抬手，转身，迈步，停住，低头，抬头，呼吸，握拳，松手，看向门口，走向门口。
`);
  const episode = parsed.episodes[0];
  const scene = episode.scenes[0];
  const input = buildSceneInput({
    episode,
    scene,
    directorBrief: DIRECTOR_BRIEF,
    sceneGeography: SCENE_GEOGRAPHY,
  });
  const plan = {
    schemaVersion: 3,
    sceneId: "1-1",
    directorBrief: DIRECTOR_BRIEF,
    sceneGeography: SCENE_GEOGRAPHY,
    shots: [
      {
        duration: 8,
        purpose: "让林岚连续完成从停步到走向门口的调度",
        storyFunction: "shift",
        cast: ["林岚"],
        props: ["手机", "桌子"],
        startState: "林岚站在桌后，双手空着。",
        stateChange: "林岚从停步转为走向门口。",
        endState: "林岚站在门边，准备离开房间。",
        cameraReason: "连续跟移保持动作方向清楚。",
        continuityNote: "场首。林岚站在桌后，门在画面右侧。",
        clips: [
          {
            duration: 8,
            size: "MS",
            cameraMove: "横向跟拍",
            visualAction:
              "△林岚抬手，转身，迈步，停住，低头，抬头，呼吸，握拳，松手，看向门口，走向门口。",
          },
        ],
      },
    ],
  };
  const repaired = repairScenePlan(plan, input, SCENE_PLAN_POLICIES.flexible6);
  const clips = repaired.plan.shots.flatMap((shot) => shot.clips);
  assert.ok(clips.length >= 2);
  assert.equal(
    clips.flatMap((clip) => clip.actionUnitIds || []).length,
    11,
  );
  assert.equal(
    new Set(clips.flatMap((clip) => clip.actionUnitIds || [])).size,
    11,
  );
  assert.equal(repaired.plan.shots[0].duration, 10);
  assert.ok(repaired.repairs.some((item) => item.includes("动作微单元边界")));
});

test("确定性修复：纯台词 Clip 内容超载时按分句拆分，台词只编译一次", () => {
  const parsed = parseScript(`第1集：测试
1-1 房间 内 日
人物：林岚（Lin，着装：白衬衫）、陈默（Chen，着装：风衣）
△林岚坐在桌后，抬眼看向陈默。
陈默（压低声音）：This is a very long line that takes far more than eight seconds to say, and the engine must split it across clips without losing a single word.
`);
  const episode = parsed.episodes[0];
  const scene = episode.scenes[0];
  const input = buildSceneInput({
    episode,
    scene,
    directorBrief: DIRECTOR_BRIEF,
    sceneGeography: SCENE_GEOGRAPHY,
  });
  const dialogueBlock = input.blocks.find((block) => block.kind === "dialogue");
  const plan = {
    schemaVersion: 3,
    sceneId: "1-1",
    directorBrief: DIRECTOR_BRIEF,
    sceneGeography: SCENE_GEOGRAPHY,
    shots: [
      {
        duration: 8,
        purpose: "让陈默劝林岚离开",
        storyFunction: "pressure",
        cast: ["陈默", "林岚"],
        props: [],
        startState: "林岚坐在桌后，陈默站在桌前。",
        stateChange: "陈默把劝说的话说完。",
        endState: "两人位置不变。",
        cameraReason: "近景捕捉情绪。",
        continuityNote: "场首。林岚在桌后，陈默在桌前。",
        clips: [
          {
            duration: 8,
            size: "CU",
            cameraMove: "缓慢推近",
            visualAction: "陈默看着林岚，嘴唇颤抖，泪水不断，继续劝她离开。",
            sourceBlockIds: [dialogueBlock.id],
          },
        ],
      },
    ],
  };
  const repaired = repairScenePlan(plan, input, SCENE_PLAN_POLICIES.flexible6);
  const clips = repaired.plan.shots.flatMap((shot) => shot.clips);
  assert.ok(clips.length >= 2, "超载的台词镜应拆成多段");
  assert.ok(clips.every((clip) => String(clip.visualAction || "").trim()), "每段都要有画面描述");
  // 拆分后每段都引用同一句台词，编译阶段应归一到首段、后续段标承接，最终只输出一条 EN。
  const compiled = compileScenePlan(repaired.plan, input);
  const enLines = compiled.split("\n").filter((line) => line.startsWith("EN:"));
  assert.equal(enLines.length, 1, "同一句台词只能编译一次");
  assert.ok(repaired.plan.shots[0].duration <= SCENE_PLAN_POLICIES.flexible6.shotMax);
});

test("确定性修复：不存在的源块引用不会在预修复阶段抛错，交给校验器定点处理", () => {
  const { input } = sceneFixture();
  const broken = structuredClone(PLAN);
  broken.shots[0].clips[0].sourceBlockIds = ["B99"];
  const repaired = repairScenePlan(broken, input);
  const validation = validateScenePlan(repaired.plan, input);
  assert.ok(
    validation.issues.some((issue) => issue.msg.includes("B99")),
  );
});

test("长台词跨 Clip：同 shot 后续片段标为台词延续，只编译一次", () => {
  const parsed = parseScript(`第1集：测试
1-1 城墙 外 夜
人物：巴里长老（Elder Barry，着装：长老法袍）
巴里长老（震惊）：You mean this is pure physical destruction? One blow caved in a load-bearing wall reinforced with defensive arrays? How terrifying must that brute force be!
`);
  const episode = parsed.episodes[0];
  const scene = episode.scenes[0];
  const input = buildSceneInput({
    episode,
    scene,
    directorBrief: DIRECTOR_BRIEF,
    sceneGeography: SCENE_GEOGRAPHY,
  });
  const plan = {
    schemaVersion: 3,
    sceneId: "1-1",
    directorBrief: DIRECTOR_BRIEF,
    sceneGeography: SCENE_GEOGRAPHY,
    shots: [
      {
        duration: 11,
        purpose: "让巴里长老用长句确认纯物理破坏的威胁",
        storyFunction: "detail",
        cast: ["巴里长老"],
        props: [],
        startState: "巴里长老站在城墙断口旁，面向断口。",
        stateChange: "巴里长老从查看断口转为说完判断。",
        endState: "巴里长老仍面向断口，口已闭合。",
        cameraReason: "连续近景让长句和判断完整落地。",
        continuityNote: "场首。巴里长老站在断口旁，面向断口。",
        clips: [
          {
            duration: 6,
            size: "CU",
            cameraMove: "缓慢推近",
            visualAction: "巴里长老开口说出对断口的判断。",
            sourceBlockIds: ["B01"],
          },
          {
            duration: 5,
            size: "CU",
            cameraMove: "固定机位",
            visualAction: "巴里长老继续说完判断，随后闭嘴。",
            sourceBlockIds: ["B01"],
          },
        ],
      },
    ],
  };
  const repaired = repairScenePlan(plan, input, SCENE_PLAN_POLICIES.flexible6);
  const clips = repaired.plan.shots[0].clips;
  assert.deepEqual(clips[0].sourceBlockIds, ["B01"]);
  assert.equal(clips[1].sourceBlockIds.length, 0);
  assert.deepEqual(clips[1].dialogueContinuationIds, ["B01"]);
  assert.ok(
    repaired.repairs.some((item) => item.includes("台词延续")),
  );
  const output = compileScenePlan(repaired.plan, input);
  assert.equal((output.match(/EN:/g) || []).length, 1);
  assert.deepEqual(
    validateScenePlan(
      repaired.plan,
      input,
      SCENE_PLAN_POLICIES.flexible6,
    ).issues.filter((issue) => issue.level === "高"),
    [],
  );
});

test("长台词延续：没有同 shot 源引用时仍报高风险", () => {
  const { input } = sceneFixture();
  const bad = directedPlan();
  bad.schemaVersion = 3;
  bad.shots[0].clips = [
    {
      duration: 5,
      size: "CU",
      cameraMove: "固定机位",
      visualAction: "林岚说话。",
      dialogueContinuationIds: ["B02"],
    },
  ];
  const validation = validateScenePlan(bad, input);
  assert.ok(
    validation.issues.some((issue) => issue.msg.includes("之前没有同 shot 的源引用")),
  );
});

