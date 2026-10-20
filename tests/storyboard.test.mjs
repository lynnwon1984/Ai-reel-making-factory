// 流程三引擎测试：解析 / 校验 / 机读层编译
// 断的是编译规范 v0.7 的硬约束，不是"跑得通"。

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  parseStoryboard,
  parseCastItem,
  parseCastLine,
  validateStoryboard,
  compileToL1,
  renderL1,
  splitCamera,
  buildCharacterRegistry,
  splitEpisodes,
  splitSpeaker,
  CLIP_MIN,
  CLIP_MAX,
  MAX_CLIPS_PER_SHOT,
} from "../src/storyboard.js";

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const REAL = readFileSync(path.join(DIR, "storyboard-real.txt"), "utf8");
const V3 = readFileSync(path.join(DIR, "storyboard-v3.txt"), "utf8");

const SAMPLE = `第1集：测试
【分镜01】
[shot01 | 时长：12秒 | 场景：Village 外 雪天 | 人物：村长（Village Chief，着装：粗布冬装）、男弟子（Male Disciple，着装：弟子法袍） | 道具：法杖]
人物空间位置：
村长倒在雪地上，男弟子站在旁边。
Clip A | 时长：6秒 | 景别：CU
CAMERA: 固定机位 / CU. 村长撑起上半身，嘴角带血。
EN: 村长: "Run!"
Clip B | 时长：6秒 | 景别：MS
CAMERA: 固定机位 / MS. 男弟子跑过来扶住村长。

【分镜02】
[shot02 | 时长：6秒 | 场景：Village 外 雪天 | 人物：村长 | 道具：无]
人物空间位置：
村长被扶起。
Clip A | 时长：6秒 | 景别：CU
CAMERA: 固定机位 / CU. 村长抬头看向前方。
`;

/* ---------------- 解析 ---------------- */

test("解析：集 / shot / Clip 三层都能拆出来", () => {
  const p = parseStoryboard(SAMPLE);
  assert.equal(p.episodes.length, 1);
  assert.equal(p.episodes[0].title, "测试");
  assert.equal(p.episodes[0].shots.length, 2);
  assert.equal(p.episodes[0].shots[0].clips.length, 2);
  assert.equal(p.episodes[0].shots[0].duration, 12);
  assert.equal(p.episodes[0].shots[0].clips[0].size, "CU");
});

test("解析：人物栏能拆出中文名 / 英文名 / 着装", () => {
  const one = parseCastItem("村长（Village Chief，着装：粗布冬装）");
  assert.deepEqual(one, { name: "村长", full: "Village Chief", dress: "粗布冬装" });
  const bare = parseCastItem("黑龙");
  assert.deepEqual(bare, { name: "黑龙", full: "", dress: "" });
  const list = parseCastLine("村长（Village Chief，着装：粗布冬装）、黑龙");
  assert.equal(list.length, 2);
  assert.equal(list[1].name, "黑龙");
});

test("解析：「人物：无」不是角色", () => {
  assert.deepEqual(parseCastLine("无"), []);
  assert.deepEqual(parseCastLine("人物：无"), []);
  assert.deepEqual(parseCastLine("人物：—"), []);
});

test("解析：说话人后缀 O.S. / V.O. 被拆出来", () => {
  assert.deepEqual(splitSpeaker("村长"), { name: "村长", mode: "" });
  assert.deepEqual(splitSpeaker("村长（O.S.）"), { name: "村长", mode: "O.S." });
  assert.deepEqual(splitSpeaker("塞琳娜（V.O.）"), { name: "塞琳娜", mode: "V.O." });
});

test("编译：无角色场景不产生 <Cxx-无>", () => {
  const text = `${SAMPLE}\n【分镜03】\n[shot03 | 时长：6秒 | 场景：空镜 外 晴 | 人物：无 | 道具：无]\nClip A | 时长：6秒 | 景别：WS\nCAMERA: 固定机位 / WS. 天空。`;
  const units = compileToL1(parseStoryboard(text));
  const last = units[units.length - 1];
  assert.ok(!/无>/.test(last.prompt), "不该出现 <Cxx-无>");
  assert.ok(!last.prompt.includes("主体："), "无角色时不写主体行");
});

test("编译：O.S. 说话人仍用编号标签，并保留后缀", () => {
  const text = SAMPLE.replace('EN: 村长: "Run!"', 'EN: 村长（O.S.）: "Run!"');
  const units = compileToL1(parseStoryboard(text));
  assert.match(units[0].prompt, /台词：<C01-村长·粗布冬装>（O\.S\.） 说 \{Run!\}/);
});

test("解析：CAMERA 行能拆出运镜 / 景别 / 描述", () => {
  assert.deepEqual(splitCamera("固定机位 / CU. 村长抬头。"), {
    move: "固定机位",
    size: "CU",
    desc: "村长抬头。",
  });
  const push = splitCamera("推镜（全景快速推至双人半身）/ WS→MS. 画面推进。");
  assert.match(push.move, /推镜/);
});

test("解析：台词保留说话人与内容", () => {
  const p = parseStoryboard(SAMPLE);
  const d = p.episodes[0].shots[0].clips[0].dialogue[0];
  assert.equal(d.speaker, "村长");
  assert.equal(d.text, "Run!");
});

/* ---------------- 校验 ---------------- */

test("校验：合格样本零问题", () => {
  const v = validateStoryboard(parseStoryboard(SAMPLE));
  assert.equal(v.stats.high, 0);
  assert.equal(v.stats.mid, 0);
});

test("校验：Clip 低于 4 秒要报高优先级", () => {
  const bad = SAMPLE.replace("Clip A | 时长：6秒", "Clip A | 时长：3秒");
  const v = validateStoryboard(parseStoryboard(bad));
  assert.ok(v.issues.some((i) => i.level === "高" && /不在 4–15s/.test(i.msg)));
});

test("校验：Clip 加总不等于 shot 要报", () => {
  const bad = SAMPLE.replace("Clip B | 时长：6秒", "Clip B | 时长：5秒");
  const v = validateStoryboard(parseStoryboard(bad));
  assert.ok(v.issues.some((i) => /加总/.test(i.msg)));
});

test("校验：单 shot 超过 3 个 Clip 要报", () => {
  const extra = SAMPLE.replace(
    "Clip B | 时长：6秒 | 景别：MS\nCAMERA: 固定机位 / MS. 男弟子跑过来扶住村长。",
    "Clip B | 时长：3秒 | 景别：MS\nCAMERA: 固定机位 / MS. 一。\nClip C | 时长：3秒 | 景别：MS\nCAMERA: 固定机位 / MS. 二。\nClip D | 时长：3秒 | 景别：MS\nCAMERA: 固定机位 / MS. 三。",
  );
  const v = validateStoryboard(parseStoryboard(extra));
  assert.ok(v.issues.some((i) => /超过上限/.test(i.msg)));
});

test("校验：真实产出（旧 3 秒口径）会被如实报出来", () => {
  const v = validateStoryboard(parseStoryboard(REAL));
  assert.equal(v.stats.episodes, 3);
  assert.equal(v.stats.shots, 90);
  assert.equal(v.stats.clips, 139);
  assert.ok(v.stats.high > 0, "旧产出里大量 3 秒 Clip 应被判高优先级");
});

/* ---------------- 机读层编译 ---------------- */

test("编号表：剧本没编号就按全剧首次出场补 C01", () => {
  const reg = buildCharacterRegistry(parseStoryboard(SAMPLE));
  assert.equal(reg.get("村长"), "C01-村长");
  assert.equal(reg.get("男弟子"), "C02-男弟子");
});

test("编译：主体标签带妆造，动作描述里也引用标签", () => {
  const units = compileToL1(parseStoryboard(SAMPLE));
  assert.equal(units.length, 3, "3 个 Clip = 3 条生成单位");
  const u = units[0];
  assert.match(u.prompt, /<C01-村长·粗布冬装>/);
  assert.match(u.prompt, /<C02-男弟子·弟子法袍>/);
  assert.match(u.prompt, /<C01-村长·粗布冬装>撑起上半身/);
});

test("编译：台词用 {}，并挂上说话人标签", () => {
  const units = compileToL1(parseStoryboard(SAMPLE));
  assert.match(units[0].prompt, /台词：<C01-村长·粗布冬装> 说 \{Run!\}/);
});

test("编译：L1 不写秒数、不写 @图片N", () => {
  const units = compileToL1(parseStoryboard(SAMPLE));
  for (const u of units) {
    assert.ok(!/\d+\s*秒/.test(u.prompt.split("风格与约束")[0]), "提示词正文不该出现秒数");
    assert.ok(!/@图片/.test(u.prompt), "L1 不该出现 @图片N");
  }
});

test("编译：约束包必挂（画质 / 稳定 / 字幕 / 水印）", () => {
  const u = compileToL1(parseStoryboard(SAMPLE))[0];
  for (const k of ["高清", "面部稳定", "无字幕", "不要生成水印", "不要生成 Logo"]) {
    assert.ok(u.prompt.includes(k), `缺少约束：${k}`);
  }
});

test("编译：多人场景挂双胞胎兜底，单人场景不挂", () => {
  const units = compileToL1(parseStoryboard(SAMPLE));
  assert.match(units[0].prompt, /双胞胎/);
  assert.doesNotMatch(units[2].prompt, /双胞胎/);
});

test("编译：时长只出现在参数行", () => {
  const l1 = renderL1(compileToL1(parseStoryboard(SAMPLE)));
  assert.match(l1, /duration=6s/);
  assert.match(l1, /ratio=9:16/);
});

test("常量：Clip 区间与单 shot 上限符合规范", () => {
  assert.equal(CLIP_MIN, 4);
  assert.equal(CLIP_MAX, 15);
  assert.equal(MAX_CLIPS_PER_SHOT, 3);
});

/* ---------------- 分批 ---------------- */

test("分批：按「第N集」切块", () => {
  const text = "第1集：甲\nA\n第2集：乙\nB\n第3集：丙\nC\n";
  const eps = splitEpisodes(text);
  assert.deepEqual(eps.map((e) => e.no), [1, 2, 3]);
  assert.match(eps[0].text, /A/);
});

test("分批：没有集标题就整本一批", () => {
  const eps = splitEpisodes("孤零零的一段剧本");
  assert.equal(eps.length, 1);
  assert.equal(eps[0].text, "孤零零的一段剧本");
});

/* ---------------- 边界与兼容 ---------------- */

test("空输入：不崩，且给出警告", () => {
  const p = parseStoryboard("");
  assert.equal(p.episodes.length, 0);
  assert.ok(p.warnings.length > 0);
  const v = validateStoryboard(p);
  assert.equal(v.stats.shots, 0);
});

test("兼容：裸「第1集」也能解析", () => {
  const p = parseStoryboard("第1集\n【分镜01】\n[shot01 | 时长：6秒 | 场景：甲 内 晴 | 人物：村长 | 道具：无]\nClip A | 时长：6秒 | 景别：CU\nCAMERA: 固定机位 / CU. 村长抬头。");
  assert.equal(p.episodes.length, 1);
  assert.equal(p.episodes[0].title, "");
});

test("兼容：shot 表头缺右括号也能解析", () => {
  const p = parseStoryboard(SAMPLE.replace("| 道具：法杖]", "| 道具：法杖"));
  assert.equal(p.episodes[0].shots[0].props, "法杖");
});

test("校验：shot 编号跳号要报高优先级", () => {
  const bad = SAMPLE.replace("【分镜02】", "【分镜05】").replace("shot02", "shot05");
  const v = validateStoryboard(parseStoryboard(bad));
  assert.ok(v.issues.some((i) => i.level === "高" && /编号不连续/.test(i.msg)));
});

test("校验：shot 超出 5–15 秒要报", () => {
  const bad = SAMPLE.replace("时长：12秒", "时长：20秒");
  const v = validateStoryboard(parseStoryboard(bad));
  assert.ok(v.issues.some((i) => /shot 时长/.test(i.msg)));
});

test("妆造继承：同场后续 shot 没写着装，也能沿用本场首次的", () => {
  const units = compileToL1(parseStoryboard(SAMPLE));
  const last = units[units.length - 1];
  assert.match(last.prompt, /<C01-村长·粗布冬装>/);
});

test("妆造按场：换场后第一个 shot 必须重新带妆造", () => {
  const twoScenes = SAMPLE.replace(
    "【分镜02】",
    "【分镜02】",
  ).replace(
    "场景：Village 外 雪天 | 人物：村长 | 道具：无",
    "场景：Village 外 雪天 | 人物：村长 | 道具：无",
  );
  const units = compileToL1(parseStoryboard(twoScenes));
  // 同场第二条仍应继承妆造
  assert.match(units[2].prompt, /·粗布冬装/);
});

test("编号表：跨集不重复", () => {
  const text = `${SAMPLE}\n第2集：续\n【分镜01】\n[shot01 | 时长：6秒 | 场景：甲 内 晴 | 人物：村长、新人（New，着装：蓝衣） | 道具：无]\nClip A | 时长：6秒 | 景别：CU\nCAMERA: 固定机位 / CU. 村长说话。`;
  const reg = buildCharacterRegistry(parseStoryboard(text));
  assert.equal(reg.get("村长"), "C01-村长", "跨集仍是同一个编号");
  assert.equal(reg.get("新人"), "C03-新人", "新角色按全剧首次出场顺延（C02 是男弟子）");
});

test("台词：没有说话人时也能编译", () => {
  const text = SAMPLE.replace('EN: 村长: "Run!"', 'EN: "Run!"');
  const units = compileToL1(parseStoryboard(text));
  assert.match(units[0].prompt, /台词：\{Run!\}/);
});

test("编译：场景名沿用原文，不翻译", () => {
  const units = compileToL1(parseStoryboard(SAMPLE));
  assert.match(units[0].prompt, /^场景：Village 外 雪天/m);
});

test("编译：单位编号格式 EPxx-Sxx-X", () => {
  const units = compileToL1(parseStoryboard(SAMPLE));
  for (const u of units) assert.match(u.id, /^EP\d{2}-S\d{2}-[A-Z]$/);
});

test("编译：renderL1 每条都带参数行", () => {
  const l1 = renderL1(compileToL1(parseStoryboard(SAMPLE)));
  const n = (l1.match(/— 参数：duration=/g) || []).length;
  assert.equal(n, 3);
});

/* ---------------- golden fixture：v3 真实产出 ---------------- */

test("v3 产出：结构稳定（3 集 / 72 shot / 127 Clip）", () => {
  const p = parseStoryboard(V3);
  assert.equal(p.episodes.length, 3);
  assert.equal(p.episodes[0].shots.length, 24);
  assert.equal(p.episodes[1].shots.length, 22);
  assert.equal(p.episodes[2].shots.length, 26);
  let shots = 0;
  for (const e of p.episodes) shots += e.shots.length;
  assert.equal(shots, 72);
});

test("v3 产出：校验零问题（4–15 秒口径）", () => {
  const v = validateStoryboard(parseStoryboard(V3));
  assert.equal(v.stats.high, 0);
  assert.equal(v.stats.mid, 0);
  assert.equal(v.stats.clips, 127);
});

test("v3 产出：所有 Clip 都在 4–15 秒", () => {
  const p = parseStoryboard(V3);
  for (const e of p.episodes) {
    for (const s of e.shots) {
      for (const c of s.clips) {
        assert.ok(c.duration >= 4 && c.duration <= 15, `${e.no}-${s.no}${c.letter} = ${c.duration}s`);
      }
    }
  }
});

test("v3 产出：编译出 127 条生成单位", () => {
  const units = compileToL1(parseStoryboard(V3));
  assert.equal(units.length, 127);
  for (const u of units) {
    assert.ok(!/@图片/.test(u.prompt));
    assert.ok(!/\d+s/.test(u.prompt.split("风格与约束")[0]), "正文不该出现秒数");
  }
});
