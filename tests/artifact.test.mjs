// 「每次调用把完整输入输出落盘」的验收测试。
//
// 这件事的意义不在留档，在于：模型会漂，而**回归样本是唯一能告诉你它什么时候变了的东西**。
// 样本库靠这个功能自己长大，所以它坏了必须能立刻发现。

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { safeSlug, writeArtifact } from "../server/dev-api.mjs";

const ENTRY = {
  at: "2026-10-12T08:30:00.000Z",
  label: "① 整理输出 第1轮",
  runId: "2026-10-12T08:29:00-abc",
  model: "deepseek-flash",
  effort: "low",
  status: "completed",
  ms: 163908,
  usage: { input_tokens: 57668, output_tokens: 52644 },
};

test("文件名不会因为标签里的特殊字符而炸掉", () => {
  assert.equal(safeSlug("① 整理输出 第1轮"), "①-整理输出-第1轮");
  assert.equal(safeSlug("a/b\\c:d*e?f"), "a-b-c-d-e-f");
  assert.equal(safeSlug(""), "run");
  assert.equal(safeSlug(undefined), "run");
  assert.ok(safeSlug("长".repeat(200)).length <= 60, "过长的标签要截断");
});

test("落盘的是完整输入 + 完整输出，能原样取回来", () => {
  const root = mkdtempSync(path.join(tmpdir(), "artifact-"));
  try {
    const input = "【原剧本】\n" + "甲".repeat(5000);
    const output = "第1集：开篇\n" + "乙".repeat(5000);
    const rel = writeArtifact(root, ENTRY, "你是剧本助手", input, output);

    assert.ok(rel, "应该返回相对路径");
    assert.match(rel, /^runs\/artifacts\//);

    const saved = JSON.parse(readFileSync(path.join(root, rel), "utf8"));
    assert.equal(saved.input, input, "输入必须一字不差");
    assert.equal(saved.output, output, "输出必须一字不差");
    assert.equal(saved.instructions, "你是剧本助手");
    assert.equal(saved.model, "deepseek-flash", "要记下模型是谁，否则漂移了也没法归因");
    assert.equal(saved.effort, "low");
    assert.equal(saved.outputChars, undefined, "entry 里的字段原样带上即可");
    assert.equal(saved.usage.input_tokens, 57668);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("同名不覆盖：同一秒内两次调用也要各留一份", () => {
  const root = mkdtempSync(path.join(tmpdir(), "artifact-"));
  try {
    const a = writeArtifact(root, ENTRY, "i", "in", "out-A");
    const b = writeArtifact(root, { ...ENTRY, label: "① 整理输出 第2轮" }, "i", "in", "out-B");
    assert.notEqual(a, b);
    assert.equal(JSON.parse(readFileSync(path.join(root, a), "utf8")).output, "out-A");
    assert.equal(JSON.parse(readFileSync(path.join(root, b), "utf8")).output, "out-B");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
