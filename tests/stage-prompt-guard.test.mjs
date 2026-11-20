import assert from "node:assert/strict";
import test from "node:test";
import {
  extractDirectQuotes,
  extractDialogueQuotes,
  guardSourceFacts,
  parseFactLedger,
  restoreProtectedQuotes,
} from "../scripts/stage-prompt-guard.mjs";

const source = "周启明说：“她走的时候，你不在。”周岚说：“我在医院。”";

function validFact(overrides = {}) {
  return {
    source_id: "S001",
    locator: "第1段",
    sequence: 1,
    when: "[暂缺]",
    where: "修表铺",
    who: ["周启明", "周岚"],
    event: "周启明指责周岚没有送别母亲",
    change: "周启明确认了周岚缺席这一事实",
    quotes: [
      { speaker: "周启明", text: "她走的时候，你不在。" },
      { speaker: "周岚", text: "我在医院。" },
    ],
    motifs: [],
    stage_trap: "无",
    ...overrides,
  };
}

test("引语守卫：唯一的一字漂移恢复为原文", () => {
  const fact = validFact({
    quotes: [
      { speaker: "周启明", text: "她在走的时候，你不在。" },
      { speaker: "周岚", text: "我在医院。" },
    ],
  });
  const result = guardSourceFacts([fact], source);
  assert.equal(result.facts[0].quotes[0].text, "她走的时候，你不在。");
  assert.equal(result.corrections.length, 1);
  assert.equal(result.issues.length, 0);
});

test("引语守卫：原文完全一致时不改写", () => {
  const result = guardSourceFacts([validFact()], source);
  assert.equal(result.facts[0].quotes[0].text, "她走的时候，你不在。");
  assert.equal(result.corrections.length, 0);
  assert.equal(result.issues.length, 0);
});

test("引语守卫：没有原文候选时阻断，不编造替代", () => {
  const fact = validFact({
    quotes: [
      { speaker: "周启明", text: "你从来没有回来过。" },
      { speaker: "周岚", text: "我在医院。" },
    ],
  });
  const result = guardSourceFacts([fact], source);
  assert.equal(result.facts[0].quotes[0].text, "你从来没有回来过。");
  assert.equal(result.corrections.length, 0);
  assert.equal(result.issues[0].code, "QUOTE_TEXT_UNVERIFIED");
});

test("引语守卫：字段说明污染和空的 change 会被抓出来", () => {
  const fact = validFact({
    when: "原文时间或季节；无则写[暂缺]",
    change: "",
  });
  const result = guardSourceFacts([fact], source);
  assert.deepEqual(
    result.issues.map((issue) => issue.code),
    ["FACT_CHANGE_MISSING", "FACT_FIELD_POLLUTED"],
  );
});

test("解析账本：坏 JSON 不会让整批消失", () => {
  const content = [
    JSON.stringify(validFact()),
    '{"source_id":"S002",坏数据}',
  ].join("\n");
  const result = parseFactLedger(content);
  assert.equal(result.facts.length, 1);
  assert.equal(result.issues[0].code, "FACT_JSON_INVALID");
});

test("提取引语：中英文引号都能识别并去重", () => {
  assert.deepEqual(extractDirectQuotes('甲说：“走。”乙说："走。"丙说：“留。”'), [
    "走。",
    "留。",
  ]);
});

test("引语守卫：原文对白漏进账本时会阻断", () => {
  const result = guardSourceFacts(
    [validFact({ quotes: [{ speaker: "周启明", text: "她走的时候，你不在。" }] })],
    source,
  );
  assert.ok(result.issues.some((issue) => issue.code === "QUOTE_MISSING_FROM_LEDGER"));
});

test("提取对白：只收由说、问、答、喊、叫、道引出的直接引语", () => {
  assert.deepEqual(
    extractDialogueQuotes('他说：“走。”袋口绣着“岚”字。她问：“去哪？”'),
    ["走。", "去哪？"],
  );
});

test("受保护台词：唯一近似句恢复为原文", () => {
  const result = restoreProtectedQuotes(
    "周启明：她在走的时候，你不在。",
    ["她走的时候，你不在。"],
  );
  assert.equal(result.text, "周启明：她走的时候，你不在。");
  assert.equal(result.corrections.length, 1);
});

test("受保护台词：没有可靠近似时不改动", () => {
  const input = "周启明：你从来没有回来过。";
  const result = restoreProtectedQuotes(input, ["她走的时候，你不在。"]);
  assert.equal(result.text, input);
  assert.equal(result.corrections.length, 0);
});
