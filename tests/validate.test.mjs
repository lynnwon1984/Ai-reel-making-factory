// 流程一「输出校验器」的验收测试。
//
// 校验器是流程一唯一"由程序保证"的东西，却一直没有测试。
// 这里每条规则各给一个正例和一个反例 —— 只报正例等于没测。

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { validateScript } from "../src/validate.js";

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const read = (f) => readFileSync(path.join(DIR, f), "utf8");

const levelOf = (result, title) =>
  result.checks.find((c) => c.title.includes(title))?.level;

/** 一份最小合格剧本 */
const GOOD = `第1集：开篇

1-1 甲地 外 晴
人物：甲（A，着装：黑衣）
△甲站着。
甲（低声）：Hello.

1-2 乙地 内 夜
人物：乙（B，着装：白衣）
△乙走进来。
乙（急促）：Run.
`;

test("合格剧本：全部检查项通过", () => {
  const r = validateScript(GOOD);
  const warns = r.checks.filter((c) => c.level === "warn");
  assert.deepEqual(warns, [], `不该有告警：${warns.map((w) => w.title).join("；")}`);
  assert.match(r.stats, /共 1 集 · 2 场/);
});

test("集号不连续：抓得到", () => {
  const bad = GOOD.replace("第1集：开篇", "第1集：开篇").replace(
    "1-2 乙地 内 夜",
    "1-2 乙地 内 夜",
  ) + "\n第3集：跳号\n\n3-1 丙地 外 雨\n人物：丙（C，着装：灰衣）\n△丙站着。\n";
  assert.equal(levelOf(validateScript(bad), "集号不连续"), "warn");
});

test("场次跳号：抓得到", () => {
  const bad = GOOD.replace("1-2 乙地 内 夜", "1-5 乙地 内 夜");
  assert.equal(levelOf(validateScript(bad), "场次编号不连续"), "warn");
});

test("场次编号与所属集不一致：抓得到", () => {
  const bad = GOOD.replace("1-2 乙地 内 夜", "2-2 乙地 内 夜");
  assert.equal(levelOf(validateScript(bad), "场次编号与所属集不一致"), "warn");
});

test("【音效】【字幕】标记残留：抓得到", () => {
  const bad = GOOD.replace("△甲站着。", "△【音效】门铃响。\n△【字幕】Hall。甲站着。");
  assert.equal(levelOf(validateScript(bad), "标记残留"), "warn");
});

test("人物行缺「着装：」：抓得到", () => {
  const bad = GOOD.replace("人物：乙（B，着装：白衣）", "人物：乙（B）");
  assert.equal(levelOf(validateScript(bad), "人物行问题"), "warn");
});

test("缺人物行：抓得到", () => {
  const bad = GOOD.replace("人物：乙（B，着装：白衣）\n", "");
  assert.equal(levelOf(validateScript(bad), "人物行问题"), "warn");
});

test("空场：抓得到", () => {
  const bad = GOOD.replace("人物：乙（B，着装：白衣）\n△乙走进来。\n乙（急促）：Run.\n", "");
  assert.equal(levelOf(validateScript(bad), "空场"), "warn");
});

test("正文残留着装描述：抓得到（启发式）", () => {
  const bad = GOOD.replace("△甲站着。", "△甲穿着黑色风衣站着。");
  assert.equal(levelOf(validateScript(bad), "正文可能残留着装描述"), "warn");
});

test("模型在正文前附的说明不算正文：不误报标记残留", () => {
  const ok = `说明：本次保留了原文的【字幕】标记，未做删除。\n\n${GOOD}`;
  assert.equal(levelOf(validateScript(ok), "标记残留"), "ok");
});

/* ---------------- 真实样本触发过的误报（回归锁） ---------------- */

test("正文句子以「第N集」开头时，不能被当成集标题", () => {
  // 真实剧本末尾就是这句，曾经把 11 集数成 12 集、误报「集号不连续」
  const withNote = `${GOOD}\n第11集后半缺失：原文在“奥尔德里奇”处中断，请补发。\n`;
  const r = validateScript(withNote);
  assert.equal(levelOf(r, "集号不连续"), undefined, "不该误报集号不连续");
  assert.equal(levelOf(r, "集号连续"), "ok");
  assert.match(r.stats, /共 1 集/, "不该把这个句子数成第 11 集");
});

test("真实产出：《标准化剧本》检查结果稳定", () => {
  const r = validateScript(read("final-script.txt"));
  assert.match(r.stats, /共 11 集 · 27 场/);
  assert.equal(levelOf(r, "集号连续"), "ok");
  assert.equal(levelOf(r, "场次编号连续"), "ok");
  assert.equal(levelOf(r, "无【音效】【字幕】标记残留"), "ok");
  assert.equal(levelOf(r, "无空场"), "ok");
  // 这两条是**真实存在**的问题，不是误报：5 个场次有配角没标着装、2 处正文残留着装描述
  assert.equal(levelOf(r, "人物行问题"), "warn");
  assert.equal(levelOf(r, "正文可能残留着装描述"), "warn");
});
