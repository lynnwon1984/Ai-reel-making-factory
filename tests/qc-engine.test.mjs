import test from "node:test";
import assert from "node:assert/strict";
import { runEngineQc, flatten } from "../src/qc-engine.js";

const SRC = `第1集：测试
△村长站在广场中央，抬头看天。
**村长**："Run!"
△黑龙从空中俯冲下来，村长转身跑向木屋。
**村长**（低声）："Thank you."
`;

const OUT_OK = `第1集：测试
【分镜01】
[shot01 | 时长：8秒 | 场景：广场 外 雪天 | 人物：村长（Village Chief，着装：粗布冬装） | 道具：无]
人物空间位置：
村长站在广场中央。
Clip A | 时长：4秒 | 景别：MS
CAMERA: 固定机位 / MS. 村长抬头看天，大喊。
EN: 村长: "Run!"
Clip B | 时长：4秒 | 景别：WS
CAMERA: 跟拍 / WS. 黑龙俯冲，村长转身跑向木屋。
EN: 村长（O.S.）: "Thank you."
`;

test("引擎：干净的产出不报问题", () => {
  assert.deepEqual(runEngineQc(SRC, OUT_OK), []);
});

test("引擎：台词被改写 → 高危台词篡改", () => {
  const out = OUT_OK.replace('"Run!"', '"Go away!"');
  const hit = runEngineQc(SRC, out).find((i) => i.rule === "台词篡改");
  assert.ok(hit, "应该报出台词篡改");
  assert.equal(hit.level, "高");
  assert.match(hit.evidence, /Go away/);
});

test("引擎：整句台词漏掉 → 高危漏台词", () => {
  const out = OUT_OK.replace('\nEN: 村长（O.S.）: "Thank you."', "");
  const hit = runEngineQc(SRC, out).find((i) => i.rule === "漏台词");
  assert.ok(hit);
  assert.equal(hit.level, "高");
  assert.match(hit.evidence, /thankyou/);
});

test("引擎：凭空多出来的人物 → 高危新增人物", () => {
  const out = OUT_OK.replace(
    "人物：村长（Village Chief，着装：粗布冬装）",
    "人物：村长（Village Chief，着装：粗布冬装）、神秘刺客（Assassin，着装：黑衣）",
  );
  const hit = runEngineQc(SRC, out).find((i) => i.rule === "新增人物");
  assert.ok(hit);
  assert.equal(hit.level, "高");
});

test("引擎：相邻 Clip 描述雷同 → 中危重复镜头", () => {
  const out = OUT_OK.replace(
    "CAMERA: 跟拍 / WS. 黑龙俯冲，村长转身跑向木屋。",
    "CAMERA: 固定机位 / MS. 村长抬头看天，大喊。",
  );
  assert.ok(runEngineQc(SRC, out).some((i) => i.rule === "重复镜头"));
});

test("引擎：空镜命中", () => {
  const out = OUT_OK.replace(
    "CAMERA: 跟拍 / WS. 黑龙俯冲，村长转身跑向木屋。\nEN: 村长（O.S.）: \"Thank you.\"",
    "CAMERA: 固定机位 / WS. 雪地。",
  );
  assert.ok(runEngineQc(SRC, out).some((i) => i.rule === "空镜"));
});

test("引擎：flatten 去掉标点空白", () => {
  assert.equal(flatten('Run! "Go"'), "rungo");
});

test("引擎：两句原文拼成一句 → 中危台词合并，不是篡改", () => {
  const src = `第1集：测试
**村长**（高声）：Run!
**村长**（低声）：Thank you.
`;
  const out = `第1集：测试
【分镜01】
[shot01 | 时长：8秒 | 场景：广场 外 雪天 | 人物：村长 | 道具：无]
人物空间位置：
村长站在广场中央。
Clip A | 时长：8秒 | 景别：MS
CAMERA: 固定机位 / MS. 村长抬头看天，大喊。
EN: 村长: "Run! Thank you."
`;
  const issues = runEngineQc(src, out);
  assert.equal(issues.filter((i) => i.rule === "台词篡改").length, 0);
  assert.equal(issues.filter((i) => i.rule === "台词合并").length, 1);
  assert.equal(issues.find((i) => i.rule === "台词合并").level, "中");
});
