import { test } from "node:test";
import assert from "node:assert/strict";

import { parseStoryboard } from "../src/storyboard.js";
import {
  renderEOSAdapter,
  renderEOSImportPlan,
  eosAdapterStats,
} from "../src/eos-adapter.js";

const SAMPLE = `第1集：测试
【分镜01】
[shot01 | 时长：12秒 | 场景：Village 外 雪天 | 人物：C01-村长（Village Chief，着装：粗布冬装）、C02-男弟子（Male Disciple，着装：弟子法袍） | 道具：法杖]
人物空间位置：
村长倒在雪地上，男弟子站在旁边。
Clip A | 时长：6秒 | 景别：CU
CAMERA: 固定机位 / CU. 村长撑起上半身，嘴角带血。
EN: 村长: "Run!"
Clip B | 时长：6秒 | 景别：MS
CAMERA: 固定机位 / MS. 男弟子跑过来扶住村长。

【分镜02】
[shot02 | 时长：4秒 | 场景：Village 外 雪天 | 人物：村长 | 道具：无]
人物空间位置：
村长被扶起。
Clip A | 时长：4秒 | 景别：CU
CAMERA: 固定机位 / CU. 村长抬头看向前方。
`;

test("EOS 适配：一条本地 shot 保持为一条 EOS 分镜", () => {
  const output = renderEOSAdapter(parseStoryboard(SAMPLE));
  assert.equal((output.match(/【分镜\d+】/g) || []).length, 2);
  assert.match(output, /【分镜1】12s ｜ 建立→收束/);
  assert.match(output, /【分镜2】4s ｜ 收束/);
});

test("EOS 适配：场景、人物、道具和空间锚点进入同一 shot 记录", () => {
  const output = renderEOSAdapter(parseStoryboard(SAMPLE));
  assert.match(output, /^Village｜外｜雪天｜村长倒在雪地上/m);
  assert.match(output, /人物 村长（粗布冬装）、男弟子（弟子法袍）｜道具 法杖｜锚点/);
  assert.match(output, /人物 村长（正常）｜道具 —｜锚点/);
});

test("EOS 适配：Clip 使用 A/B 行，台词附在对应 Clip 后", () => {
  const output = renderEOSAdapter(parseStoryboard(SAMPLE));
  assert.match(output, /A 6s CU 建立｜固定机位。村长撑起上半身，嘴角带血。/);
  assert.match(output, /台词 \{Run!\}｜村长/);
  assert.match(output, /B 6s MS 收束｜固定机位。男弟子跑过来扶住村长。/);
});

test("EOS 适配：去掉本地角色编号，但保留妆造和说话人", () => {
  const output = renderEOSAdapter(parseStoryboard(SAMPLE));
  assert.doesNotMatch(output, /C01-村长/);
  assert.doesNotMatch(output, /C02-男弟子/);
  assert.match(output, /村长（粗布冬装）/);
  assert.match(output, /台词 \{Run!\}｜村长/);
});

test("EOS 适配：统计按集 / shot / Clip 汇总", () => {
  assert.deepEqual(eosAdapterStats(parseStoryboard(SAMPLE)), {
    episodes: 1,
    shots: 2,
    clips: 3,
  });
});

test("EOS 适配：空输入不崩溃", () => {
  assert.equal(renderEOSAdapter({ episodes: [] }), "");
  assert.deepEqual(eosAdapterStats(null), { episodes: 0, shots: 0, clips: 0 });
});

test("EOS 直连包：一集一个创建单元，分镜按 shot 逐条落库", () => {
  const plan = JSON.parse(renderEOSImportPlan(parseStoryboard(SAMPLE)));
  assert.equal(plan.version, 1);
  assert.equal(plan.episodes.length, 1);
  assert.equal(plan.episodes[0].name, "第1集：测试");
  assert.equal(plan.episodes[0].storyboards.length, 2);
  assert.deepEqual(
    plan.episodes[0].storyboards.map((x) => [x.order, x.duration]),
    [
      [0, 12],
      [1, 4],
    ],
  );
  assert.match(plan.episodes[0].storyboards[0].sourceText, /^【分镜1】12s/);
  assert.match(plan.episodes[0].storyboards[1].sourceText, /^【分镜2】4s/);
});
