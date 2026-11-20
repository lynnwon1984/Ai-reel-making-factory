import { test } from "node:test";
import assert from "node:assert/strict";

import { auditStateChain, parseStateShots } from "../src/state-chain.js";

const pad = (n) => String(n).padStart(2, "0");

function shot(no, space, action, cast = ["甲", "乙"]) {
  return `【分镜${pad(no)}】
[shot${pad(no)} | 时长：5秒 | 场景：房间 内 日 | 人物：${cast.join("、")} | 道具：无]
人物空间位置：
${space}
Clip A | 时长：5秒 | 景别：MCU
CAMERA: 固定机位 / MCU. ${action}
`;
}

test("状态链：能拆出 shot、人物表、开镜空间位置和可见动作", () => {
  const shots = parseStateShots(
    shot(1, "甲坐在桌后。乙站在门口。", "甲抬头看向乙。"),
  );
  assert.equal(shots.length, 1);
  assert.deepEqual(shots[0].cast, ["甲", "乙"]);
  assert.match(shots[0].space, /甲坐在桌后/);
  assert.equal(shots[0].actions.length, 1);
});

test("状态链：姿势跳变且没有过渡动作 → 报中风险", () => {
  const md =
    shot(1, "甲坐在桌后。乙站在门口。", "甲抬头看向乙。") +
    shot(2, "甲站在桌后。乙站在门口。", "甲继续说话。");
  const issues = auditStateChain(md);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].rule, "状态跳变");
  assert.match(issues[0].evidence, /甲：上一镜开镜「坐」→ 本镜开镜「站」/);
});

test("状态链：有过渡动作时不报", () => {
  const md =
    shot(1, "甲坐在桌后。乙站在门口。", "甲直起身。") +
    shot(2, "甲站在桌后。乙站在门口。", "甲继续说话。");
  assert.deepEqual(auditStateChain(md), []);
});

test("状态链：姿势在允许的相邻组合内不报（蹲起、弯腰直起）", () => {
  const md =
    shot(1, "甲蹲在门后。", "甲观察外面。", ["甲"]) +
    shot(2, "甲站在门后。", "甲继续观察。", ["甲"]);
  // 蹲→站 属允许组合，不要求过渡词
  assert.deepEqual(auditStateChain(md), []);
});

test("状态链：朝向反转且没有转身动作 → 报低风险", () => {
  const md =
    shot(1, "甲面朝乙。乙站在门口。", "甲开口。") +
    shot(2, "甲面朝丙。乙站在门口。丙站在窗边。", "甲继续开口。", ["甲", "乙", "丙"]);
  const issues = auditStateChain(md);
  assert.ok(issues.some((item) => item.rule === "朝向跳变"));
});

test("状态链：有转身动作时不报朝向", () => {
  const md =
    shot(1, "甲面朝乙。乙站在门口。", "甲转身看向窗边。") +
    shot(2, "甲面朝丙。乙站在门口。丙站在窗边。", "甲继续开口。", ["甲", "乙", "丙"]);
  assert.deepEqual(auditStateChain(md), []);
});

test("状态链：方位修饰不同但朝向相同，不误报", () => {
  const md =
    shot(1, "甲坐在床沿，面朝亚瑟。乙躺在床上。", "甲开口。", ["甲", "乙"]) +
    shot(2, "甲坐在床沿，面朝右侧的亚瑟。乙躺在床上。", "甲继续。", ["甲", "乙"]);
  assert.deepEqual(auditStateChain(md), []);
});

test("状态链：宾语里的角色名不会被当成主语", () => {
  // 「面朝右侧的乙」里的乙是宾语，不能把甲的姿势算到乙头上
  const md =
    shot(1, "甲坐在床沿，面朝右侧的乙。", "甲开口。") +
    shot(2, "甲坐在床沿，面朝右侧的乙。", "甲继续。");
  assert.deepEqual(auditStateChain(md), []);
});
