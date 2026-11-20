import { test } from "node:test";
import assert from "node:assert/strict";

import { auditBlocking, parseBlockingShots } from "../src/blocking.js";

function shot({ no = 1, cast = "甲、乙", space = "甲坐在画面左侧，乙站在画面右侧门口。" } = {}) {
  return `【分镜${String(no).padStart(2, "0")}】
[shot${String(no).padStart(2, "0")} | 时长：5秒 | 场景：房间 内 日 | 人物：${cast} | 道具：无]
${space ? `人物空间位置：\n${space}\n` : ""}Clip A | 时长：5秒 | 景别：MCU
CAMERA: 固定机位 / MCU. 甲抬头。
`;
}

test("blocking：人物表与空间位置对得上 → 不报", () => {
  assert.deepEqual(auditBlocking(shot()), []);
});

test("blocking：能拆出人物表与空间位置", () => {
  const shots = parseBlockingShots(shot());
  assert.deepEqual(shots[0].cast, ["甲", "乙"]);
  assert.match(shots[0].space, /甲坐在画面左侧/);
});

test("blocking：人物表有、空间位置没有 → 中风险", () => {
  const issues = auditBlocking(shot({ cast: "甲、乙、丙" }));
  assert.equal(issues.length, 1);
  assert.equal(issues[0].level, "中");
  assert.equal(issues[0].rule, "人物未定位");
  assert.match(issues[0].evidence, /丙/);
});

test("blocking：缺整行空间位置 → 中风险", () => {
  const issues = auditBlocking(shot({ space: "" }));
  assert.equal(issues.length, 1);
  assert.equal(issues[0].rule, "缺空间位置");
});

test("blocking：空间位置没有任何方位词 → 低风险", () => {
  const issues = auditBlocking(shot({ cast: "甲", space: "甲站着。" }));
  assert.ok(issues.some((item) => item.rule === "空间位置无方位"));
});

test("blocking：称谓不一致 → 低风险而不是未定位", () => {
  const issues = auditBlocking(
    shot({ cast: "巴里长老", space: "巴里站在画面右侧，面朝石墙。" }),
  );
  assert.equal(issues.length, 1);
  assert.equal(issues[0].level, "低");
  assert.equal(issues[0].rule, "称谓不一致");
});

test("blocking：保留称谓省掉姓氏也认作同一人", () => {
  const issues = auditBlocking(
    shot({
      cast: "诺曼伯爵夫人",
      space: "伯爵夫人在画面左侧，朝缺口方向奔跑。",
    }),
  );
  assert.equal(issues.length, 1);
  assert.equal(issues[0].rule, "称谓不一致");
});

test("blocking：多镜各自检查，互不串场", () => {
  const md =
    shot({ no: 1, cast: "甲、乙" }) +
    shot({ no: 2, cast: "甲、乙、丙", space: "甲站在画面左侧，乙在右侧。" });
  const issues = auditBlocking(md);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].where, "分镜02");
});
