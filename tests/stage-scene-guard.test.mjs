import assert from "node:assert/strict";
import test from "node:test";
import { validateSceneDraft } from "../scripts/stage-scene-guard.mjs";

const validScene = `S01 门外的布袋

时间：六月雨夜
地点：修表铺
人物：周岚、周启明

【开场】
周岚站在门外，把旧布袋提到胸前。周启明低头修表，不看她。

周岚：哥。

周启明：修表要排队。急也没用。

（周岚把布袋放到柜台上。周启明的手停住，却没有接。）

周岚：我不修表。

周启明：那你就等。

（雨声增大。周岚向门框里迈了半步，又停住。周启明把手缩回抽屉。）

【本场结束】
布袋留在柜台上，周岚仍站在门框外。
`;

test("单场验收：预算、对白和原文引用通过", () => {
  const result = validateSceneDraft(validScene, {
    minHanChars: 60,
    sourceQuotes: ["修表要排队。急也没用。"],
  });
  assert.deepEqual(result.issues, []);
  assert.ok(result.dialogueLines.length >= 2);
});

test("单场验收：过短、模板角色名和漏原句被拦下", () => {
  const broken = validScene
    .replace("周岚：哥。", "角色名：哥。")
    .replace("周启明：修表要排队。急也没用。", "");
  const codes = validateSceneDraft(broken, {
    minHanChars: 500,
    sourceQuotes: ["修表要排队。急也没用。"],
  }).issues.map((issue) => issue.code);
  assert.ok(codes.includes("SCENE_TOO_SHORT"));
  assert.ok(codes.includes("SCENE_LITERAL_LABEL"));
  assert.ok(codes.includes("SCENE_SOURCE_QUOTE_MISSING"));
});

test("单场验收：镜头语言被拦下", () => {
  const broken = `${validScene}\n（镜头推近周岚的手。）`;
  const codes = validateSceneDraft(broken, { minHanChars: 10 }).issues.map((issue) => issue.code);
  assert.ok(codes.includes("SCENE_FILM_GRAMMAR"));
});

test("单场验收：提前写下一场和复制段落被拦下", () => {
  const broken = `${validScene}\n周岚：我在医院。\n（周岚把布袋放到柜台上。周启明的手停住，却没有接。）\n（周岚把布袋放到柜台上。周启明的手停住，却没有接。）`;
  const codes = validateSceneDraft(broken, {
    minHanChars: 10,
    forbiddenSnippets: ["我在医院"],
  }).issues.map((issue) => issue.code);
  assert.ok(codes.includes("SCENE_BOUNDARY_BREACH"));
  assert.ok(codes.includes("SCENE_REPEATED_LINE"));
});
