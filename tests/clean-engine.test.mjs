import { test } from "node:test";
import assert from "node:assert/strict";

import { analyzeFormatScript } from "../src/clean-engine.js";
import { parseChecklist } from "../src/checklist.js";

const SAMPLE = `第2集：测试
1-1 大厅 内 夜
人物：甲（A，着装：黑色礼服）、群众若干（Crowd）
△甲举着金杯，身穿黑色礼服，走向人群。
【音效】酒杯碰撞。
【字幕】Varus
甲（低声）：Stay here.
△一只手伸向金杯。
1-3 大厅 内 夜
人物：乙（B，着装：白色礼服）
△乙举着金色酒杯。
乙：Wait.
甲：Stay here.
`;

test("本地格式引擎：输出固定的 11 类统一确认清单", () => {
  const result = analyzeFormatScript(SAMPLE);
  const items = parseChecklist(result.checklist);
  assert.equal(items.length, 11);
  assert.deepEqual(
    items.map((item) => item.no),
    Array.from({ length: 11 }, (_, index) => index + 1),
  );
  assert.equal(result.stats.episodes, 1);
  assert.equal(result.stats.scenes, 2);
  assert.ok(result.stats.issues > 0);
  assert.equal(items[10].risk, true, "含候选/待判断项的其他决策项默认不勾选");
});

test("本地格式引擎：抓标题编号、标记、着装、重复与主语候选", () => {
  const result = analyzeFormatScript(SAMPLE);
  assert.match(result.checklist, /集号需按出现顺序重排/);
  assert.match(result.checklist, /1-3 场号不连续/);
  assert.match(result.checklist, /【音效】1 处/);
  assert.match(result.checklist, /【字幕】1 处/);
  assert.match(result.checklist, /黑色礼服/);
  assert.match(result.checklist, /群众若干.*缺着装/);
  assert.match(result.checklist, /一只手伸向金杯/);
  assert.match(result.checklist, /甲：Stay here|Stay here/);
  assert.match(result.checklist, /同名场次候选/);
});

test("本地格式引擎：同一输入重复运行结果完全一致", () => {
  assert.deepEqual(analyzeFormatScript(SAMPLE), analyzeFormatScript(SAMPLE));
});

