// 流程一「分块连续输出」的验收测试。
//
// 这是流程一里最容易出静默错误的一段：8.5 万字的产出没人会逐字核对，
// 续跑逻辑要是坏了，你只会拿到一份**被截断**的剧本，而且看不出来。
// 所以这里用假的上游流，把三种情况都钉住。

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  runChunked,
  buildRoundInput,
  MAX_ROUNDS,
  TAIL_KEEP,
} from "../src/chunked.js";

/** 造一个假的模型：按剧本依次返回，最后一轮之后都算跑完 */
function fakeModel(script) {
  const calls = [];
  return {
    calls,
    callModel: async ({ input, round }) => {
      calls.push({ input, round });
      const step = script[Math.min(round - 1, script.length - 1)];
      return step;
    },
  };
}

test("一轮就跑完时，不续跑", async () => {
  const { calls, callModel } = fakeModel([{ text: "全部内容", status: "completed" }]);
  const res = await runChunked({ callModel, seed: "请输出", prefix: "【原剧本】" });
  assert.equal(res.rounds, 1);
  assert.equal(res.text, "全部内容");
  assert.equal(res.truncated, false);
  assert.equal(calls.length, 1);
});

test("被截断时自动续跑，内容按顺序拼接", async () => {
  const { calls, callModel } = fakeModel([
    { text: "第一段", status: "incomplete" },
    { text: "第二段", status: "incomplete" },
    { text: "第三段", status: "completed" },
  ]);
  const res = await runChunked({ callModel, seed: "请输出", prefix: "【原剧本】" });
  assert.equal(res.rounds, 3);
  assert.equal(res.text, "第一段第二段第三段");
  assert.equal(res.truncated, false);
  assert.equal(calls.length, 3);
});

test("一直截断就停在轮次上限，并明确标出 truncated", async () => {
  const { calls, callModel } = fakeModel([{ text: "永远吐不完", status: "incomplete" }]);
  const res = await runChunked({ callModel, seed: "请输出" });
  assert.equal(res.rounds, MAX_ROUNDS);
  assert.equal(res.truncated, true, "必须能知道这次是没跑完的");
  assert.equal(calls.length, MAX_ROUNDS);
});

test("第一轮发的是 seed；续跑轮发的是 next + 已输出内容的结尾", async () => {
  // 首尾用不同标记，才能验出"只带了结尾"
  const HEAD = "【开头】".repeat(20);
  const TAIL = "【结尾】".repeat(20);
  const long = HEAD + "中".repeat(2600) + TAIL;
  const { calls, callModel } = fakeModel([
    { text: long, status: "incomplete" },
    { text: "尾巴", status: "completed" },
  ]);
  await runChunked({
    callModel,
    prefix: "【原剧本】",
    seed: "【请输出整理后的剧本】",
    next: "【请继续输出剩余部分】",
  });

  assert.ok(calls[0].input.includes("【请输出整理后的剧本】"), "第一轮应带 seed");
  assert.ok(!calls[0].input.includes("【请继续输出剩余部分】"), "第一轮不该带 next");

  const second = calls[1].input;
  assert.ok(second.includes("【请继续输出剩余部分】"), "续跑轮应带 next");
  assert.ok(second.includes("【已输出内容的结尾】"), "续跑轮应带上一轮结尾");
  assert.ok(second.includes(TAIL), "带上来的应包含已输出内容的结尾");
  assert.ok(second.includes(long.slice(-TAIL_KEEP)), "结尾那一段要完整带上");
  assert.ok(!second.includes(HEAD), "只带结尾，不该把整段已输出内容再塞回去");
});

test("稳定前缀始终在最前（为了命中上下文缓存）", async () => {
  const { calls, callModel } = fakeModel([
    { text: "a", status: "incomplete" },
    { text: "b", status: "completed" },
  ]);
  await runChunked({ callModel, prefix: "【原剧本】XYZ", seed: "请输出", next: "继续" });
  for (const c of calls) {
    assert.ok(c.input.startsWith("【原剧本】XYZ"), "前缀必须在最前面，否则缓存命中不了");
  }
});

test("每轮结束都回调 onProgress，中途不会丢进度", async () => {
  const seen = [];
  const { callModel } = fakeModel([
    { text: "一", status: "incomplete" },
    { text: "二", status: "completed" },
  ]);
  await runChunked({ callModel, seed: "s", onProgress: (full) => seen.push(full) });
  assert.deepEqual(seen, ["一", "一二"], "每一轮都要把累计结果交出去落盘");
});

test("续跑时能从既有内容接着跑（重试不从头再来）", async () => {
  const { calls, callModel } = fakeModel([{ text: "接着写", status: "completed" }]);
  const res = await runChunked({ callModel, prefix: "P", seed: "S", existing: "已经跑过的部分" });
  assert.equal(res.text, "已经跑过的部分接着写");
  assert.ok(calls[0].input.includes("已经跑过的部分"), "重试应把已产出内容带回去");
  assert.ok(!calls[0].input.includes("S"), "已有内容时不该再用 seed 重开");
});

test("上游报错会往上抛，不会被当成'跑完了'吞掉", async () => {
  await assert.rejects(
    runChunked({
      callModel: async () => {
        throw new Error("上游挂了");
      },
      seed: "s",
    }),
    /上游挂了/,
  );
});

test("buildRoundInput 是纯函数", () => {
  assert.equal(buildRoundInput({ prefix: "P", seed: "S", next: "N", full: "" }), "P\n\nS");
  assert.match(buildRoundInput({ prefix: "P", seed: "S", next: "N", full: "已写" }), /^P\n\nN/);
});
