import test from "node:test";
import assert from "node:assert/strict";
import { buildLedger, ledgerSeed, shouldPause, segmentStart } from "../src/relay.js";
import { parseStoryboard } from "../src/storyboard.js";

const SAMPLE = `第1集：测试
【分镜01】
[shot01 | 时长：8秒 | 场景：Village 外 雪天 | 人物：村长（Village Chief，着装：粗布冬装）、黑龙（Dragon，着装：黑龙鳞甲） | 道具：无]
人物空间位置：
村长站在广场中央。
Clip A | 时长：4秒 | 景别：MS
CAMERA: 固定机位 / MS. 村长抬头。
Clip B | 时长：4秒 | 景别：CU
CAMERA: 固定机位 / CU. 黑龙俯冲。
EN: 村长: "Run!"
【分镜02】
[shot02 | 时长：5秒 | 场景：Village 外 雪天 | 人物：村长 | 道具：无]
人物空间位置：
村长跑向木屋。
Clip A | 时长：5秒 | 景别：WS
CAMERA: 固定机位 / WS. 村长推门进屋。
`;

test("接力包：角色按首次出场编号并去重", () => {
  const ledger = buildLedger(parseStoryboard(SAMPLE));
  assert.deepEqual(
    ledger.characters.map((c) => c.code),
    ["C01-村长", "C02-黑龙"],
  );
  assert.equal(ledger.characters[0].dress, "粗布冬装");
});

test("接力包：场景去重且保持顺序", () => {
  const ledger = buildLedger(parseStoryboard(SAMPLE));
  assert.deepEqual(ledger.scenes, ["Village 外 雪天"]);
});

test("接力包：带最后一场空间状态与下一个编号", () => {
  const ledger = buildLedger(parseStoryboard(SAMPLE));
  assert.equal(ledger.lastPosition, "村长跑向木屋。");
  assert.equal(ledger.nextCode, "C03");
});

test("接力包：seed 能读到编号、场景和下一个编号", () => {
  const seed = ledgerSeed(buildLedger(parseStoryboard(SAMPLE)));
  assert.match(seed, /C01-村长/);
  assert.match(seed, /C02-黑龙/);
  assert.match(seed, /Village 外 雪天/);
  assert.match(seed, /C03/);
  assert.match(seed, /不得重新编号/);
});

test("接力包：空产出不生成前缀", () => {
  assert.equal(ledgerSeed(buildLedger(parseStoryboard(""))), "");
  assert.equal(ledgerSeed(null), "");
});

test("检查点：每 2 批停一次，首批与最后一批不触发", () => {
  assert.equal(shouldPause({ done: 2, total: 6, every: 2 }), true);
  assert.equal(shouldPause({ done: 4, total: 6, every: 2 }), true);
  assert.equal(shouldPause({ done: 1, total: 6, every: 2 }), false);
  assert.equal(shouldPause({ done: 6, total: 6, every: 2 }), false);
  assert.equal(shouldPause({ done: 2, total: 2, every: 2 }), false);
  assert.equal(shouldPause({ done: 2, total: 6, every: 0 }), false);
});

test("检查点：重跑段落起点算得对", () => {
  assert.equal(segmentStart({ done: 2, every: 2 }), 0);
  assert.equal(segmentStart({ done: 4, every: 2 }), 2);
  assert.equal(segmentStart({ done: 6, every: 2 }), 4);
  assert.equal(segmentStart({ done: 3, every: 0 }), 0);
});
