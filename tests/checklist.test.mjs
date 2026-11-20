// 流程一「清单解析 + 确认链」的验收测试。
//
// 断的不是"跑得通"，是那条看不见的链：
//   模型给 N 项 → 解析出 N 项 → 用户在页面上勾掉某项 → 回给模型的话里必须正好反映这个决定
// 这条链上任何一环静默丢信息，产出都会"看起来正常但漏了处理"。

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  parseChecklist,
  canReviewPerItem,
  buildDecisionText,
  splitDiagnosticReports,
} from "../src/checklist.js";

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const read = (f) => readFileSync(path.join(DIR, f), "utf8");

/* ---------------- 真实样本：编号列表格式 ---------------- */

test("编号列表：真实《统一确认清单》11 个顶层项一个不少", () => {
  const items = parseChecklist(read("checklist-numbered.txt"));
  assert.equal(items.length, 11, "真实样本有 11 个顶层项，少一个就是静默丢项");
  assert.deepEqual(
    items.map((it) => it.no),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    "编号必须连续",
  );
  assert.match(items[0].title, /拟合并场次/);
  assert.match(items[10].title, /其他需用户决策项/);
});

/* ---------------- 真实样本：表格格式 ---------------- */

test("表格：真实《逻辑诊断清单》22 行全部解析出来", () => {
  const items = parseChecklist(read("checklist-table.txt"));
  assert.equal(items.length, 22, "真实样本有 L1–L22 共 22 行");
  assert.deepEqual(
    items.map((it) => it.id),
    Array.from({ length: 22 }, (_, i) => `L${i + 1}`),
    "编号必须是 L1…L22 且保持顺序",
  );
});

test("表格：风险等级按 L3 保守判定，只有该 L3 的才是 L3", () => {
  const items = parseChecklist(read("checklist-table.txt"));
  const risky = items.filter((it) => it.risk).map((it) => it.id);
  assert.deepEqual(
    risky,
    ["L1", "L2", "L3", "L7", "L9", "L14", "L19"],
    "风险列写 L3 的才要求单独授权；写成「—」的不该被拉进来",
  );
});

/* ---------------- 确认链对账 ---------------- */

test("确认链：清单 N 项 → 回给模型的裁定必须正好 N 行，且逐项对上", () => {
  const items = parseChecklist(read("checklist-numbered.txt"));
  const cancelled = 6;
  const text = buildDecisionText(
    items,
    (it) => it.no !== cancelled,
    "第 6 项改为只删一半",
  );

  const rulings = [
    ...text.matchAll(/^- 第 (\d+) 项（(.+?)）：(确认执行|不执行)$/gm),
  ].map((m) => ({ no: Number(m[1]), verdict: m[3] }));

  assert.equal(rulings.length, items.length, "裁定行数必须等于清单项数");
  assert.deepEqual(
    rulings.map((r) => r.no),
    items.map((it) => it.no),
    "裁定行必须逐项对应，不能少也不能重排",
  );
  assert.equal(
    rulings.filter((r) => r.verdict === "不执行").length,
    1,
    "只取消了第 6 项，就该只有一条「不执行」",
  );
  assert.equal(rulings.find((r) => r.no === cancelled).verdict, "不执行");
  assert.match(text, /合计：确认 10 项，不执行 1 项/);
  assert.ok(text.includes("第 6 项改为只删一半"), "补充要求必须带上");
  assert.ok(text.includes("不得执行"), "必须写明被取消的项一律不执行");
});

test("确认链：全部确认时不该出现任何「不执行」裁定", () => {
  const items = parseChecklist(read("checklist-numbered.txt"));
  const text = buildDecisionText(items, () => true, "");
  const rulings = [...text.matchAll(/^- 第 (\d+) 项（(.+?)）：(确认执行|不执行)$/gm)];
  assert.equal(rulings.length, items.length);
  assert.equal(rulings.filter((m) => m[3] === "不执行").length, 0);
  assert.match(text, /合计：确认 11 项，不执行 0 项/);
});

/* ---------------- 边界 ---------------- */

test("边界：解析不出清单时退回整体确认，而不是给一个空清单", () => {
  for (const junk of ["", "这是一段没有清单的普通文字。\n就两行。", "| 只有一个表头 |\n| --- |"]) {
    const items = parseChecklist(junk);
    assert.equal(
      canReviewPerItem(items),
      false,
      `「${junk.slice(0, 12)}」不该够格走逐项确认`,
    );
  }
});

test("边界：只有 2 项时不够格逐项确认", () => {
  const two = "## 1. 甲\n- x\n\n## 2. 乙\n- y\n";
  assert.equal(canReviewPerItem(parseChecklist(two)), false);
  const three = `${two}\n## 3. 丙\n- z\n`;
  assert.equal(canReviewPerItem(parseChecklist(three)), true);
});

test("边界：buildDecisionText 面对空清单不崩", () => {
  const text = buildDecisionText([], () => true, "");
  assert.match(text, /合计：确认 0 项，不执行 0 项/);
});

test("多份诊断：按标题拆分，并给所有可确认项分配全局唯一编号", () => {
  const first = read("checklist-table.txt");
  const second = `| 编号 | 原文 | 英文 | 风险 |
| --- | --- | --- | --- |
| T1 | 你好 | Hello | L1 |
| T2 | 再见 | Goodbye | L1 |
| T3 | 快走 | Move | L1 |`;
  const reports = splitDiagnosticReports(
    `## 《逻辑诊断清单》\n${first}\n\n## 《台词翻译确认清单》\n${second}`,
  );

  assert.deepEqual(
    reports.map((report) => report.title),
    ["逻辑诊断清单", "台词翻译确认清单"],
  );
  assert.equal(reports[0].items.length, 22);
  assert.equal(reports[1].items.length, 3);
  const all = reports.flatMap((report) => report.items);
  assert.deepEqual(
    all.map((item) => item.no),
    Array.from({ length: 25 }, (_, i) => i + 1),
  );
  assert.ok(all.every((item) => item.title.includes(item.section)));
});

test("多份诊断：没有标准标题时退回空数组，由界面展示原始文本", () => {
  assert.deepEqual(splitDiagnosticReports("普通诊断，没有多份报告标题。"), []);
});
