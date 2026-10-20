// 流程二引擎的验收测试：npm run test:engine
//
// 这里断言的不是"跑得通"，而是设计文档 v0.3.1 §5 里那几条硬承诺：
//   只改结构不改一个字 / 落刀只在场景边界 / 超长场标为强制切点 / 重编号正确。

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_OPTIONS,
  parseScript,
  estimateAll,
  autoCuts,
  renumber,
  rebuildCast,
  renderScript,
  summarize,
  shiftCutLeft,
  shiftCutRight,
  normalizeSplits,
  sliceByCuts,
  suggestSplitPoint,
} from "../src/split.js";
import { SPLIT_SAMPLE } from "../src/mock-split.js";

/** 一场自己就超过上限的戏（台词多到撑爆窗口），用来测「场内下刀」 */
const LONG_SCENE = (() => {
  // 6 句 × 60 词 ≈ 147 秒，稳稳超过 105 秒上限
  const line = (n) =>
    `甲（平静）：${Array.from({ length: 60 }, (_, i) => `word${n}_${i}`).join(" ")}`;
  const body = [
    "△甲走进来。",
    line(1),
    line(2),
    "△甲坐下。",
    line(3),
    line(4),
    "△甲抬头。",
    line(5),
    line(6),
  ];
  return `第1集：超长场测试

1-1 长场 外 晴
人物：甲（A，着装：黑衣）
${body.join("\n")}

1-2 短场 内 夜
人物：乙（B，着装：白衣）
△乙站着。
乙（低声）：Done.
`;
})();

const opt = DEFAULT_OPTIONS;

function build(text, cuts, splits = {}) {
  const parsed = parseScript(text);
  const scenes = estimateAll(parsed, opt, {}, splits);
  const used = cuts ?? autoCuts(scenes, opt);
  const eps = renumber(scenes, used, opt);
  const added = rebuildCast(eps);
  return { parsed, scenes, cuts: used, eps, added };
}

/* ---------------- 解析 ---------------- */

test("解析：集、场、人物行、正文都对得上", () => {
  const { parsed } = build(SPLIT_SAMPLE);
  assert.equal(parsed.episodes.length, 2, "应解析出 2 集");
  assert.equal(parsed.sceneCount, 8, "应解析出 8 场");
  assert.deepEqual(parsed.warnings, [], "示例剧本不该有解析警告");

  const [first] = parsed.episodes[0].scenes;
  assert.equal(first.key, "1-1");
  assert.equal(first.place, "尼克蒂利乌斯府邸露台 外 晴朗");
  assert.ok(first.cast?.includes("朱莉娅"), "人物行应被识别");
  assert.ok(
    first.blocks.some((b) => b.kind === "dialogue"),
    "台词行应被识别为 dialogue",
  );
  assert.ok(
    first.blocks.some((b) => b.kind === "action"),
    "△ 行应被识别为 action",
  );
});

test("解析：兼容原生格式（第X集 + N. 场景名）", () => {
  const raw = `第 1 集：测试
1. 甲地
人物：甲（A，着装：黑衣）
△甲站着。
甲（低声）：Hi there.
2. 乙地
人物：乙（B，着装：白衣）
△乙走进来。
`;
  const { parsed } = build(raw);
  assert.equal(parsed.episodes.length, 1);
  assert.equal(parsed.sceneCount, 2);
  assert.equal(parsed.episodes[0].scenes[1].key, "1-2");
  assert.equal(parsed.episodes[0].scenes[1].place, "乙地");
});

/* ---------------- 估时 ---------------- */

test("估时：每场时长 = 台词 + 动作 + 建立", () => {
  const { scenes } = build(SPLIT_SAMPLE);
  for (const s of scenes) {
    assert.equal(s.sec, s.dlg + s.act + s.est, `${s.key} 的分项加总不等于总时长`);
  }
});

test("估时：动作封顶生效，且被标记出来", () => {
  const { scenes } = build(SPLIT_SAMPLE);
  for (const s of scenes) {
    assert.ok(s.act <= opt.beatCap, `${s.key} 的动作秒超过了单场上限`);
    if (s.actionLines * opt.beatSec > opt.beatCap) {
      assert.equal(s.capped, true, `${s.key} 应被标为动作封顶`);
      assert.equal(s.act, opt.beatCap);
    }
  }
});

test("估时：纯规则、可重复（同一输入两次结果完全相同）", () => {
  const a = build(SPLIT_SAMPLE).scenes.map((s) => s.sec);
  const b = build(SPLIT_SAMPLE).scenes.map((s) => s.sec);
  assert.deepEqual(a, b);
});

/* ---------------- 切分 ---------------- */

test("切分：落刀只在场景边界，不会切开任何一场", () => {
  const { scenes, cuts } = build(SPLIT_SAMPLE);
  assert.equal(cuts[0], 0, "第一刀应在开头");
  assert.equal(new Set(cuts).size, cuts.length, "落刀点不应重复");
  for (let i = 1; i < cuts.length; i += 1) {
    assert.ok(cuts[i] > cuts[i - 1], "落刀点必须递增");
    assert.ok(cuts[i] < scenes.length, "落刀点必须落在场景之间");
  }
});

test("切分：场次总数守恒，没有空集", () => {
  const { scenes, eps } = build(SPLIT_SAMPLE);
  assert.equal(
    eps.reduce((a, e) => a + e.scenes.length, 0),
    scenes.length,
    "切分前后场次总数应一致",
  );
  for (const ep of eps) assert.ok(ep.scenes.length > 0, "不应出现空集");
});

test("切分：超限的集只能是「单场就超长」", () => {
  const { eps } = build(SPLIT_SAMPLE);
  for (const ep of eps) {
    if (ep.sec > opt.windowHi) {
      assert.equal(ep.scenes.length, 1, "多场拼出来的集不该超上限");
      assert.equal(ep.forced, true, "单场超长集应被标为强制切点");
    }
  }
});

/* ---------------- 重编号 ---------------- */

test("重编号：集号连续，场次号 X-Y 与所属集一致且从 1 连续", () => {
  const { eps } = build(SPLIT_SAMPLE);
  eps.forEach((ep, i) => {
    assert.equal(ep.no, i + 1, "集号应从 1 连续");
    const keys = ep.scenes.map((s) => s.key);
    assert.equal(new Set(keys).size, keys.length, `第${ep.no}集里出现了重复场次`);
    // 场次顺序必须保持原剧本顺序（只重新分组，不重排）
    const sorted = [...keys].sort((a, b) => {
      const [a1, a2] = a.split("-").map(Number);
      const [b1, b2] = b.split("-").map(Number);
      return a1 - b1 || a2 - b2;
    });
    assert.deepEqual(keys, sorted, `第${ep.no}集的场次顺序被打乱了`);
  });
});

test("重编号：渲染出的场次号与集号对得上", () => {
  const { eps } = build(SPLIT_SAMPLE);
  const out = renderScript(eps);
  eps.forEach((ep) => {
    assert.match(out, new RegExp(`\\*\\*第${ep.no}集：`), `缺少第 ${ep.no} 集的标题`);
    ep.scenes.forEach((_, j) => {
      assert.match(out, new RegExp(`\\*\\*${ep.no}-${j + 1} `), `缺少场次 ${ep.no}-${j + 1}`);
    });
  });
});

/* ---------------- 核心承诺：一个字都不改 ---------------- */

test("只改结构：输出里的正文与台词逐行来自原文，一字未改", () => {
  const { eps } = build(SPLIT_SAMPLE);
  const out = renderScript(eps);

  const inputLines = new Set(
    SPLIT_SAMPLE.split("\n")
      .map((l) => l.trim())
      .filter(Boolean),
  );

  const bodyLines = out
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    // 生成的行：集标题、场次标题；以及被重算过的 人物 行
    .filter((l) => !/^\*\*第\d+集：/.test(l))
    .filter((l) => !/^\*\*\d+-\d+ /.test(l))
    .filter((l) => !l.startsWith("**人物："));

  assert.ok(bodyLines.length > 0, "应解析出正文行");
  for (const line of bodyLines) {
    assert.ok(inputLines.has(line), `输出里出现了原文没有的行：${line}`);
  }
  assert.equal(
    bodyLines.length,
    SPLIT_SAMPLE.split("\n").filter((l) => {
      const t = l.trim();
      return (
        t &&
        !/^\*\*第\d+集：/.test(t) &&
        !/^\*\*\d+-\d+ /.test(t) &&
        !t.startsWith("**人物：")
      );
    }).length,
    "正文行数应与原文一致（不增不减）",
  );
});

test("只改结构：总时长与场次时长在切分前后完全一致", () => {
  const { scenes, eps } = build(SPLIT_SAMPLE);
  const total = scenes.reduce((a, s) => a + s.sec, 0);
  assert.equal(
    eps.reduce((a, e) => a + e.sec, 0),
    total,
    "切分只是重新分组，不该改变总时长",
  );
});

/* ---------------- 着装重算 ---------------- */

test("着装：新集里首次出场的角色都被补上了「着装：」", () => {
  const { eps, added } = build(SPLIT_SAMPLE);
  assert.ok(added > 0, "跨集重编号后应发生着装补标");
  const registry = new Map();
  for (const ep of eps) {
    for (const s of ep.scenes) {
      if (!s.cast) continue;
      for (const item of s.cast.split("、")) {
        const m = item.match(/^(.+?)[（(]/);
        const d = item.match(/着装\s*[：:]\s*([^）)]+)/);
        if (m && d) registry.set(m[1].trim(), d[1].trim());
      }
    }
  }
  for (const ep of eps) {
    const seen = new Set();
    for (const s of ep.scenes) {
      if (!s.castOut) continue;
      for (const item of s.castOut.split("、")) {
        const name = item.split(/[（(]/)[0].trim();
        const first = !seen.has(name);
        seen.add(name);
        if (first && registry.has(name)) {
          assert.ok(
            /着装\s*[：:]/.test(item),
            `第${ep.no}集里 ${name} 第一次出场却缺「着装：」`,
          );
        }
      }
    }
  }
});

/* ---------------- 手动改边界 ---------------- */

test("手动：挪边界可逆，且不会产生空集", () => {
  const { scenes, cuts } = build(SPLIT_SAMPLE);
  const moved = shiftCutRight(cuts, 0, scenes.length);
  assert.notDeepEqual(moved, cuts, "应真的挪动了");
  const back = shiftCutLeft(moved, 0);
  assert.deepEqual(back, cuts, "挪过去再挪回来应完全还原");

  // 边界：下一集只剩一场时，不能再从它那里往上一集并
  assert.deepEqual(shiftCutLeft([0, 1], 0), [0, 1], "只剩一场时不该被拿走");

  // 边界：再往后并会让下一集变空，就不该动
  assert.deepEqual(
    shiftCutRight([0, 4, 5], 0, 8),
    [0, 4, 5],
    "会让下一集变空时不该动",
  );

  // 挪完之后每一集都还有场次
  const eps = renumber(scenes, moved, opt);
  for (const ep of eps) assert.ok(ep.scenes.length > 0, "挪动后不该出现空集");
});

/* ---------------- 统计 ---------------- */

test("统计：窗口内/超上限/低于下限加起来等于总集数", () => {
  const { eps } = build(SPLIT_SAMPLE);
  const s = summarize(eps, opt);
  assert.equal(s.ok + s.over + s.under, s.episodes);
  assert.equal(s.episodes, eps.length);
  assert.equal(s.scenes, SPLIT_SAMPLE.split("\n").filter((l) => /^\*\*\d+-\d+ /.test(l.trim())).length);
});

/* ---------------- 场内下刀 ---------------- */

test("下刀工具：非法切点被过滤掉", () => {
  assert.deepEqual(normalizeSplits(undefined, 5), []);
  assert.deepEqual(normalizeSplits([], 5), []);
  assert.deepEqual(normalizeSplits([0], 5), [], "第一块之前不能切");
  assert.deepEqual(normalizeSplits([5], 5), [], "最后一块之后不能切");
  assert.deepEqual(normalizeSplits([3, 1, 3, 2], 5), [1, 2, 3], "去重 + 排序");
  assert.deepEqual(normalizeSplits([1.5], 5), [], "必须是整数块索引");
  assert.deepEqual(sliceByCuts([1, 2, 3, 4], [2]), [[1, 2], [3, 4]]);
  assert.deepEqual(sliceByCuts([1, 2, 3, 4], []), [[1, 2, 3, 4]]);
});

test("下刀建议点：落在块与块之间，且两边都有内容", () => {
  const { parsed } = build(LONG_SCENE);
  const blocks = parsed.episodes[0].scenes[0].blocks;
  const point = suggestSplitPoint(blocks, opt);
  assert.ok(Number.isInteger(point));
  assert.ok(point >= 1 && point <= blocks.length - 1, "两边都要有块");
});

test("场内下刀：一场变两段，内容一字不差、总时长不变", () => {
  const { parsed } = build(LONG_SCENE);
  const blocks = parsed.episodes[0].scenes[0].blocks;
  const point = suggestSplitPoint(blocks, opt);

  const before = build(LONG_SCENE);
  const after = build(LONG_SCENE, undefined, { "1-1": [point] });

  const seg1 = before.scenes.find((s) => s.key === "1-1");
  assert.ok(seg1.auto > opt.windowHi, "这个测试样本本身就该超上限");

  const parts = after.scenes.filter((s) => s.origin === "1-1");
  assert.equal(parts.length, 2, "应切出两段");
  assert.deepEqual(
    parts.map((p) => p.key),
    ["1-1#1", "1-1#2"],
    "两段要有各自唯一的 key",
  );
  // 每段各自把台词向上取整，所以允许每段 1 秒的舍入差
  const sum = parts.reduce((a, p) => a + p.auto, 0);
  assert.ok(
    Math.abs(sum - seg1.auto) <= parts.length,
    `切出来的两段之和应约等于原来那一场：${sum} vs ${seg1.auto}`,
  );
  assert.equal(parts[1].est, 0, "切出来的后一段是同地延续，不该再加建立镜头");
  assert.equal(parts[0].est, seg1.est, "头一段保留建立镜头");

  // 内容不增不减、顺序不变
  const joined = parts.flatMap((p) => p.body).join("\n");
  const original = parsed.episodes[0].scenes[0].body.join("\n");
  assert.equal(joined, original, "两段拼起来必须与原文逐行相同");
});

test("场内下刀：撤销后完全还原", () => {
  const { parsed } = build(LONG_SCENE);
  const blocks = parsed.episodes[0].scenes[0].blocks;
  const point = suggestSplitPoint(blocks, opt);
  const before = build(LONG_SCENE).scenes.map((s) => [s.key, s.sec]);
  const after = build(LONG_SCENE, undefined, { "1-1": [] }).scenes.map((s) => [s.key, s.sec]);
  const splitOpen = build(LONG_SCENE, undefined, { "1-1": [point] }).scenes.length;
  assert.equal(splitOpen, 3, "切开后总共 3 段（原 2 场 + 多出的 1 段）");
  assert.deepEqual(after, before, "切点清空后应回到原状");
});

test("场内下刀：下完刀全剧不再有单场超长", () => {
  const { parsed } = build(LONG_SCENE);
  const blocks = parsed.episodes[0].scenes[0].blocks;
  const point = suggestSplitPoint(blocks, opt);
  const after = build(LONG_SCENE, undefined, { "1-1": [point] });
  const still = after.scenes.filter((s) => s.parts === 1 && s.auto > opt.windowHi);
  assert.equal(still.length, 0, "下刀之后不该还剩单场超长的场");
});

/* ---------------- 集尾落点与「接受这一集」 ---------------- */

test("集尾落点：取这一集最后一场的最后一行，且已去掉粗体标记", () => {
  const { eps } = build(SPLIT_SAMPLE);
  for (const ep of eps) {
    assert.ok(ep.tail, `第${ep.no}集应有集尾落点`);
    assert.ok(!ep.tail.includes("**"), "落点文本不该带 markdown 标记");
    const lastScene = ep.scenes[ep.scenes.length - 1];
    assert.equal(ep.tail, lastScene.body[lastScene.body.length - 1].replace(/\*\*/g, "").trim());
  }
});

test("接受这一集：被接受的超限集不再计入「超上限 / 低于下限」，但单独计数", () => {
  const { scenes, cuts } = build(LONG_SCENE);
  const eps = renumber(scenes, cuts, opt);
  const before = summarize(eps, opt);
  assert.ok(before.over + before.under > 0, "样本里应有超限的集");
  assert.equal(before.waived, 0);

  for (const ep of eps) if (ep.status !== "ok") ep.waived = true;
  const after = summarize(eps, opt);
  assert.equal(after.over, 0, "被接受的超限集不该再报超上限");
  assert.equal(after.under, 0);
  assert.equal(after.waived, before.over + before.under, "应该单独计数");
  assert.equal(after.episodes, before.episodes, "接受不改动集数");
});
