import test from "node:test";
import assert from "node:assert/strict";
import { renumberShots, splitMergedEn, normalizeStoryboard } from "../src/normalize.js";

const OUT = `第7集：测试
【分镜01】
[shot01 | 时长：8秒 | 场景：A | 人物：村长 | 道具：无]
人物空间位置：
村长站着。
Clip A | 时长：8秒 | 景别：MS
CAMERA: 固定机位 / MS. 村长抬头。
【分镜02】
[shot02 | 时长：8秒 | 场景：A | 人物：村长 | 道具：无]
人物空间位置：
村长站着。
Clip A | 时长：8秒 | 景别：MS
CAMERA: 固定机位 / MS. 村长低头。
【分镜01】
[shot01 | 时长：8秒 | 场景：B | 人物：村长 | 道具：无]
人物空间位置：
村长站着。
Clip A | 时长：8秒 | 景别：MS
CAMERA: 固定机位 / MS. 村长转身。
`;

test("编号重排：每集从 01 连续，内容不动", () => {
  const { text, changed } = renumberShots(OUT);
  assert.equal(changed, 2);
  assert.match(text, /【分镜03】/);
  assert.match(text, /\[shot03 \| 时长：8秒/);
  assert.equal((text.match(/【分镜0?1】/g) || []).length, 1);
});

const SRC = `第1集：测试
**村长**（高声）：Run!
**村长**（低声）：Thank you.
`;

test("台词拆行：两句合并的被拆成两条 EN", () => {
  const out = `第1集：测试
【分镜01】
[shot01 | 时长：8秒 | 场景：A | 人物：村长 | 道具：无]
人物空间位置：
村长站着。
Clip A | 时长：8秒 | 景别：MS
CAMERA: 固定机位 / MS. 村长抬头。
EN: 村长: "Run! Thank you."
`;
  const { text, changed } = splitMergedEn(out, SRC);
  assert.equal(changed, 1);
  assert.equal((text.match(/^EN:/gm) || []).length, 2);
  assert.match(text, /"Run!"/);
  assert.match(text, /"Thank you."/);
});

test("台词拆行：单句不动", () => {
  const out = `第1集：测试
【分镜01】
[shot01 | 时长：8秒 | 场景：A | 人物：村长 | 道具：无]
人物空间位置：
村长站着。
Clip A | 时长：8秒 | 景别：MS
CAMERA: 固定机位 / MS. 村长抬头。
EN: 村长: "Run!"
`;
  const { changed } = splitMergedEn(out, SRC);
  assert.equal(changed, 0);
});

test("规范化：两项一起跑", () => {
  const r = normalizeStoryboard(OUT, SRC);
  assert.equal(r.renumbered, 2);
});
