/**
 * 流程三 · 分镜头转译 —— 引擎（纯规则，零模型）
 *
 * 三件事：
 *   1. parseStoryboard  把分镜脚本解析成 集 → shot → Clip
 *   2. validateStoryboard 按协议机械校验（只报告，不改稿）
 *   3. compileToL1      把每个 Clip 编译成 Seedance 提示词（机读层 L1）
 *
 * 依据：`Seedance编译规范-v0.7.md`
 *   - Clip 4–15 秒（引擎硬下限）
 *   - 单 shot ≤ 3 个 Clip
 *   - 生成单位 = Clip
 *   - 角色标签 `编号-中文短名`，妆造按场标注
 *   - L1 只输出标签占位，不写 @图片N
 */

/* ---------------- 常量 ---------------- */

export const CLIP_MIN = 4;
export const CLIP_MAX = 15;
export const SHOT_MIN = 5;
export const SHOT_MAX = 15;
export const MAX_CLIPS_PER_SHOT = 3;

export const DEFAULT_STYLE = {
  tone: "竖屏短剧，写实电影质感，冷调自然光",
  quality: "高清，细节丰富，电影质感，色彩自然，光影柔和",
  stable: "人物面部稳定不变形、五官清晰，动作连贯自然，不僵硬，无穿模无卡顿",
  noSubtitle: "保持无字幕，避免生成任何文字或字幕",
  noMark: "不要生成水印；不要生成 Logo",
  twins:
    "视频全程禁止出现外形、着装、配饰完全一致的人物，禁止生成同款分身、双胞胎效果，同一画面中仅保留单个对应人物",
};

/* ---------------- 1. 解析 ---------------- */

const RE_EP = /^第\s*(\d+)\s*集(?:\s*[：:]\s*(.*))?$/;
const RE_SHOT_MARK = /^【分镜(\d+)】$/;
const RE_SHOT_HEAD = /^\[shot(\d+)\s*\|(.*?)\]?\s*$/;
const RE_CLIP = /^Clip\s+([A-Z])\s*\|(.*)$/;
const RE_CAMERA = /^CAMERA\s*[：:]\s*(.*)$/;
const RE_EN = /^EN\s*[：:]\s*(.*)$/;
const RE_POS = /^人物空间位置\s*[：:]?\s*$/;

const trim = (s) => String(s ?? "").trim();
const plainHeading = (s) =>
  trim(s)
    .replace(/^#{1,6}\s+/, "")
    .replace(/^\*\*(.*)\*\*$/, "$1")
    .trim();

function parseFields(raw) {
  const out = {};
  for (const part of raw.split("|")) {
    const i = part.search(/[：:]/);
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k) out[k] = v;
  }
  return out;
}

/** 「角色（英文，着装：xxx）」「角色」→ { name, full, dress } */
export function parseCastItem(item) {
  const s = trim(item);
  const open = s.search(/[（(]/);
  if (open < 0) return { name: s, full: "", dress: "" };
  const close = Math.max(s.lastIndexOf("）"), s.lastIndexOf(")"));
  const name = s.slice(0, open).trim();
  const inner = s.slice(open + 1, close > open ? close : undefined);
  const m = inner.match(/着装\s*[：:]\s*(.+)$/);
  return {
    name,
    full: m ? inner.slice(0, m.index).replace(/[，,]\s*$/, "").trim() : inner.trim(),
    dress: m ? m[1].trim() : "",
  };
}

export function parseCastLine(line) {
  return trim(line)
    .replace(/^人物\s*[：:]\s*/, "")
    .split("、")
    .map(parseCastItem)
    // 「人物：无」表示这一场没有角色，不是有一个叫"无"的角色
    .filter((x) => x.name && !/^(无|无人|空|—|-)$/.test(x.name));
}

/** 把「村长（O.S.）」拆成 { name: "村长", mode: "O.S." } */
export function splitSpeaker(raw) {
  const s = trim(raw);
  const m = s.match(/^(.+?)\s*[（(]\s*(O\.?S\.?|V\.?O\.?|画外音|内心独白)\s*[）)]\s*$/i);
  if (!m) return { name: s, mode: "" };
  const mode = m[2].toUpperCase().replace(/\./g, "");
  return { name: m[1].trim(), mode: mode === "VO" ? "V.O." : mode === "OS" ? "O.S." : m[2] };
}

export function parseStoryboard(text) {
  const episodes = [];
  const warnings = [];
  let ep = null;
  let shot = null;
  let clip = null;
  let expectPos = false;

  for (const rawLine of String(text || "").split(/\r?\n/)) {
    const line = plainHeading(rawLine);
    if (!line) continue;
    let m;

    if ((m = line.match(RE_EP))) {
      ep = { no: Number(m[1]), title: trim(m[2]), shots: [] };
      episodes.push(ep);
      shot = null;
      clip = null;
      continue;
    }
    if ((m = line.match(RE_SHOT_MARK))) {
      if (!ep) {
        warnings.push(`分镜${m[1]} 出现在任何集之前，已忽略`);
        continue;
      }
      shot = {
        no: Number(m[1]),
        duration: null,
        scene: "",
        cast: [],
        props: "",
        position: "",
        clips: [],
      };
      ep.shots.push(shot);
      clip = null;
      continue;
    }
    if ((m = line.match(RE_SHOT_HEAD)) && shot) {
      const f = parseFields(m[2]);
      shot.no = Number(m[1]) || shot.no;
      shot.duration = Number((f["时长"] || "").match(/\d+/)?.[0] ?? NaN) || null;
      shot.scene = f["场景"] || "";
      shot.castRaw = f["人物"] || "";
      shot.cast = parseCastLine(shot.castRaw);
      shot.props = f["道具"] || "";
      continue;
    }
    if (RE_POS.test(line) && shot) {
      expectPos = true;
      continue;
    }
    if (expectPos && shot) {
      shot.position = line;
      expectPos = false;
      continue;
    }
    if ((m = line.match(RE_CLIP)) && shot) {
      const f = parseFields(m[2]);
      clip = {
        letter: m[1],
        duration: Number((f["时长"] || "").match(/\d+/)?.[0] ?? NaN) || null,
        size: f["景别"] || "",
        camera: "",
        desc: "",
        dialogue: [],
      };
      shot.clips.push(clip);
      continue;
    }
    if (clip && (m = line.match(RE_CAMERA))) {
      clip.camera = m[1];
      continue;
    }
    if (clip && (m = line.match(RE_EN))) {
      const raw = m[1].trim();
      const dm = raw.match(/^(.+?)\s*[：:]\s*["“](.*)["”]\s*$/);
      clip.dialogue.push(
        dm
          ? { speaker: splitSpeaker(dm[1]).name, mode: splitSpeaker(dm[1]).mode, text: dm[2].trim() }
          : { speaker: "", mode: "", text: raw.replace(/^["“]|["”]$/g, "").trim() },
      );
      continue;
    }
  }

  if (!episodes.length) warnings.push("没有识别到任何「第N集」");
  return { episodes, warnings };
}

/* ---------------- 2. 校验 ---------------- */

export function validateStoryboard(parsed, policy = {}) {
  const issues = [];
  const add = (level, where, msg) => issues.push({ level, where, msg });
  const shotMin = Number(policy.shotMin) || SHOT_MIN;
  const shotMax = Number(policy.shotMax) || SHOT_MAX;
  const clipMin = Number(policy.clipMin) || CLIP_MIN;
  const clipMax = Number(policy.clipMax) || CLIP_MAX;
  const maxClipsPerShot = Number(policy.maxClips) || MAX_CLIPS_PER_SHOT;

  let shots = 0;
  let clips = 0;

  for (const ep of parsed.episodes) {
    if (!ep.shots.length) add("高", `第${ep.no}集`, "没有分镜");
    const nos = ep.shots.map((s) => s.no);
    if (nos[0] !== 1) add("高", `第${ep.no}集`, `shot 编号不是从 01 开始（首个 ${nos[0]}）`);
    if (nos.join(",") !== nos.map((_, i) => i + 1).join(",")) {
      add("高", `第${ep.no}集`, `shot 编号不连续：${nos.join(",")}`);
    }

    for (const s of ep.shots) {
      shots += 1;
      const where = `第${ep.no}集 分镜${s.no}`;
      if (!s.scene) add("中", where, "缺少场景");
      // 「人物：无」是合法的空镜；只有真正缺人物行才报
      if (!s.cast.length && !/^(无|无人|空|—|-)$/.test(trim(s.castRaw))) {
        add("中", where, "缺少人物");
      }
      if (s.duration === null) add("高", where, "表头没写时长");
      else if (s.duration < shotMin || s.duration > shotMax) {
        add("高", where, `shot 时长 ${s.duration}s 不在 ${shotMin}–${shotMax}s`);
      }

      const letters = s.clips.map((c) => c.letter).join("");
      const want = s.clips.map((_, i) => String.fromCharCode(65 + i)).join("");
      if (letters !== want) add("中", where, `Clip 字母不是 A 起连续：${letters || "（无）"}`);
      if (s.clips.length > maxClipsPerShot) {
        add("高", where, `Clip 数 ${s.clips.length} 超过上限 ${maxClipsPerShot}`);
      }

      const sum = s.clips.reduce((a, c) => a + (c.duration ?? 0), 0);
      if (s.duration !== null && sum !== s.duration) {
        add("高", where, `Clip 加总 ${sum}s ≠ shot ${s.duration}s`);
      }

      for (const c of s.clips) {
        clips += 1;
        if (c.duration === null) add("高", `${where} Clip ${c.letter}`, "没写时长");
        else if (c.duration < clipMin || c.duration > clipMax) {
          add("高", `${where} Clip ${c.letter}`, `Clip 时长 ${c.duration}s 不在 ${clipMin}–${clipMax}s`);
        }
        if (!c.size) add("中", `${where} Clip ${c.letter}`, "缺少景别");
        if (!c.camera) add("中", `${where} Clip ${c.letter}`, "缺少 CAMERA 行");
      }
    }
  }

  return {
    issues,
    stats: {
      episodes: parsed.episodes.length,
      shots,
      clips,
      high: issues.filter((i) => i.level === "高").length,
      mid: issues.filter((i) => i.level === "中").length,
    },
  };
}

/* ---------------- 3. 机读层编译（L1） ---------------- */

/** 场景内的妆造登记表：同场首次出现的妆造沿用到同场后续 */
function buildCostumeRegistry(ep) {
  const registry = new Map();
  for (const shot of ep.shots) {
    const sceneKey = shot.scene || "_";
    for (const c of shot.cast) {
      if (c.dress) registry.set(`${sceneKey}::${c.name}`, c.dress);
    }
  }
  return registry;
}

/** `固定机位 / MS. 描述` → { move: "固定机位", desc: "描述" } */
export function splitCamera(camera) {
  const s = trim(camera);
  const m = s.match(/^([^/]+?)\s*\/\s*([A-Za-z]+)\s*[.．]\s*(.*)$/);
  if (m) return { move: m[1].trim(), size: m[2].trim(), desc: m[3].trim() };
  const m2 = s.match(/^([^/]+?)\s*\/\s*(.*)$/);
  if (m2) return { move: m2[1].trim(), size: "", desc: m2[2].trim() };
  return { move: "", size: "", desc: s };
}

const RE_HAS_NUMBER = /^[A-Za-z]{0,3}\d+\s*-/;

/**
 * 全剧角色编号表。
 * 剧本已带编号就沿用；没有就按**全剧首次出场顺序**补 C01、C02…
 * 一批一批生成时编号会漂，所以只能在一份完整分镜上建表。
 */
export function buildCharacterRegistry(parsed) {
  const map = new Map();
  let seq = 0;
  for (const ep of parsed.episodes) {
    for (const shot of ep.shots) {
      for (const c of shot.cast) {
        if (!c.name || map.has(c.name)) continue;
        if (RE_HAS_NUMBER.test(c.name)) {
          map.set(c.name, c.name);
        } else {
          seq += 1;
          map.set(c.name, `C${String(seq).padStart(2, "0")}-${c.name}`);
        }
      }
    }
  }
  return map;
}

function castToken(name, dress, registry) {
  const base = registry.get(name) || name;
  return dress ? `<${base}·${dress}>` : `<${base}>`;
}

/** 把动作描述里第一次出现的角色名换成主体标签 */
function tagDescription(desc, castList, registry) {
  let out = desc;
  for (const c of castList) {
    const token = castToken(c.name, c.dress, registry);
    if (out.includes(c.name)) {
      out = out.replace(c.name, token);
    }
  }
  return out;
}

/**
 * 每个 Clip → 一条 Seedance 2.0 提示词（L1）
 * 注意：不写 @图片N、不写秒数。
 */
export function compileToL1(parsed, style = DEFAULT_STYLE) {
  const units = [];
  const registry = buildCharacterRegistry(parsed);

  for (const ep of parsed.episodes) {
    const costumes = buildCostumeRegistry(ep);
    for (const shot of ep.shots) {
      const sceneKey = shot.scene || "_";
      const resolved = shot.cast.map((c) => ({
        ...c,
        dress: c.dress || costumes.get(`${sceneKey}::${c.name}`) || "",
      }));
      const castTokens = resolved.map((c) => castToken(c.name, c.dress, registry));
      const tokenByName = new Map(
        resolved.map((c) => [c.name, castToken(c.name, c.dress, registry)]),
      );

      for (const clip of shot.clips) {
        const cam = splitCamera(clip.camera);
        const move = cam.move || "固定机位";
        const size = clip.size || cam.size || "";
        const desc = tagDescription(cam.desc || "", resolved, registry);
        const multi = shot.cast.length >= 2;

        const lines = [];
        lines.push(
          `场景：${shot.scene || "（未注明）"}` + (shot.position ? `。开场空间：${shot.position}` : ""),
        );
        if (castTokens.length) lines.push(`主体：${castTokens.join("、")}`);
        lines.push(
          `镜头1：${[move, size].filter(Boolean).join("，")}，${desc || "（待补画面描述）"}`,
        );
        for (const d of clip.dialogue) {
          const who = d.speaker ? tokenByName.get(d.speaker) || castToken(d.speaker, "", registry) : "";
          const mode = d.mode ? `（${d.mode}）` : "";
          lines.push(who ? `台词：${who}${mode} 说 {${d.text}}` : `台词：{${d.text}}`);
        }

        const packs = [style.quality, style.stable, style.noSubtitle, style.noMark];
        if (multi) packs.push(style.twins);
        lines.push(`风格与约束：${style.tone}。${packs.join("；")}。`);

        units.push({
          id: `EP${String(ep.no).padStart(2, "0")}-S${String(shot.no).padStart(2, "0")}-${clip.letter}`,
          episode: ep.no,
          shot: shot.no,
          letter: clip.letter,
          durationSec: clip.duration,
          ratio: "9:16",
          prompt: lines.join("\n"),
        });
      }
    }
  }

  return units;
}

/** 导出成可直接复制的文本 */
export function renderL1(units) {
  return units
    .map(
      (u) =>
        `【${u.id}】\n${u.prompt}\n— 参数：duration=${u.durationSec}s，ratio=${u.ratio}（不写进提示词）\n`,
    )
    .join("\n");
}

/* ---------------- 4. 按集分批 ---------------- */

/** 按「第N集」切块；没有集标题就整本一批 */
export function splitEpisodes(text) {
  const lines = String(text || "").split(/\r?\n/);
  const eps = [];
  let cur = null;
  const preamble = [];
  for (const line of lines) {
    // 只认真正的集标题：「第11集：标题」，不认「第11集后半缺失：…」这种正文
    const heading = plainHeading(line);
    const m = heading.match(/^第\s*(\d+)\s*集(?:\s*[：:].*?)?\s*$/);
    if (m) {
      if (cur) eps.push(cur);
      cur = { no: Number(m[1]), lines: [line] };
    } else if (cur) {
      cur.lines.push(line);
    } else {
      preamble.push(line);
    }
  }
  if (cur) eps.push(cur);
  if (!eps.length) return [{ no: 1, text: String(text || "").trim() }];
  if (preamble.join("").trim()) eps[0].lines.unshift(...preamble);
  return eps.map((e) => ({ no: e.no, text: e.lines.join("\n").trim() }));
}
