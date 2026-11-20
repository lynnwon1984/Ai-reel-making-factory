import test from "node:test";
import assert from "node:assert/strict";
import {
  renumberShots,
  splitMergedEn,
  normalizeStoryboard,
  cleanDuplicateClips,
  mergeSplitShotHeads,
  restoreSourceDialogue,
  dedupeRepeatedDialogue,
  removePseudoDialogue,
} from "../src/normalize.js";
import { parseStoryboard, validateStoryboard } from "../src/storyboard.js";

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

test("编号重排：Markdown 集标题也重置 shot 编号", () => {
  const text = `## 第4集：新一集
【分镜07】
[shot07 | 时长：8秒 | 场景：A | 人物：村长 | 道具：无]
Clip A | 时长：8秒 | 景别：MS
CAMERA: 固定机位 / MS. 村长抬头。
`;
  const r = renumberShots(text);
  assert.match(r.text, /【分镜01】/);
  assert.match(r.text, /\[shot01 /);
});

test("Clip 去重：连续重复段删除、字母重排、shot 时长按 Clip 总和校正", () => {
  const text = `第1集：测试
【分镜01】
[shot01 | 时长：17秒 | 场景：A | 人物：仆人A、仆人B | 道具：无]
人物空间位置：
仆人坐在后方。
Clip A | 时长：5秒 | 景别：CU
CAMERA: 固定机位 / CU. 亚瑟微笑。
Clip B | 时长：4秒 | 景别：CU
CAMERA: 固定机位 / CU. 休斯大喊。
Clip C | 时长：4秒 | 景别：CU
CAMERA: 固定机位 / CU. 仆人A/B紧张地睁大眼睛看着。
Clip C | 时长：4秒 | 景别：CU
CAMERA: 固定机位 / CU. 仆人A/B紧张地睁大眼睛看着。
`;
  const cleaned = cleanDuplicateClips(text);
  assert.equal(cleaned.deduped, 1);
  assert.equal((cleaned.text.match(/^Clip\s+[ABC]\s*\|/gm) || []).length, 3);
  assert.match(cleaned.text, /\[shot01 \| 时长：13秒/);

  const parsed = parseStoryboard(cleaned.text);
  const shot = parsed.episodes[0].shots[0];
  assert.deepEqual(shot.clips.map((c) => c.letter), ["A", "B", "C"]);
  assert.equal(shot.duration, 13);
  assert.equal(validateStoryboard(parsed).stats.high, 0);
});

test("Clip 时长：低于 4 秒的 Clip 补到 4 秒并同步 shot 时长", () => {
  const text = `第1集：测试
【分镜01】
[shot01 | 时长：7秒 | 场景：A | 人物：甲 | 道具：无]
Clip A | 时长：3秒 | 景别：MCU
CAMERA: 固定机位 / MCU. 甲听着。
Clip B | 时长：4秒 | 景别：MCU
CAMERA: 固定机位 / MCU. 乙说话。
`;
  const r = normalizeStoryboard(text, "");
  assert.equal(r.bumped, 1);
  assert.match(r.text, /Clip A \| 时长：4秒/);
  assert.match(r.text, /\[shot01 \| 时长：8秒/);
  assert.equal(validateStoryboard(parseStoryboard(r.text)).stats.high, 0);
});

test("单 Clip shot：总时长低于 5 秒时补到 5 秒", () => {
  const text = `第1集：测试
【分镜01】
[shot01 | 时长：4秒 | 场景：A | 人物：甲 | 道具：无]
Clip A | 时长：4秒 | 景别：CU
CAMERA: 固定机位 / CU. 甲抬头。
`;
  const r = normalizeStoryboard(text, "");
  assert.match(r.text, /\[shot01 \| 时长：5秒/);
  assert.match(r.text, /Clip A \| 时长：5秒/);
  assert.equal(validateStoryboard(parseStoryboard(r.text)).stats.high, 0);
});

test("人物别名：原文有随从 A/B 时，修正误写的侍卫 A/B", () => {
  const source = `人物：查尔斯（Charles，着装：绿色华丽礼服）、随从A（Entourage A，着装：黑色随从服）、随从B（Entourage B，着装：黑色随从服）`;
  const text = `第1集：测试
【分镜01】
[shot01 | 时长：8秒 | 场景：A | 人物：查尔斯（Charles，着装：绿色华丽礼服）、侍卫A（Guard A，着装：黑色皮革盔甲）、侍卫B（Guard B，着装：黑色皮革盔甲） | 道具：无]
人物空间位置：
侍卫A、侍卫B站在查尔斯身后。
Clip A | 时长：8秒 | 景别：MS
CAMERA: 固定机位 / MS. 侍卫A和侍卫B看着前方。
`;
  const r = normalizeStoryboard(text, source);
  assert.ok(r.aliased >= 2);
  assert.match(r.text, /随从A（Entourage A，着装：黑色随从服）/);
  assert.doesNotMatch(r.text, /侍卫[AB]/);
});

test("表头合并：同一 shot 的两行元数据合成一行", () => {
  const text = `第1集：测试
【分镜03】
[shot03 | 时长：7秒 | 景别：MCU]
[shot03 | 场景：A 内 日 | 人物：甲 | 道具：无]
Clip A | 时长：7秒 | 景别：MCU
CAMERA: 固定机位 / MCU. 甲抬头。
`;
  const r = mergeSplitShotHeads(text);
  assert.equal(r.merged, 1);
  assert.equal((r.text.match(/^\[shot03/gm) || []).length, 1);
  const shot = parseStoryboard(r.text).episodes[0].shots[0];
  assert.equal(shot.duration, 7);
  assert.equal(shot.scene, "A 内 日");
});

test("台词回填：模型只改一个拼写时，恢复原文说法", () => {
  const source = "**亚瑟（V.O.）**（冷漠）：A bunch of opportunistic boot lickes. Save it.";
  const text = `第1集：测试
【分镜01】
[shot01 | 时长：6秒 | 场景：A | 人物：亚瑟 | 道具：无]
Clip A | 时长：6秒 | 景别：CU
CAMERA: 固定机位 / CU. 亚瑟抬眼。
EN: 亚瑟（V.O.）: "A bunch of opportunistic boot lickers. Save it."
`;
  const r = restoreSourceDialogue(text, source);
  assert.equal(r.restored, 1);
  assert.match(r.text, /opportunistic boot lickes\./);
});

test("台词回填：模型漏掉长台词开头时，补回完整原句", () => {
  const source =
    "**莱昂**（愤怒）：You despicable barbarian! You dared to cripple my cousin! Today I'll show you that your brute strength is nothing but a joke.";
  const text = `第1集：测试
【分镜01】
[shot01 | 时长：10秒 | 场景：A | 人物：莱昂 | 道具：无]
Clip A | 时长：10秒 | 景别：MCU
CAMERA: 固定机位 / MCU. 莱昂大喊。
EN: 莱昂: "You dared to cripple my cousin! Today I'll show you that your brute strength is nothing but a joke."
`;
  const r = restoreSourceDialogue(text, source);
  assert.equal(r.restored, 1);
  assert.match(r.text, /You despicable barbarian! You dared/);
});

test("台词回填：模型正常把长句拆成两条时不拼回去", () => {
  const source = "**甲**（平静）：First sentence. Second sentence.";
  const text = `第1集：测试
【分镜01】
[shot01 | 时长：10秒 | 场景：A | 人物：甲 | 道具：无]
Clip A | 时长：10秒 | 景别：CU
CAMERA: 固定机位 / CU. 甲说话。
EN: 甲: "First sentence."
EN: 甲: "Second sentence."
`;
  const r = restoreSourceDialogue(text, source);
  assert.equal(r.restored, 0);
  assert.equal((r.text.match(/^EN:/gm) || []).length, 2);
});

test("台词去重：同一 shot 内同角色完全重复句只保留一次", () => {
  const text = `第1集：测试
【分镜01】
[shot01 | 时长：10秒 | 场景：A | 人物：甲 | 道具：无]
Clip A | 时长：5秒 | 景别：CU
EN: 甲: "Same line."
Clip B | 时长：5秒 | 景别：MCU
EN: 甲: "Same line."
`;
  const r = dedupeRepeatedDialogue(text);
  assert.equal(r.deduped, 1);
  assert.equal((r.text.match(/Same line/g) || []).length, 1);
});

test("伪台词清理：模型补写的“无台词/沉默”EN 行确定性删除", () => {
  const text = `第1集：测试
【分镜01】
[shot01 | 时长：5秒 | 场景：A | 人物：亚瑟 | 道具：无]
Clip A | 时长：5秒 | 景别：MCU
EN: 亚瑟:（无台词）
EN: 亚瑟: "（沉默）"
EN: 亚瑟: "Real line."
`;
  const cleaned = removePseudoDialogue(text);
  assert.equal(cleaned.removed, 2);
  assert.doesNotMatch(cleaned.text, /无台词|沉默/);
  assert.match(cleaned.text, /Real line/);

  const normalized = normalizeStoryboard(text, "");
  assert.equal(normalized.pseudoDialogueRemoved, 2);
});
