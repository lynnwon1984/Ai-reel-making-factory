import test from "node:test";
import assert from "node:assert/strict";
import {
  parseQc,
  countByLevel,
  sortIssues,
  topIssues,
  hasHigh,
  collectBatchIssues,
} from "../src/qc.js";

const REPLY = `好的，以下是质检结果：
[高] 第1集 分镜07 ClipB | 台词篡改 | 原文"Run!" → 产出"Go!"
[中] 第1集 分镜12 | 重复镜头 | 同一动作拍了两遍
[低] 第2集 分镜03 | 表述歧义 | "他"指代不明
`;

test("质检解析：只认带级别的行", () => {
  const issues = parseQc(REPLY);
  assert.equal(issues.length, 3);
  assert.equal(issues[0].level, "高");
  assert.equal(issues[0].where, "第1集 分镜07 ClipB");
  assert.equal(issues[0].rule, "台词篡改");
  assert.match(issues[0].evidence, /Run!/);
});

test("质检解析：无问题时返回空", () => {
  assert.deepEqual(parseQc("无"), []);
  assert.deepEqual(parseQc(""), []);
});

test("质检解析：容错全角括号和多余前缀", () => {
  const issues = parseQc("【中】第3集 分镜01 | 空镜 | 无动作");
  assert.equal(issues.length, 1);
  assert.equal(issues[0].level, "中");
});

test("质检统计与排序：高在前", () => {
  const issues = parseQc(REPLY);
  assert.deepEqual(countByLevel(issues), { 高: 1, 中: 1, 低: 1 });
  assert.equal(sortIssues(issues)[0].level, "高");
  assert.equal(sortIssues(issues)[2].level, "低");
});

test("质检：topIssues 截断且优先高危", () => {
  const issues = parseQc(REPLY);
  const top = topIssues(issues, 2);
  assert.equal(top.length, 2);
  assert.equal(top[0].level, "高");
});

test("质检：hasHigh 判定", () => {
  assert.equal(hasHigh(parseQc(REPLY)), true);
  assert.equal(hasHigh(parseQc("[中] 第1集 分镜01 | 空镜 | 无")), false);
});

test("质检：跨批汇总按级别排", () => {
  const batches = [
    { qc: parseQc("[低] 第1集 分镜01 | 歧义 | x") },
    { qc: parseQc("[高] 第2集 分镜02 | 台词篡改 | y") },
  ];
  const all = collectBatchIssues(batches);
  assert.equal(all[0].level, "高");
  assert.equal(all.length, 2);
});
