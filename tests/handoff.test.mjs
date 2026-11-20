// 流程之间交接的验收测试：npm run test:engine 会一起跑

import { test } from "node:test";
import assert from "node:assert/strict";

// handoff.js 只在函数体内碰 localStorage，所以这里可以安全地打桩
function makeStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
  };
}

globalThis.localStorage = makeStorage();

const {
  CLEAN_KEY,
  SPLIT_KEY,
  STORYBOARD_KEY,
  readStore,
  writeStore,
  handOffToSplit,
  handOffToStoryboard,
  readCleanResult,
} = await import("../src/handoff.js");

const reset = () => globalThis.localStorage.clear();

test("交接：流程一没有结果时，流程二不该出现「带入」入口", () => {
  reset();
  assert.equal(readCleanResult(), null);

  writeStore(CLEAN_KEY, { final: "", organized: "" });
  assert.equal(readCleanResult(), null, "两步都空时不算有结果");
});

test("交接：优先带入标准化剧本，其次才是整理后的剧本", () => {
  reset();
  writeStore(CLEAN_KEY, { organized: "整理稿", fileName: "甲" });
  assert.deepEqual(readCleanResult(), { text: "整理稿", fileName: "甲" });

  writeStore(CLEAN_KEY, { organized: "整理稿", final: "标准化稿", fileName: "乙" });
  assert.equal(readCleanResult().text, "标准化稿", "有标准化稿时应优先用它");
});

test("交接：一键带入后，流程二的输入就绪、且被重置到分析前的状态", () => {
  reset();
  handOffToSplit({ text: "第1集：测试\n1-1 甲地 外 晴\n人物：甲（A，着装：黑衣）\n△甲站着。\n", fileName: "标准化剧本.txt" });

  const s = readStore(SPLIT_KEY);
  assert.ok(s.text.includes("甲站着"), "剧本内容应被带过去");
  assert.equal(s.stage, "done", "应直接进入可分析状态");
  assert.equal(s.fileName, "标准化剧本", "文件名应去掉扩展名");
  assert.deepEqual(s.splits, {}, "应清掉上一份剧本的场内切点");
  assert.equal(s.cuts, null, "应清掉上一次的切分结果");
  assert.deepEqual(s.overrides, {}, "应清掉上一次的手改值");
  assert.equal(s.autoSplitVersion, 0, "载入流程二后应由新引擎重建自动切点");
  assert.equal(s.error, "");
});

test("交接：带入不会冲掉用户在流程二里调过的参数", () => {
  reset();
  writeStore(SPLIT_KEY, {
    options: { cjkRate: 5, windowLo: 70, windowHi: 110 },
    showKnobs: true,
  });
  handOffToSplit({ text: "甲", fileName: "乙.txt" });

  const s = readStore(SPLIT_KEY);
  assert.equal(s.options.cjkRate, 5, "参数应保留");
  assert.equal(s.options.windowHi, 110, "参数应保留");
  assert.equal(s.showKnobs, true, "界面偏好应保留");
  assert.equal(s.text, "甲");
});

test("交接：流程二确认版会完整写入流程三，并保留生成偏好", () => {
  reset();
  writeStore(STORYBOARD_KEY, {
    customPrompt: "我的分镜提示词",
    batchSize: 2,
    checkpoint: 1,
    qcEnabled: false,
    batches: [{ from: 1, to: 2, text: "旧分镜" }],
    cursor: 1,
    stage: "done",
  });

  handOffToStoryboard({
    text: "第1集：测试\n1-1 甲地 外 晴\n△甲站着。",
    fileName: "分集稿.md",
  });

  const s = readStore(STORYBOARD_KEY);
  assert.match(s.text, /1-1 甲地/);
  assert.equal(s.stage, "input");
  assert.equal(s.fileName, "分集稿");
  assert.equal(s.customPrompt, "我的分镜提示词", "不应冲掉自定义提示词");
  assert.equal(s.batchSize, 2, "不应冲掉批次设置");
  assert.equal(s.qcEnabled, false, "不应冲掉质检设置");
  assert.deepEqual(s.batches, [], "新剧本应清掉旧分镜结果");
  assert.equal(s.cursor, 0);
});

test("交接：损坏的存储不应把页面搞崩", () => {
  reset();
  globalThis.localStorage.setItem(CLEAN_KEY, "{不是合法 JSON");
  assert.equal(readCleanResult(), null, "解析失败应安全返回 null");
  globalThis.localStorage.setItem(SPLIT_KEY, "{也不是合法 JSON");
  handOffToSplit({ text: "甲" });
  assert.equal(readStore(SPLIT_KEY).text, "甲", "上游损坏也应能写入");
});
