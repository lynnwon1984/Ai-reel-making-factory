import test from "node:test";
import assert from "node:assert/strict";

import {
  auditBeatClaims,
  buildSourceBeats,
  numberStoryboardBeats,
  parseBeatRange,
} from "../src/beat-claim.js";
import { parseStoryboard } from "../src/storyboard.js";

const SOURCE = `第1集：测试
1-1 Courtyard 外 夜
人物：亚瑟（Arthur）、休斯（Hughes）
△亚瑟从庭院左侧大步走来。
△亚瑟在庭院中央停下脚步，看向休斯。
亚瑟（语气强硬）：Give me the firewood!
△休斯从木箱上站起，右手托起火球。
`;

function outputWithClaims(claims) {
  return `第1集：测试
${claims
  .map(
    (claim, index) => `【分镜${String(index + 1).padStart(2, "0")}】
[shot${String(index + 1).padStart(2, "0")} | 拍：${claim} | 时长：5秒 | 场景：Courtyard 外 夜 | 人物：亚瑟、休斯 | 道具：火球]
人物空间位置：
亚瑟站在庭院中央，休斯站在他对面。
Clip A | 时长：5秒 | 景别：MS
CAMERA: 固定机位 / MS. 人物完成本拍动作。`,
  )
  .join("\n\n")}`;
}

test("源拍编号：动作与台词逐行编号，场景头不占拍", () => {
  const numbered = numberStoryboardBeats(SOURCE);
  const beats = buildSourceBeats(SOURCE).all;
  assert.equal(beats.length, 4);
  assert.deepEqual(
    beats.map((beat) => beat.kind),
    ["action", "action", "dialogue", "action"],
  );
  assert.match(numbered.text, /\[拍01\] △亚瑟从庭院左侧大步走来。/);
  assert.match(numbered.text, /\[拍03\] 亚瑟（语气强硬）：Give me the firewood!/);
  assert.doesNotMatch(numbered.text, /\[拍\d+\] 人物：/);
});

test("拍号解析：支持单拍、区间和列表", () => {
  assert.deepEqual(parseBeatRange("1-3"), { start: 1, end: 3, nos: [1, 2, 3] });
  assert.deepEqual(parseBeatRange("2–4"), { start: 2, end: 4, nos: [2, 3, 4] });
  assert.deepEqual(parseBeatRange("1,2"), { start: 1, end: 2, nos: [1, 2] });
  assert.equal(parseBeatRange("一至三"), null);
});

test("解析：shot 表头能读出拍号", () => {
  const parsed = parseStoryboard(outputWithClaims(["1", "2", "3", "4"]));
  assert.deepEqual(parsed.episodes[0].shots[1].beatClaim, {
    start: 2,
    end: 2,
    nos: [2],
  });
});

test("认领校验：逐拍连续、每个动作单独成镜 → 通过", () => {
  assert.deepEqual(auditBeatClaims(outputWithClaims(["1", "2", "3", "4"]), SOURCE), []);
});

test("认领校验：缺少拍号 → 高危", () => {
  const output = outputWithClaims(["1", "2", "3", "4"]).replace("拍：2 | ", "");
  const issues = auditBeatClaims(output, SOURCE);
  assert.ok(issues.some((issue) => issue.level === "高" && issue.rule === "缺少源拍认领"));
});

test("认领校验：两个独立动作源拍压进一个 shot → 高危", () => {
  const issues = auditBeatClaims(outputWithClaims(["1-2", "3", "4"]), SOURCE);
  assert.ok(issues.some((issue) => issue.rule === "跨源行动作合并"));
});

test("认领校验：跳拍、重复和倒序都会被拦住", () => {
  const skipped = auditBeatClaims(outputWithClaims(["1", "3", "4"]), SOURCE);
  assert.ok(skipped.some((issue) => issue.rule === "源拍跳号"));
  assert.ok(skipped.some((issue) => issue.rule === "源拍漏认领"));

  const repeated = auditBeatClaims(outputWithClaims(["1", "1", "2", "3", "4"]), SOURCE);
  assert.ok(repeated.some((issue) => issue.rule === "源拍重复或倒序"));
  assert.ok(repeated.some((issue) => issue.rule === "源拍重复认领"));
});

test("认领校验：一个 shot 超过三拍 → 高危且不漏报", () => {
  const issues = auditBeatClaims(outputWithClaims(["1-4"]), SOURCE);
  assert.ok(issues.some((issue) => issue.rule === "单镜认领过多"));
});

test("认领校验：台词塞不进本镜时长 → 高危", () => {
  const longSource = SOURCE.replace(
    "Give me the firewood!",
    "I have already told you many times that I need every single piece of the magic firewood tonight before the snow gets any heavier",
  );
  const output = outputWithClaims(["1", "2", "3", "4"]);
  const issues = auditBeatClaims(output, longSource);
  assert.ok(issues.some((issue) => issue.rule === "台词语速超载"));
});

test("兼容旧稿：明确关闭认领要求时，旧分镜不被一刀切误报", () => {
  const legacy = outputWithClaims(["1", "2", "3", "4"]).replaceAll(/拍：\d+ \| /g, "");
  assert.deepEqual(auditBeatClaims(legacy, SOURCE, { requireClaims: false }), []);
});
