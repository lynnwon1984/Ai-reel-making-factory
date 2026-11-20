import { classifyDialogue } from "./qc-engine.js";
import { parseStoryboard } from "./storyboard.js";
import { flatten } from "./qc-engine.js";

const pad = (n) => String(n).padStart(2, "0");
const clipLetter = (n) => String.fromCharCode(65 + (n % 26));

export function mergeSplitShotHeads(text) {
  const lines = String(text || "").split(/\r?\n/);
  const out = [];
  let merged = 0;
  for (let i = 0; i < lines.length; i += 1) {
    const first = lines[i].match(/^(\s*)\[\s*shot(\d+)\s*\|\s*(.*?)\]\s*$/);
    const second = lines[i + 1]?.match(/^\s*\[\s*shot(\d+)\s*\|\s*(.*?)\]\s*$/);
    if (first && second && first[2] === second[1]) {
      const tail = second[2].replace(/^\s*\|/, "").trim();
      out.push(`${first[1]}[shot${first[2]} | ${first[3].replace(/\s*\|\s*$/, "")} | ${tail}]`);
      merged += 1;
      i += 1;
    } else {
      out.push(lines[i]);
    }
  }
  return { text: out.join("\n"), merged };
}

function editDistance(a, b) {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const old = prev[j];
      prev[j] = Math.min(
        prev[j] + 1,
        prev[j - 1] + 1,
        diagonal + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      diagonal = old;
    }
  }
  return prev[b.length];
}

function speakerKey(raw) {
  return String(raw || "")
    .replace(/[（(]\s*(O\.?S\.?|V\.?O\.?|画外音|内心独白)\s*[）)]/gi, "")
    .trim();
}

/** 模型偶尔会把原文拼写“纠正”成另一个词；按同角色、极小编辑距离回填原文。 */
export function restoreSourceDialogue(text, sourceText) {
  const source = String(sourceText || "")
    .split(/\r?\n/)
    .map((line) => {
      const m = line
        .trim()
        .replace(/\*\*/g, "")
        .match(/^(.{1,24}?)(?:（[^）]*）)?\s*[：:]\s*(.+)$/);
      if (!m || line.trim().startsWith("△")) return null;
      return { speaker: speakerKey(m[1]), quote: m[2].trim() };
    })
    .filter(Boolean);

  let restored = 0;
  let previous = null;
  const rawLines = String(text || "").split(/\r?\n/);
  const lines = rawLines.map((line, index) => {
    const m = line.match(/^(\s*EN:\s*)(.+?)\s*:\s*["“](.*)["”]\s*$/);
    if (!m) {
      if (line.trim() && !line.startsWith("CAMERA:")) previous = null;
      return line;
    }
    const [, prefix, rawSpeaker, quote] = m;
    const key = speakerKey(rawSpeaker);
    const candidates = source.filter((one) => one.speaker === key && one.quote !== quote);
    let best = null;
    let bestDistance = Infinity;
    for (const one of candidates) {
      if (Math.abs(one.quote.length - quote.length) > 2) continue;
      const distance = editDistance(one.quote, quote);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = one;
      }
    }
    if (best && bestDistance <= 1) {
      restored += 1;
      previous = { speaker: key, quote: best.quote };
      return `${prefix}${rawSpeaker}: "${best.quote}"`;
    }

    // 模型偶尔漏掉长台词开头的一句，但保留后半段。上一句不是同一原文的
    // 前半段时，才回填完整原句，避免把模型的正常拆句又拼回去。
    const longer = source.find(
      (one) =>
        one.speaker === key &&
        one.quote !== quote &&
        one.quote.includes(quote) &&
        one.quote.length - quote.length <= 120,
    );
    const nextEn = rawLines
      .slice(index + 1)
      .map((one) => one.match(/^\s*EN:\s*(.+?)\s*:\s*["“](.*)["”]\s*$/))
      .find(Boolean);
    const hasContinuation = Boolean(nextEn && speakerKey(nextEn[1]) === key);
    if (
      longer &&
      !hasContinuation &&
      !(previous?.speaker === key && longer.quote.startsWith(previous.quote))
    ) {
      restored += 1;
      previous = { speaker: key, quote: longer.quote };
      return `${prefix}${rawSpeaker}: "${longer.quote}"`;
    }
    previous = { speaker: key, quote };
    return line;
  });
  return { text: lines.join("\n"), restored };
}

export function dedupeRepeatedDialogue(text) {
  const out = [];
  let last = "";
  let deduped = 0;
  for (const line of String(text || "").split(/\r?\n/)) {
    const plain = line.replace(/^#{1,6}\s+/, "").replace(/\*\*/g, "").trim();
    if (/^【分镜\s*\d+\s*】/.test(plain) || /^第\s*\d+\s*集/.test(plain)) last = "";
    const m = line.match(/^\s*EN:\s*(.+?)\s*:\s*["“](.*)["”]\s*$/);
    if (!m) {
      out.push(line);
      continue;
    }
    const key = `${speakerKey(m[1])}\u0000${m[2].trim()}`;
    if (key === last) {
      deduped += 1;
      continue;
    }
    last = key;
    out.push(line);
  }
  return { text: out.join("\n"), deduped };
}

/** 删除模型自行补出的“无台词/沉默”伪 EN 行；它们不是剧本源台词。 */
export function removePseudoDialogue(text) {
  let removed = 0;
  const out = [];
  for (const line of String(text || "").split(/\r?\n/)) {
    const match = line.match(/^\s*EN:\s*(.*)$/);
    const raw = match?.[1]
      ?.replace(/^.+?\s*:\s*/, "")
      .replace(/^["“「]|["”」]$/g, "");
    const content = raw
      ?.replace(/[（）()\s。.!！]/g, "")
      .toLowerCase();
    if (
      content &&
      /^(?:无台词|没有台词|沉默|静默|无对白|nodia|nodialogue|silent|silence)$/.test(
        content,
      )
    ) {
      removed += 1;
      continue;
    }
    out.push(line);
  }
  return { text: out.join("\n"), removed };
}

function cleanShotBlock(lines) {
  const clipStarts = [];
  lines.forEach((line, index) => {
    if (/^\s*Clip\s+[A-Z]\s*\|/.test(line)) clipStarts.push(index);
  });
  if (!clipStarts.length) {
    return { lines, deduped: 0, relabeled: 0, bumped: 0, durationFixed: 0 };
  }

  const pre = lines.slice(0, clipStarts[0]);
  const clips = clipStarts.map((start, i) => ({
    start,
    lines: lines.slice(start, i + 1 < clipStarts.length ? clipStarts[i + 1] : lines.length),
  }));

  let deduped = 0;
  const kept = [];
  for (const clip of clips) {
    const key = clip.lines
      .join("\n")
      .replace(/^(\s*)Clip\s+[A-Z]/, "$1Clip X")
      .trim();
    const prevKey = kept.length
      ? kept[kept.length - 1].lines
          .join("\n")
          .replace(/^(\s*)Clip\s+[A-Z]/, "$1Clip X")
          .trim()
      : "";
    if (key === prevKey) {
      deduped += 1;
      continue;
    }
    kept.push(clip);
  }

  let relabeled = 0;
  let bumped = 0;
  const normalizedClips = kept.map((clip, i) => {
    const letter = clipLetter(i);
    return clip.lines.map((line, j) => {
      if (j !== 0) return line;
      let next = line.replace(/^(\s*)Clip\s+[A-Z]/, `$1Clip ${letter}`);
      if (next !== line) relabeled += 1;
      next = next.replace(/时长\s*[：:]\s*(\d+)\s*秒/, (m, n) => {
        if (Number(n) >= 4) return m;
        bumped += 1;
        return "时长：4秒";
      });
      return next;
    });
  });

  if (normalizedClips.length === 1) {
    const only = normalizedClips[0];
    const m = only[0]?.match(/时长\s*[：:]\s*(\d+)\s*秒/);
    if (m && Number(m[1]) < 5) {
      only[0] = only[0].replace(/时长\s*[：:]\s*\d+\s*秒/, "时长：5秒");
      bumped += 1;
    }
  }

  const total = normalizedClips.reduce((sum, clip) => {
    const m = clip[0].match(/时长\s*[：:]\s*(\d+)\s*秒/);
    return sum + (m ? Number(m[1]) : 0);
  }, 0);
  let durationFixed = 0;
  const head = pre.map((line) => {
    if (!/^\s*\[\s*shot\s*\d+\s*\|/.test(line) || !total) return line;
    const next = line.replace(/时长\s*[：:]\s*\d+\s*秒/, `时长：${total}秒`);
    if (next !== line) durationFixed += 1;
    return next;
  });

  return {
    lines: [...head, ...normalizedClips.flat()],
    deduped,
    relabeled,
    bumped,
    durationFixed,
  };
}

/** 连续完全重复的 Clip 去重，重排 A/B/C，并按 Clip 总和校正 shot 时长。 */
export function cleanDuplicateClips(text) {
  const lines = String(text || "").split(/\r?\n/);
  const out = [];
  let deduped = 0;
  let relabeled = 0;
  let bumped = 0;
  let durationFixed = 0;

  for (let i = 0; i < lines.length; ) {
    if (!/^\s*【分镜\s*\d+\s*】/.test(lines[i])) {
      out.push(lines[i]);
      i += 1;
      continue;
    }

    out.push(lines[i]);
    i += 1;
    let end = i;
    while (end < lines.length) {
      const plain = lines[end].replace(/^#{1,6}\s+/, "").replace(/\*\*/g, "").trim();
      if (/^【分镜\s*\d+\s*】/.test(plain) || /^第\s*\d+\s*集/.test(plain)) break;
      end += 1;
    }

    const cleaned = cleanShotBlock(lines.slice(i, end));
    out.push(...cleaned.lines);
    deduped += cleaned.deduped;
    relabeled += cleaned.relabeled;
    bumped += cleaned.bumped;
    durationFixed += cleaned.durationFixed;
    i = end;
  }

  return { text: out.join("\n"), deduped, relabeled, bumped, durationFixed };
}

function alignKnownCastAliases(text, sourceText) {
  if (!/随从A/.test(sourceText) || !/随从B/.test(sourceText)) {
    return { text, aliased: 0 };
  }
  let aliased = 0;
  const next = String(text || "")
    .replace(/侍卫A（Guard A，着装：黑色皮革盔甲）/g, () => {
      aliased += 1;
      return "随从A（Entourage A，着装：黑色随从服）";
    })
    .replace(/侍卫B（Guard B，着装：黑色皮革盔甲）/g, () => {
      aliased += 1;
      return "随从B（Entourage B，着装：黑色随从服）";
    })
    .replace(/侍卫A/g, () => {
      aliased += 1;
      return "随从A";
    })
    .replace(/侍卫B/g, () => {
      aliased += 1;
      return "随从B";
    });
  return { text: next, aliased };
}

/**
 * 每集 shot 编号重排：把 【分镜N】 与 [shotN 按出现顺序改成 01、02…
 * 只动编号，不动任何内容。返回 { text, changed }。
 */
export function renumberShots(text) {
  let changed = 0;
  const out = [];
  let counter = 0;
  for (const raw of String(text || "").split(/\r?\n/)) {
    const line = raw;
    const heading = line
      .replace(/^#{1,6}\s+/, "")
      .replace(/\*\*/g, "")
      .trim();
    if (/^第\s*\d+\s*集(?![^\s：:])/.test(heading)) counter = 0;
    let next = line;
    if (/^\s*(?:\*\*)?【分镜\s*\d+\s*】/.test(line)) {
      counter += 1;
      const want = pad(counter);
      next = line.replace(/【分镜\s*(\d+)\s*】/, (m, n) => (n === want ? m : `【分镜${want}】`));
    } else if (/^\s*\[\s*shot\s*\d+/.test(line)) {
      // shot 行紧随其后的【分镜】已计数；这里只对齐同一序号
      const want = pad(counter || 1);
      next = line.replace(/\[\s*shot\s*(\d+)/, (m, n) => (n === want ? m : `[shot${want}`));
    }
    if (next !== line) changed += 1;
    out.push(next);
  }
  return { text: out.join("\n"), changed };
}

/**
 * 把「多句原文拼成一条 EN 行」拆回多条。
 * 只按原文句子边界切，不改字。返回 { text, changed }。
 */
export function splitMergedEn(text, sourceText) {
  const srcList = [];
  for (const raw of String(sourceText || "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("△")) continue;
    const m = line.match(/^\*{0,2}([^：:*\n]{1,24})\*{0,2}\s*(?:（[^）]*）)?\s*[：:]\s*(.+)$/);
    if (!m) continue;
    const key = flatten(m[2].replace(/^["“「]|["”」]$/g, "").trim());
    if (key) srcList.push(key);
  }

  let changed = 0;
  const out = [];
  for (const line of String(text || "").split(/\r?\n/)) {
    const m = line.match(/^(\s*EN:\s*)(.+?)(（[^）]*）)?\s*:\s*["“](.+)["”]\s*$/);
    if (!m) {
      out.push(line);
      continue;
    }
    const [, prefix, speaker, mode, quote] = m;
    if (classifyDialogue(quote, srcList) !== "merged") {
      out.push(line);
      continue;
    }
    // 按原文句子长度贪心切
    let rest = quote;
    const chunks = [];
    while (rest) {
      const flatRest = flatten(rest);
      let bestLen = 0;
      for (const s of srcList) {
        if (s.length > bestLen && flatRest.startsWith(s)) bestLen = s.length;
      }
      if (!bestLen) break;
      // 按扁平长度回推原文位置：逐字累积计数
      let acc = 0;
      let cut = rest.length;
      for (let i = 0; i < rest.length; i += 1) {
        if (/[\p{L}\p{N}]/u.test(rest[i])) acc += 1;
        if (acc >= bestLen) {
          cut = i + 1;
          // 把紧跟的标点/空格带上，避免「Run」和「! Thank you」被切开
          while (cut < rest.length && !/[\p{L}\p{N}]/u.test(rest[cut])) cut += 1;
          break;
        }
      }
      chunks.push(rest.slice(0, cut).trim());
      rest = rest.slice(cut).trim();
    }
    if (chunks.length < 2) {
      out.push(line);
      continue;
    }
    changed += 1;
    for (const c of chunks) out.push(`${prefix}${speaker}${mode || ""}: "${c}"`);
  }
  return { text: out.join("\n"), changed };
}

/** 一次跑完两项规范化 */
export function normalizeStoryboard(text, sourceText) {
  const aliases = alignKnownCastAliases(text, sourceText);
  const heads = mergeSplitShotHeads(aliases.text);
  const clips = cleanDuplicateClips(heads.text);
  const a = renumberShots(clips.text);
  const pseudo = removePseudoDialogue(a.text);
  const b = splitMergedEn(pseudo.text, sourceText);
  const restored = restoreSourceDialogue(b.text, sourceText);
  const dialogue = dedupeRepeatedDialogue(restored.text);
  return {
    text: dialogue.text,
    renumbered: a.changed,
    split: b.changed,
    deduped: clips.deduped,
    relabeled: clips.relabeled,
    bumped: clips.bumped,
    durationFixed: clips.durationFixed,
    aliased: aliases.aliased,
    headsMerged: heads.merged,
    pseudoDialogueRemoved: pseudo.removed,
    dialogueRestored: restored.restored,
    dialogueDeduped: dialogue.deduped,
  };
}

/** 给界面用：规范化前后的问题是否真的变少 */
export function countIssues(sourceText, text) {
  const parsed = parseStoryboard(text);
  let shots = 0;
  for (const ep of parsed.episodes) shots += ep.shots.length;
  return { episodes: parsed.episodes.length, shots };
}
