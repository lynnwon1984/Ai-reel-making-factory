import test from "node:test";
import assert from "node:assert/strict";
import { verifyModelIssues, allowedKeys, droppedSummary } from "../src/qc-verify.js";
import { parseStoryboard } from "../src/storyboard.js";

const OUT = `第1集：测试
【分镜01】
[shot01 | 时长：8秒 | 场景：广场 外 雪天 | 人物：村长 | 道具：无]
人物空间位置：
村长站在广场中央。
Clip A | 时长：4秒 | 景别：MS
CAMERA: 固定机位 / MS. 村长抬头大喊。
EN: 村长: "Run!"
`;

const parsed = parseStoryboard(OUT);

test("引用校验：定位合法 + 引用属实 → 保留", () => {
  const { kept, dropped } = verifyModelIssues(
    [{ level: "高", where: "第1集 分镜01 ClipA", rule: "台词篡改", evidence: '原文"Run!" → 产出"Go!"' }],
    { parsed, outputText: OUT },
  );
  assert.equal(kept.length, 1);
  assert.equal(dropped.length, 0);
});

test("引用校验：分镜不在本批 → 丢弃", () => {
  const { kept, dropped } = verifyModelIssues(
    [{ level: "高", where: "第3集 分镜99", rule: "内容缺失", evidence: '"不存在"' }],
    { parsed, outputText: OUT },
  );
  assert.equal(kept.length, 0);
  assert.match(dropped[0].reason, /不在本批/);
});

test("引用校验：没有引用 → 丢弃", () => {
  const { dropped } = verifyModelIssues(
    [{ level: "中", where: "第1集 分镜01", rule: "空镜", evidence: "看起来空" }],
    { parsed, outputText: OUT },
  );
  assert.match(dropped[0].reason, /没有引用/);
});

test("引用校验：引用编造 → 丢弃", () => {
  const { dropped } = verifyModelIssues(
    [{ level: "高", where: "第1集 分镜01", rule: "台词篡改", evidence: '"这句话根本不存在"' }],
    { parsed, outputText: OUT },
  );
  assert.match(dropped[0].reason, /找不到/);
});

test("引用校验：没有定位 → 丢弃", () => {
  const { dropped } = verifyModelIssues(
    [{ level: "高", where: "全篇", rule: "台词篡改", evidence: '"Run!"' }],
    { parsed, outputText: OUT },
  );
  assert.match(dropped[0].reason, /没有可定位/);
});

test("引用校验：允许集合与汇总文案", () => {
  assert.deepEqual([...allowedKeys(parsed)], ["1-1"]);
  assert.match(
    droppedSummary([{ reason: "没有引用原文" }, { reason: "没有引用原文" }]),
    /没有引用原文 2 条/,
  );
});
