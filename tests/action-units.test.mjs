import { test } from "node:test";
import assert from "node:assert/strict";

import { buildActionUnits, splitActionUnitText } from "../src/action-units.js";

test("动作微单元：按中文标点切开，但拼接后与原文逐字一致", () => {
  const raw =
    "△大魔导师的魔法盾被打破，他被冲击力击倒在地上，吐血，痛苦地喊道。";
  const units = splitActionUnitText(raw);
  assert.equal(units.length, 4);
  assert.equal(units.map((unit) => unit.source).join(""), raw);
  assert.deepEqual(
    units.map((unit) => unit.text),
    [
      "大魔导师的魔法盾被打破，",
      "他被冲击力击倒在地上，",
      "吐血，",
      "痛苦地喊道。",
    ],
  );
});

test("动作微单元：编号稳定，并能回指父动作块", () => {
  const units = buildActionUnits("△弟子跑入；男弟子扶住他。", "B19");
  assert.deepEqual(
    units.map((unit) => unit.id),
    ["B19.1", "B19.2"],
  );
  assert.ok(units.every((unit) => unit.blockId === "B19"));
  assert.equal(units.map((unit) => unit.source).join(""), "△弟子跑入；男弟子扶住他。");
});

test("动作微单元：没有标点和空文本也保持一个可追溯单元", () => {
  assert.equal(splitActionUnitText("△他抬眼").length, 1);
  assert.equal(buildActionUnits("△他抬眼", "B01")[0].id, "B01.1");
});
