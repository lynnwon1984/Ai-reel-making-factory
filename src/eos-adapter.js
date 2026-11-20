/**
 * EOS AI 分镜导入适配器。
 *
 * 本地稿保留完整机读结构（shot → Clip），EOS AI 的生产单位则是一条
 * “分镜”记录：每条记录承载一个 5–15 秒 shot，并用 A/B/C 描述内部 Clip。
 * 这里只做确定性转换，不调用模型，也不改变剧情、台词和时长。
 */

import { splitCamera } from "./storyboard.js";

const trim = (value) => String(value ?? "").trim();
const cleanCharacter = (name) =>
  trim(name)
    .replace(/^[A-Za-z]{0,3}\d+\s*-\s*/, "")
    .trim();

function beatFor(index, total) {
  if (total <= 1) return "收束";
  if (index === 0) return "建立";
  if (index === total - 1) return "收束";
  if (index === 1 && total >= 4) return "推进";
  return "强调";
}

function splitScene(scene) {
  const raw = trim(scene);
  const match = raw.match(/^(.*?)\s+(内|外)\s+(.+)$/);
  if (!match) return { place: raw || "未注明场景", side: "", time: "", detail: "" };
  return {
    place: match[1].trim() || "未注明场景",
    side: match[2],
    time: match[3].trim(),
    detail: "",
  };
}

function castText(shot) {
  if (!shot.cast?.length) return "—";
  return shot.cast
    .map(({ name, dress }) => {
      const short = cleanCharacter(name);
      return short ? `${short}（${trim(dress) || "正常"}）` : "";
    })
    .filter(Boolean)
    .join("、");
}

function dialogueText(dialogue) {
  if (!dialogue?.length) return [];
  return dialogue.map((item) => {
    const speaker = cleanCharacter(item.speaker) || "画外音";
    const mode = trim(item.mode);
    const suffix = mode ? `·${mode}` : "";
    return `　台词 {${trim(item.text)}}｜${speaker}${suffix}`;
  });
}

function renderClip(shot, clip, index) {
  const camera = splitCamera(clip.camera);
  const size = trim(clip.size) || camera.size || "MS";
  const beat = beatFor(index, shot.clips.length);
  const movement = trim(camera.move);
  const description = trim(camera.desc) || "（待补画面描述）";
  const cameraText = movement ? `${movement}。${description}` : description;

  return [
    `${clip.letter} ${Number(clip.duration) || 0}s ${size} ${beat}｜${cameraText}`,
    ...dialogueText(clip.dialogue),
  ];
}

function renderShot(shot) {
  const scene = splitScene(shot.scene);
  const beats = shot.clips.map((_, index) => beatFor(index, shot.clips.length));
  const anchor = trim(shot.position) || scene.detail || "保持本场人物位置、视线与轴线连续";
  const props = /^(无|—|-)$/.test(trim(shot.props)) ? "—" : trim(shot.props) || "—";
  const lines = [
    `【分镜${Number(shot.no) || 0}】${Number(shot.duration) || 0}s ｜ ${beats.join("→")}`,
    `${scene.place}｜${scene.side || "未注明"}｜${scene.time || "未注明"}｜${anchor}`,
    `人物 ${castText(shot)}｜道具 ${props}｜锚点 ${anchor}`,
  ];

  for (let i = 0; i < shot.clips.length; i += 1) {
    lines.push(...renderClip(shot, shot.clips[i], i));
  }
  return lines.join("\n");
}

/** 把解析后的本地分镜结构渲染为 EOS AI 可导入的逐 shot 文本。 */
export function renderEOSAdapter(parsed) {
  const episodes = Array.isArray(parsed?.episodes) ? parsed.episodes : [];
  return episodes
    .map((ep) => {
      const title = trim(ep.title) ? `：${trim(ep.title)}` : "";
      return [`第${ep.no}集${title}`, ...ep.shots.map(renderShot)].join("\n\n");
    })
    .join("\n\n");
}

/**
 * 给 EOS 直连导入器使用的无损计划。
 *
 * EOS 页面的“导入剧本 → 继续批量分镜”会再次经过模型分镜，可能合并或拆分
 * shot。直连导入器应先创建剧集，再按本计划的 storyboards 一次写入记录。
 * 这里保留平台需要的逐 shot sourceText、时长和顺序。
 */
export function buildEOSImportPlan(parsed) {
  const episodes = Array.isArray(parsed?.episodes) ? parsed.episodes : [];
  return {
    version: 1,
    source: "ai-storyboard-forge",
    episodes: episodes.map((ep) => {
      const script = renderEOSAdapter({ episodes: [ep] });
      const blocks = script.split(/\n\n(?=【分镜)/).slice(1);
      const title = trim(ep.title) ? `：${trim(ep.title)}` : "";
      return {
        name: `第${ep.no}集${title}`,
        script,
        storyboards: (ep.shots || []).map((shot, index) => ({
          order: index,
          duration: Number(shot.duration) || 0,
          recommendedDuration: Number(shot.duration) || 0,
          sourceText: blocks[index] || "",
          text: "",
        })),
      };
    }),
  };
}

export function renderEOSImportPlan(parsed) {
  return JSON.stringify(buildEOSImportPlan(parsed), null, 2);
}

export function eosAdapterStats(parsed) {
  const episodes = Array.isArray(parsed?.episodes) ? parsed.episodes : [];
  return {
    episodes: episodes.length,
    shots: episodes.reduce((sum, ep) => sum + (ep.shots?.length || 0), 0),
    clips: episodes.reduce(
      (sum, ep) =>
        sum + (ep.shots || []).reduce((shotSum, shot) => shotSum + (shot.clips?.length || 0), 0),
      0,
    ),
  };
}
