/**
 * 流程二 · 集数拆分与重组 —— 引擎
 *
 * 设计前提（见设计文档 v0.3.1 §5）：
 *   1. 只改结构，不改一个字 —— 场内的正文/台词原样搬运，只重新分组与重新编号。
 *   2. 零模型调用 —— 估时用纯规则（实测模型估时两次差 32%，不可重复）。
 *   3. 落刀点只能在场景边界；超长场单独标记为强制切点。
 */

/* ---------------- 纯规则估时参数（4 个旋钮） ---------------- */

export const DEFAULT_OPTIONS = {
  cjkRate: 4.5, // 中文台词：字/秒
  latinRate: 2.5, // 英文台词：词/秒
  pausePerLine: 0.5, // 每句台词的呼吸/停顿余量：秒
  beatSec: 3, // 每个动作节拍：秒
  beatCap: 20, // 单场动作时间上限：秒
  establishSec: 2, // 新场景建立镜头：秒
  windowLo: 75, // 成片集时长下限
  windowHi: 105, // 成片集时长上限
};

export const OPTION_ROWS = [
  { key: "cjkRate", label: "中文语速", unit: "字/秒", step: 0.5 },
  { key: "latinRate", label: "英文语速", unit: "词/秒", step: 0.5 },
  { key: "pausePerLine", label: "每句停顿", unit: "秒", step: 0.5 },
  { key: "beatSec", label: "动作节拍", unit: "秒/拍", step: 0.5 },
  { key: "beatCap", label: "单场动作上限", unit: "秒", step: 5 },
  { key: "establishSec", label: "场景建立", unit: "秒", step: 1 },
];

/* ---------------- 解析 ---------------- */

const RE_EPISODE = /^第\s*([0-9]+)\s*集\s*(?:[：:]\s*(.*))?$/;
const RE_SCENE = /^([0-9]+)\s*-\s*([0-9]+)\s+(.+)$/;
const RE_SCENE_ALT = /^([0-9]+)\s*[.、]\s*(.+)$/;
const RE_CAST = /^人物\s*[：:]\s*(.*)$/;
const RE_DIALOGUE = /^(.{1,24}?)（([^）]*)）\s*[：:]\s*([\s\S]+)$/;
const RE_MARKER = /^△\s*【(字幕|音效|音乐)】/;
const RE_CJK = /[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/g;

const strip = (s) => s.replace(/\*\*/g, "").trim();

/**
 * 把剧本原文解析成 集 → 场 → 块。
 * 兼容两种输入：流程一产出的 `X-Y 场景名 内/外 天气`，以及原生的 `第X集` + `N. 场景名`。
 */
export function parseScript(text) {
  const episodes = [];
  let ep = null;
  let scene = null;
  let seq = 0;
  const warnings = [];
  let unassigned = 0;

  const pushEpisode = (no, title) => {
    ep = { no, title: title || "", scenes: [] };
    episodes.push(ep);
    scene = null;
    seq = 0;
  };

  const pushScene = (place) => {
    if (!ep) pushEpisode(episodes.length + 1, "");
    seq += 1;
    scene = {
      key: `${ep.no}-${seq}`,
      place: place.trim(),
      cast: null,
      body: [],
      blocks: [],
    };
    ep.scenes.push(scene);
  };

  for (const rawLine of text.split(/\r?\n/)) {
    const line = strip(rawLine);
    if (!line) continue;

    let m;
    if ((m = line.match(RE_EPISODE))) {
      pushEpisode(Number(m[1]), m[2] ?? "");
      continue;
    }
    if ((m = line.match(RE_SCENE))) {
      pushScene(m[3]);
      continue;
    }
    if (ep && (m = line.match(RE_SCENE_ALT))) {
      const n = Number(m[1]);
      if (n === seq + 1) {
        pushScene(m[2]);
        continue;
      }
    }
    if (!scene) {
      unassigned += 1;
      continue;
    }
    if ((m = line.match(RE_CAST))) {
      scene.cast = m[1];
      continue;
    }
    if (line.startsWith("△")) {
      scene.body.push(rawLine);
      scene.blocks.push({
        kind: RE_MARKER.test(line) ? "marker" : "action",
        text: line,
      });
      continue;
    }
    if ((m = line.match(RE_DIALOGUE))) {
      scene.body.push(rawLine);
      scene.blocks.push({
        kind: "dialogue",
        name: m[1],
        tone: m[2],
        content: m[3].trim(),
      });
      continue;
    }
    scene.body.push(rawLine);
    scene.blocks.push({ kind: "raw", text: line });
  }

  const sceneCount = episodes.reduce((a, e) => a + e.scenes.length, 0);
  if (episodes.length === 0) warnings.push("没有识别到任何「第X集」，请检查输入格式。");
  if (unassigned > 0) warnings.push(`${unassigned} 行内容出现在任何场次之前，已忽略。`);
  const noCast = episodes.flatMap((e) => e.scenes).filter((s) => !s.cast).length;
  if (noCast > 0) warnings.push(`${noCast} 个场次没有「人物：」行。`);

  return { episodes, sceneCount, warnings };
}

/* ---------------- 估时（0 token） ---------------- */

function dialogueSeconds(content, opt) {
  const cjk = (content.match(RE_CJK) || []).length;
  const latin = content
    .replace(RE_CJK, " ")
    .split(/\s+/)
    .filter(Boolean).length;
  return cjk / opt.cjkRate + latin / opt.latinRate + opt.pausePerLine;
}

/* ---------------- 场内下刀 ----------------

   一场戏自己就超过上限时（实测 101 场里有 3 场，最长 168 秒），
   只能在这一场内部再切一刀。切点在"块"之间 —— 块就是 △ 动作行与台词行。

   切出来的每一段仍然是独立的"场"（有自己的场次号、人物行），
   所以下游的切分逻辑完全不用改。
*/

/** 过滤出合法的切点（第一块之前 / 最后一块之后不算，重复的去掉） */
export function normalizeSplits(points, blockCount) {
  if (!Array.isArray(points)) return [];
  return [...new Set(points)]
    .filter((p) => Number.isInteger(p) && p >= 1 && p <= blockCount - 1)
    .sort((a, b) => a - b);
}

/** 按切点把块数组切成若干段 */
export function sliceByCuts(list, cuts) {
  const out = [];
  let start = 0;
  for (const c of cuts) {
    out.push(list.slice(start, c));
    start = c;
  }
  out.push(list.slice(start));
  return out;
}

function blockSeconds(block, opt) {
  if (block.kind === "dialogue") return dialogueSeconds(block.content, opt);
  if (block.kind === "action") return opt.beatSec;
  return 0;
}

/** 建议的切点：让切开后的两半时长尽量相等 */
export function suggestSplitPoint(blocks, opt) {
  const total = blocks.reduce((a, b) => a + blockSeconds(b, opt), 0);
  let acc = 0;
  let best = 1;
  let bestDiff = Infinity;
  for (let i = 1; i <= blocks.length - 1; i += 1) {
    acc += blockSeconds(blocks[i - 1], opt);
    const diff = Math.abs(acc - total / 2);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = i;
    }
  }
  return best;
}

/** 给全剧每一场算预估秒数，返回扁平数组（切分的工作对象）。已下刀的场会展开成多段。 */
export function estimateAll(parsed, opt, overrides = {}, splits = {}) {
  const out = [];
  for (const ep of parsed.episodes) {
    let prevPlace = null;
    for (const scene of ep.scenes) {
      const cuts = normalizeSplits(splits[scene.key], scene.blocks.length);
      const parts = sliceByCuts(scene.blocks, cuts);
      const bodies = sliceByCuts(scene.body, cuts);
      const multi = parts.length > 1;

      parts.forEach((blocks, i) => {
        const key = multi ? `${scene.key}#${i + 1}` : scene.key;
        const dlgLines = blocks.filter((b) => b.kind === "dialogue");
        const actLines = blocks.filter((b) => b.kind === "action");
        const dlg = Math.ceil(
          dlgLines.reduce((a, b) => a + dialogueSeconds(b.content, opt), 0),
        );
        const actRaw = actLines.length * opt.beatSec;
        const act = Math.min(actRaw, opt.beatCap);
        // 只有这一场的头一段算"新场景"；切出来的后一段是同地延续，不加建立镜头
        const est = i === 0 && scene.place !== prevPlace ? opt.establishSec : 0;
        const auto = dlg + act + est;
        const override = overrides[key];
        out.push({
          key,
          origin: scene.key,
          part: i + 1,
          parts: parts.length,
          splitAt: multi ? cuts[i] : null,
          cutPoints: cuts,
          epNo: ep.no,
          epTitle: ep.title,
          place: scene.place,
          cast: scene.cast,
          body: bodies[i],
          blockCount: blocks.length,
          dlg,
          act,
          est,
          auto,
          sec: typeof override === "number" ? override : auto,
          overridden: typeof override === "number",
          capped: actRaw > opt.beatCap,
          actionLines: actLines.length,
          dialogueLines: dlgLines.length,
        });
      });
      prevPlace = scene.place;
    }
  }
  return out;
}

/* ---------------- 切分 ---------------- */

/**
 * 贪心切分：只在场景边界落刀。
 * cuts[k] = 第 k+1 集从第几个场景开始（含）。
 */
export function autoCuts(scenes, opt) {
  const cuts = [0];
  let sec = 0;
  for (let i = 0; i < scenes.length; i++) {
    if (sec > 0 && sec + scenes[i].sec > opt.windowHi) {
      cuts.push(i);
      sec = 0;
    }
    sec += scenes[i].sec;
  }
  return cuts;
}

export function packEpisodes(scenes, cuts) {
  const eps = [];
  for (let k = 0; k < cuts.length; k++) {
    const start = cuts[k];
    const end = k + 1 < cuts.length ? cuts[k + 1] : scenes.length;
    const items = scenes.slice(start, end);
    if (!items.length) continue;
    eps.push({
      start,
      end,
      scenes: items,
      sec: items.reduce((a, b) => a + b.sec, 0),
      titles: [...new Set(items.map((s) => s.epTitle).filter(Boolean))],
    });
  }
  return eps;
}

/** 把第 bi 个边界的落刀点往前挪一场（末场并入下一集）。 */
export function shiftCutRight(cuts, bi, sceneCount) {
  const next = bi + 2 < cuts.length ? cuts[bi + 2] : sceneCount;
  if (cuts[bi + 1] + 1 >= next) return cuts;
  const out = [...cuts];
  out[bi + 1] += 1;
  return out;
}

/** 把第 bi 个边界的落刀点往后挪一场（下一集首场并入上一集）。 */
export function shiftCutLeft(cuts, bi) {
  if (cuts[bi + 1] - 1 <= cuts[bi]) return cuts;
  const out = [...cuts];
  out[bi + 1] -= 1;
  return out;
}

export function renumber(scenes, cuts, opt) {
  const eps = packEpisodes(scenes, cuts);
  return eps.map((ep, i) => ({
    ...ep,
    no: i + 1,
    title: ep.titles.length ? ep.titles.join(" · ") : `第${i + 1}集`,
    status: statusOf(ep.sec, opt),
    forced: ep.scenes.length === 1 && ep.sec > opt.windowHi,
    // 集尾落点：这一集最后停在哪个动作 / 哪句台词 —— 人靠它判断钩子留得对不对
    tail: lastLineOf(ep),
  }));
}

function lastLineOf(ep) {
  const scene = ep.scenes[ep.scenes.length - 1];
  if (!scene?.body?.length) return "";
  return scene.body[scene.body.length - 1].replace(/\*\*/g, "").trim();
}

export function statusOf(sec, opt) {
  if (sec > opt.windowHi) return "over";
  if (sec < opt.windowLo) return "under";
  return "ok";
}

/* ---------------- 着装标注重算 ---------------- */

function splitCastLine(cast) {
  const items = [];
  let depth = 0;
  let buf = "";
  for (const ch of cast) {
    if (ch === "（" || ch === "(") depth += 1;
    if (ch === "）" || ch === ")") depth -= 1;
    if (ch === "、" && depth === 0) {
      if (buf.trim()) items.push(buf.trim());
      buf = "";
      continue;
    }
    buf += ch;
  }
  if (buf.trim()) items.push(buf.trim());
  return items;
}

function dressOf(item) {
  const m = item.match(/[，,]\s*着装\s*[：:]\s*([^）)]+)/) || item.match(/着装\s*[：:]\s*([^）)]+)/);
  return m ? m[1].trim() : "";
}

function nameOf(item) {
  const i = item.search(/[（(]/);
  return (i === -1 ? item : item.slice(0, i)).trim();
}

/**
 * 按新集重算「同集首次出场标注着装、跨集重新标注」。
 * 只补不删：新集里某角色第一次出场却缺着装时，从全剧登记表里补回来。
 */
export function rebuildCast(eps) {
  const registry = new Map();
  for (const ep of eps) {
    for (const s of ep.scenes) {
      if (!s.cast) continue;
      for (const item of splitCastLine(s.cast)) {
        const name = nameOf(item);
        const dress = dressOf(item);
        if (name && dress && !registry.has(name)) registry.set(name, dress);
      }
    }
  }

  let added = 0;
  for (const ep of eps) {
    const seen = new Set();
    for (const s of ep.scenes) {
      if (!s.cast) {
        s.castOut = s.cast;
        continue;
      }
      const items = splitCastLine(s.cast).map((item) => {
        const name = nameOf(item);
        const first = !seen.has(name);
        seen.add(name);
        if (first && name && !dressOf(item) && registry.has(name)) {
          added += 1;
          const dress = registry.get(name);
          // 规范形如「中文短名（英文全名，着装：xxx）」—— 着装补在括号内末尾
          const close = Math.max(item.lastIndexOf("）"), item.lastIndexOf(")"));
          if (close === -1) return `${item}（着装：${dress}）`;
          const before = item.slice(0, close).replace(/[，,]\s*$/, "");
          return `${before}，着装：${dress}${item.slice(close)}`;
        }
        return item;
      });
      s.castOut = items.join("、");
    }
  }
  return added;
}

/* ---------------- 渲染输出 ---------------- */

export function renderScript(eps) {
  const out = [];
  for (const ep of eps) {
    out.push(`**第${ep.no}集：${ep.title}**`);
    out.push("");
    ep.scenes.forEach((s, i) => {
      out.push(`**${ep.no}-${i + 1} ${s.place}**`);
      if (s.castOut) out.push(`**人物：${s.castOut}**`);
      for (const line of s.body) out.push(line);
      out.push("");
    });
  }
  return out.join("\n").trimEnd() + "\n";
}

export function summarize(eps, opt) {
  const total = eps.reduce((a, e) => a + e.sec, 0);
  return {
    episodes: eps.length,
    scenes: eps.reduce((a, e) => a + e.scenes.length, 0),
    total,
    minutes: total / 60,
    ok: eps.filter((e) => e.status === "ok").length,
    over: eps.filter((e) => e.status === "over" && !e.waived).length,
    under: eps.filter((e) => e.status === "under" && !e.waived).length,
    waived: eps.filter((e) => e.waived).length,
    window: [opt.windowLo, opt.windowHi],
    forced: eps.filter((e) => e.forced).length,
  };
}
