import { parseStoryboard } from "./storyboard.js";

/**
 * 确定性质检引擎：能算出来的都算出来，不调模型、可复现。
 * 判不了的（关系、结局、节奏）留给上层，不在这里猜。
 */

/** 去掉标点、空白、引号，统一小写，用于包含性比对 */
export function flatten(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

const pad = (n) => String(n).padStart(2, "0");

const MOTION =
  /(走|跑|推|拉|抬|放|抓|扔|转|坐|站|跪|倒|冲|挥|举|按|打|踢|拿|递|接|点|开|关|爬|跃|跳|扑|抱|扯|撕|翻|蹲|退|进|出|入)/;

/** 从原剧本里抽出所有台词（去掉引号、统一扁平化） */
function sourceDialogues(src) {
  const out = [];
  for (const raw of String(src || "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("△")) continue;
    const m = line.match(/^\*{0,2}([^：:*\n]{1,24})\*{0,2}\s*(?:（[^）]*）)?\s*[：:]\s*(.+)$/);
    if (!m) continue;
    const text = m[2].replace(/^["“「]|["”」]$/g, "").trim();
    const key = flatten(text);
    if (key) out.push(key);
  }
  return out;
}

/**
 * 判断一句产出台词和原文的关系：
 * exact  = 原文里能找到（或被原文某句包含）
 * merged = 由多句原文拼接而成
 * changed = 找不到
 */
export function classifyDialogue(text, srcList) {
  const key = flatten(text);
  if (!key) return "exact";
  if (srcList.some((s) => s.includes(key))) return "exact";

  let rest = key;
  let parts = 0;
  while (rest) {
    let best = "";
    for (const s of srcList) {
      if (s.length > best.length && rest.startsWith(s)) best = s;
    }
    if (!best) return "changed";
    rest = rest.slice(best.length);
    parts += 1;
  }
  return parts > 1 ? "merged" : "exact";
}

/** 相邻 Clip 的机位描述相似度（字符二元组 Jaccard） */
function similarity(a, b) {
  const grams = (s) => {
    const t = flatten(s);
    const out = new Set();
    for (let i = 0; i < t.length - 1; i += 1) out.add(t.slice(i, i + 2));
    return out;
  };
  const A = grams(a);
  const B = grams(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const g of A) if (B.has(g)) inter += 1;
  return inter / (A.size + B.size - inter);
}

export function runEngineQc(sourceText, outputText) {
  const issues = [];
  const flatSrc = flatten(sourceText);
  const srcList = sourceDialogues(sourceText);
  const parsed = parseStoryboard(outputText);
  if (!flatSrc || !parsed.episodes.length) return issues;

  const add = (level, where, rule, evidence) =>
    issues.push({ level, where, rule, evidence, source: "engine" });

  for (const ep of parsed.episodes) {
    for (const shot of ep.shots) {
      const where = `第${ep.no}集 分镜${pad(shot.no)}`;

      // 1) 台词：产出里的每一句都得在原文里找得到
      for (const clip of shot.clips) {
        for (const d of clip.dialogue) {
          const kind = classifyDialogue(d.text, srcList);
          if (kind === "changed") {
            add(
              "高",
              `${where} Clip${clip.letter}`,
              "台词篡改",
              `产出「${d.text}」在原文中找不到`,
            );
          } else if (kind === "merged") {
            add(
              "中",
              `${where} Clip${clip.letter}`,
              "台词合并",
              `产出「${d.text}」由多句原文拼成，应拆回多条 EN 行`,
            );
          }
        }
      }

      // 2) 人物：产出里出现的人，原文提都没提过
      // 「酒客群像」原文写「酒客」属于同一批人，尾部子串命中就算已知
      for (const c of shot.cast) {
        const key = flatten(c.name);
        if (!key) continue;
        const known =
          flatSrc.includes(key) ||
          Array.from({ length: Math.max(0, key.length - 1) }, (_, i) => key.slice(i + 1)).some(
            (suffix) => suffix.length >= 2 && flatSrc.includes(suffix),
          );
        if (!known) {
          add("高", where, "新增人物", `「${c.name}」原文中未出现`);
        }
      }

      // 3) 道具：同理，但只算中危
      for (const raw of String(shot.props || "").split(/[、,，]/)) {
        const name = raw.trim();
        if (!name || /^(无|—|-)$/.test(name)) continue;
        // 「咬过一口的苹果」→ 苹果；「一扎啤酒」→ 啤酒
        const head = name
          .split("的")
          .pop()
          .replace(/^[0-9一二三四五六七八九十百千]+[个只把杯扎瓶盒张份条根块串]?/, "");
        const key = flatten(head) || flatten(name);
        // 中文里「烤肉串 / 一串烤肉」「粥碗 / 一碗热粥」只是换了个说法。
        // 只要道具名里有字在原文出现过，就不算凭空新增（宁可漏报，不要误报）。
        const known = key.length < 2 || [...key].some((ch) => flatSrc.includes(ch));
        if (!known) {
          add("中", where, "新增道具", `「${name}」原文中未出现`);
        }
      }

      // 4) 重复镜头：相邻 Clip 机位/动作描述高度相似
      for (let i = 1; i < shot.clips.length; i += 1) {
        const prev = shot.clips[i - 1];
        const cur = shot.clips[i];
        const s = similarity(prev.camera, cur.camera);
        if (s >= 0.75) {
          add(
            "中",
            `${where} Clip${cur.letter}`,
            "重复镜头",
            `与 Clip${prev.letter} 描述相似度 ${(s * 100).toFixed(0)}%`,
          );
        }
      }

      // 5) 空镜：无台词、无动作、描述又极短
      for (const clip of shot.clips) {
        const cam = String(clip.camera || "");
        if (!clip.dialogue.length && cam.length < 18 && !MOTION.test(cam)) {
          add("中", `${where} Clip${clip.letter}`, "空镜", `无台词、无动作：${cam || "（空）"}`);
        }
      }
    }
  }

  return issues;
}
