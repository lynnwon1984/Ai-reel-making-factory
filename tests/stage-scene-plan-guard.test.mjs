import assert from "node:assert/strict";
import test from "node:test";
import { validateScenePlan } from "../scripts/stage-scene-plan-guard.mjs";

const fields = (id, minutes, overrides = {}) => {
  const values = {
    ACT: "1",
    SOURCE: `S00${id}`,
    TITLE: `场${id}`,
    WHEN: "雨天",
    WHERE: "修表铺",
    CAST: "C01, C02",
    ON_STAGE_OPEN: "两人在场",
    OFF_STAGE: "无",
    EVENT: "一人拿出钥匙",
    OBJECTIVE: "拿到钥匙",
    OBSTACLE: "对方按住抽屉",
    TACTICS: "请求、逼近",
    TURN: "钥匙被交出",
    CHANGE: "钥匙从哥哥手中转到妹妹手中",
    ENTER_EXIT: "无",
    PROPS: overrides.PROPS ?? "钥匙放在抽屉里",
    SOUND_LIGHT: "雨声",
    DOUBLING_RISK: "无",
    EST_MINUTES: minutes,
    RISK: "钥匙来源要清楚",
    ...overrides,
  };
  return `### S0${id}\n${Object.entries(values)
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n")}`;
};

const validPlan = `# SCENE PLAN v1
## ACT CONTRACT
ACT_1_QUESTION: 她会不会走？
ACT_1_END_CHANGE: 她决定留下
## SCENE CARDS
${fields(1, "3–4", { PROPS: "钥匙首次出现，放在抽屉里" })}
${fields(2, "4–5", { PROPS: "钥匙在妹妹手中；布包在桌上" })}
${fields(3, "3–4", { PROPS: "钥匙被带走" })}
## ACT CLOSE
LAST_SCENE: S03
NEXT_ACT_ENTRY_STATE: 两人离开
UNRESOLVED: 无`;

test("场景卡：时长、字段和累计道具都合格时通过", () => {
  const result = validateScenePlan(validPlan, { targetMinutes: 12 });
  assert.deepEqual(result.issues, []);
  assert.equal(result.cards.length, 3);
  assert.equal(result.totalMinutes, 11.5);
});

test("场景卡：总时长超预算被拦下", () => {
  const broken = validPlan.replace("EST_MINUTES: 3–4", "EST_MINUTES: 10–12");
  const codes = validateScenePlan(broken, { targetMinutes: 12 }).issues.map((issue) => issue.code);
  assert.ok(codes.includes("SCENE_RUNTIME_OUT_OF_RANGE"));
});

test("场景卡：重复首次出现和离场写无被拦下", () => {
  const broken = validPlan
    .replace("钥匙在妹妹手中；布包在桌上", "钥匙首次出现，在妹妹手中")
    .replace("EVENT: 一人拿出钥匙", "EVENT: 两人离开修表铺");
  const codes = validateScenePlan(broken, { targetMinutes: 12 }).issues.map((issue) => issue.code);
  assert.ok(codes.includes("SCENE_PROP_REDEBUT"));
  assert.ok(codes.includes("SCENE_ENTER_EXIT_MISSING"));
});

test("场景卡：开放幕终问题和开场已进场但出入场写无被拦下", () => {
  const broken = validPlan
    .replace("ACT_1_END_CHANGE: 她决定留下", "ACT_1_END_CHANGE: 她是否决定留下")
    .replace("ON_STAGE_OPEN: 两人在场", "ON_STAGE_OPEN: 妹妹从门外进门，两人在场");
  const codes = validateScenePlan(broken, { targetMinutes: 12 }).issues.map((issue) => issue.code);
  assert.ok(codes.includes("SCENE_END_CHANGE_OPEN"));
  assert.ok(codes.includes("SCENE_ENTER_EXIT_MISSING"));
});
