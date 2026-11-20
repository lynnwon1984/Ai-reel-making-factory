import { splitEpisodes } from "./storyboard.js";

const encoder = new TextEncoder();

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(value) {
  return Uint8Array.of(value & 0xff, (value >>> 8) & 0xff);
}

function u32(value) {
  return Uint8Array.of(
    value & 0xff,
    (value >>> 8) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 24) & 0xff,
  );
}

function concat(parts) {
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function dosDateTime(value) {
  const date = value instanceof Date && !Number.isNaN(value.getTime()) ? value : new Date();
  const year = Math.max(1980, date.getFullYear());
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

/** 生成不压缩的 ZIP；文件名使用 UTF-8 标志，避免中文在解压工具里乱码。 */
export function buildZip(files, generatedAt = new Date()) {
  const stamp = dosDateTime(generatedAt);
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const file of files) {
    const name = encoder.encode(file.path);
    const data = encoder.encode(String(file.content ?? ""));
    const checksum = crc32(data);
    const local = concat([
      u32(0x04034b50),
      u16(20),
      u16(0x0800),
      u16(0),
      u16(stamp.time),
      u16(stamp.date),
      u32(checksum),
      u32(data.length),
      u32(data.length),
      u16(name.length),
      u16(0),
      name,
      data,
    ]);
    localParts.push(local);

    centralParts.push(
      concat([
        u32(0x02014b50),
        u16(0x0314),
        u16(20),
        u16(0x0800),
        u16(0),
        u16(stamp.time),
        u16(stamp.date),
        u32(checksum),
        u32(data.length),
        u32(data.length),
        u16(name.length),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(0),
        u32(offset),
        name,
      ]),
    );
    offset += local.length;
  }

  const central = concat(centralParts);
  const end = concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(files.length),
    u16(files.length),
    u32(central.length),
    u32(offset),
    u16(0),
  ]);
  return concat([...localParts, central, end]);
}

function safeName(value, fallback = "未命名项目") {
  return (
    String(value ?? "")
      .trim()
      .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-")
      .replace(/\s+/g, " ")
      .replace(/[. ]+$/g, "")
      .slice(0, 90) || fallback
  );
}

function formatDuration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return hours
    ? `${hours}小时${minutes}分${secs}秒`
    : minutes
      ? `${minutes}分${secs}秒`
      : `${secs}秒`;
}

function episodeName(ep) {
  return `第${ep.no}集${ep.title ? `：${ep.title}` : ""}`;
}

function episodeFileName(ep) {
  return `${String(ep.no).padStart(3, "0")}集${ep.title ? `-${safeName(ep.title)}` : ""}.md`;
}

function buildReadme(name, parsed, totals, generatedAt) {
  return `《${name}》分镜头剧本交付包

生成时间：${generatedAt.toLocaleString("zh-CN", { hour12: false })}
总集数：${totals.episodes}
总 shot：${totals.shots}
总 Clip：${totals.clips}
分镜总时长：${formatDuration(totals.duration)}

文件说明
1. 完整分镜.md：完整交付稿，供审阅、留档和版本对比。
2. 分集分镜/：一集一个 Markdown 文件，便于按集审阅。
3. manifest.json：本次交付包的机器可读摘要。

使用提醒
- 本产品只求交付分镜头剧本，不包含任何制作平台接口、资产绑定、图片、视频或音频素材。
- 角色、场景和道具资产由后续制作人员自行处理。
`;
}

export function buildDeliveryPackage({
  parsed,
  projectName = "短剧项目",
  fullMarkdown = "",
  generatedAt = new Date(),
}) {
  const name = safeName(projectName);
  const episodes = Array.isArray(parsed?.episodes) ? parsed.episodes : [];
  const totals = {
    episodes: episodes.length,
    shots: episodes.reduce((sum, ep) => sum + (ep.shots?.length || 0), 0),
    clips: episodes.reduce(
      (sum, ep) => sum + (ep.shots || []).reduce((shotSum, shot) => shotSum + (shot.clips?.length || 0), 0),
      0,
    ),
    duration: episodes.reduce(
      (sum, ep) => sum + (ep.shots || []).reduce((shotSum, shot) => shotSum + (Number(shot.duration) || 0), 0),
      0,
    ),
  };
  const episodeTexts = new Map(
    splitEpisodes(fullMarkdown).map((episode) => [episode.no, episode.text]),
  );
  const episodeFiles = episodes.map((ep) => ({
    path: `${name}-分集分镜/${episodeFileName(ep)}`,
    content:
      episodeTexts.get(ep.no) ||
      `第${ep.no}集${ep.title ? `：${ep.title}` : ""}\n`,
    mime: "text/markdown;charset=utf-8",
  }));
  const files = [
    { path: `${name}-完整分镜.md`, content: fullMarkdown, mime: "text/markdown;charset=utf-8" },
    ...episodeFiles,
    { path: "交付说明.txt", content: buildReadme(name, parsed, totals, generatedAt), mime: "text/plain;charset=utf-8" },
    {
      path: "manifest.json",
      content: JSON.stringify(
        {
          format: "ai-storyboard-script-delivery",
          version: 2,
          projectName: name,
          generatedAt: generatedAt.toISOString(),
          episodes: episodes.map((ep) => ({
            no: ep.no,
            name: episodeName(ep),
            shots: ep.shots?.length || 0,
            clips: (ep.shots || []).reduce((sum, shot) => sum + (shot.clips?.length || 0), 0),
            duration: (ep.shots || []).reduce((sum, shot) => sum + (Number(shot.duration) || 0), 0),
          })),
          totals,
        },
        null,
        2,
      ),
      mime: "application/json;charset=utf-8",
    },
  ];
  return {
    fileName: `${name}-交付包.zip`,
    files,
    totals,
    zip: buildZip(files, generatedAt),
  };
}

