import { parseScript } from "./split.js";
import { parseStoryboard } from "./storyboard.js";

const trim = (value) => String(value ?? "").trim();
const pad = (value) => String(value).padStart(2, "0");

function blockText(block) {
  if (block.kind === "dialogue") {
    return `${block.name}${block.tone ? `（${block.tone}）` : ""}：${block.content}`;
  }
  return trim(block.text);
}

function estimateDialogueSeconds(text, options = {}) {
  const cps = Number(options.cps) || 4.5;
  const wps = Number(options.wps) || 2.5;
  const pause = Number.isFinite(Number(options.pause)) ? Number(options.pause) : 0.4;
  const content = String(text || "");
  const cjk = (content.match(/[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/g) || []).length;
  const latin = content
    .replace(/[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
  return cjk / cps + latin / wps + pause;
}

/**
 * 把流程二产出的每个动作行/台词行视为一个“源拍”。
 * 字幕、音效、音乐标记不参与认领，因为正式交付本来就不输出它们。
 */
export function buildSourceBeats(sourceText) {
  const parsed = parseScript(String(sourceText || ""));
  const byEpisode = new Map();
  const all = [];

  for (const episode of parsed.episodes) {
    const beats = [];
    for (const scene of episode.scenes) {
      for (const block of scene.blocks) {
        if (block.kind === "marker") continue;
        const text = blockText(block);
        if (!text) continue;
        const beat = {
          no: beats.length + 1,
          episode: episode.no,
          scene: scene.key,
          kind: block.kind === "dialogue" ? "dialogue" : "action",
          text,
          dialogue: block.kind === "dialogue" ? block.content : "",
        };
        beats.push(beat);
        all.push(beat);
      }
    }
    byEpisode.set(episode.no, beats);
  }

  return { parsed, byEpisode, all };
}

/**
 * 给送进稳定链路的原文逐拍编号。
 * 编号只用于模型认领，不进入最终分镜交付物。
 */
export function numberStoryboardBeats(sourceText) {
  const parsedSource = String(sourceText || "");
  const { parsed, all } = buildSourceBeats(parsedSource);
  if (!all.length) return { text: parsedSource, beats: all, warnings: parsed.warnings };

  const out = [];
  let episodeNo = null;
  let beatIndex = 0;
  let numberedTotal = 0;
  for (const rawLine of parsedSource.split(/\r?\n/)) {
    const line = rawLine.trim();
    const plain = line.replace(/^#{1,6}\s+/, "").replace(/\*\*/g, "").trim();
    const episodeMatch = plain.match(/^第\s*(\d+)\s*集(?:\s*[：:].*)?$/);
    if (episodeMatch) {
      if (episodeNo !== null) out.push("");
      episodeNo = Number(episodeMatch[1]);
      beatIndex = 0;
      out.push(rawLine);
      continue;
    }
    if (
      !line ||
      /^\d+\s*-\s*\d+\s+/.test(plain) ||
      /^\d+\s*[.、]\s+/.test(plain) ||
      /^人物\s*[：:]/.test(plain) ||
      /^△\s*【(字幕|音效|音乐)】/.test(plain)
    ) {
      if (line) out.push(rawLine);
      continue;
    }
    if (episodeNo === null) continue;
    beatIndex += 1;
    numberedTotal += 1;
    out.push(`[拍${pad(beatIndex)}] ${line}`);
  }

  if (all.length !== numberedTotal) {
    throw new Error(`源拍编号不一致：${numberedTotal}/${all.length}`);
  }
  return {
    text: out.join("\n").replace(/\n{3,}/g, "\n\n").trim(),
    beats: all,
    warnings: parsed.warnings,
  };
}

/** `拍：1-3` / `拍：1–3` / `拍：1,2` → { start, end, nos } */
export function parseBeatRange(raw) {
  const value = trim(raw)
    .replace(/[–—~～至到]/g, "-")
    .replace(/\s+/g, "");
  if (!value) return null;

  if (/^\d+(?:-\d+)?$/.test(value)) {
    const [left, right = left] = value.split("-").map(Number);
    const start = Math.min(left, right);
    const end = Math.max(left, right);
    return {
      start,
      end,
      nos: Array.from({ length: end - start + 1 }, (_, index) => start + index),
    };
  }

  if (/^\d+(?:,\d+)+$/.test(value)) {
    const nos = value.split(",").map(Number);
    return { start: nos[0], end: nos.at(-1), nos };
  }
  return null;
}

const short = (text, size = 36) => {
  const value = trim(text).replace(/\s+/g, " ");
  return value.length > size ? `${value.slice(0, size)}…` : value;
};

/**
 * 校验每个源拍恰好被一个 shot 认领，顺序连续，且没有跨源行动作压缩。
 * 这是零模型闸门：只读 shot 表头的 `拍` 字段，不改稿。
 */
export function auditBeatClaims(outputText, sourceText, options = {}) {
  const requireClaims = options.requireClaims !== false;
  const maxBeatsPerShot = Number(options.maxBeatsPerShot) || 3;
  const maxActionBeatsPerShot = Number(options.maxActionBeatsPerShot) || 1;
  const dialogueTolerance = Number(options.dialogueTolerance) || 0.3;
  const { byEpisode } = buildSourceBeats(sourceText);
  const parsedOutput = parseStoryboard(outputText);
  const issues = [];
  const add = (level, where, rule, evidence) =>
    issues.push({ level, where, rule, evidence, source: "engine" });

  if (!requireClaims) {
    const hasAnyClaim = parsedOutput.episodes.some((episode) =>
      episode.shots.some((shot) => Boolean(shot.beatClaim)),
    );
    if (!hasAnyClaim) return issues;
  }

  for (const episode of parsedOutput.episodes) {
    const sourceBeats = byEpisode.get(episode.no) || [];
    if (!sourceBeats.length) continue;
    const beatMap = new Map(sourceBeats.map((beat) => [beat.no, beat]));
    const claimedCounts = new Map();
    let expected = 1;

    for (const shot of episode.shots) {
      const where = `第${episode.no}集 分镜${pad(shot.no)}`;
      const claim = shot.beatClaim;
      if (!claim) {
        add("高", where, "缺少源拍认领", "shot 表头必须写 `拍：起-止`");
        continue;
      }

      for (const no of claim.nos) {
        const beat = beatMap.get(no);
        if (!beat) {
          add("高", where, "源拍越界", `第${episode.no}集没有第 ${no} 拍`);
          continue;
        }
        claimedCounts.set(no, (claimedCounts.get(no) || 0) + 1);
      }

      if (claim.start !== expected) {
        const kind = claim.start < expected ? "源拍重复或倒序" : "源拍跳号";
        add(
          "高",
          where,
          kind,
          `本镜从第 ${claim.start} 拍开始，按顺序应从前一拍之后开始`,
        );
      }
      if (claim.nos.length > maxBeatsPerShot) {
        add(
          "高",
          where,
          "单镜认领过多",
          `认领 ${claim.nos.length} 拍，超过上限 ${maxBeatsPerShot}`,
        );
      }

      const claimedBeats = claim.nos.map((no) => beatMap.get(no)).filter(Boolean);
      const actionBeats = claimedBeats.filter((beat) => beat.kind === "action");
      if (actionBeats.length > maxActionBeatsPerShot) {
        add(
          "高",
          where,
          "跨源行动作合并",
          `本镜同时认领 ${actionBeats.length} 个动作源拍：${actionBeats
            .map((beat) => `拍${pad(beat.no)}「${short(beat.text)}」`)
            .join("、")}`,
        );
      }

      for (const beat of claimedBeats.filter((item) => item.kind === "dialogue")) {
        const need = estimateDialogueSeconds(beat.dialogue, options);
        if (Number(shot.duration) + dialogueTolerance < need) {
          add(
            "高",
            where,
            "台词语速超载",
            `拍${pad(beat.no)} 至少约 ${need.toFixed(1)}s，本镜只有 ${shot.duration}s`,
          );
        }
      }

      expected = claim.end + 1;
    }

    for (let no = 1; no <= sourceBeats.length; no += 1) {
      const count = claimedCounts.get(no) || 0;
      if (count === 0) {
        add(
          "高",
          `第${episode.no}集`,
          "源拍漏认领",
          `拍${pad(no)}「${short(beatMap.get(no)?.text)}」没有被任何 shot 认领`,
        );
      } else if (count > 1) {
        add(
          "高",
          `第${episode.no}集`,
          "源拍重复认领",
          `拍${pad(no)} 被 ${count} 个 shot 认领`,
        );
      }
    }
  }

  return issues;
}
