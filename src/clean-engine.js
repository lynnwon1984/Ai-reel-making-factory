import { parseScript } from "./split.js";
import { cleanActionCostume } from "./costume-cleanup.js";
import { parseCastLine, splitSpeaker } from "./storyboard.js";

const strip = (value) =>
  String(value ?? "")
    .replace(/\*\*/g, "")
    .trim();

const RE_EP = /^第\s*(\d+)\s*集(?:[：:]\s*(.*))?$/;
const RE_SCENE = /^(\d+)\s*-\s*(\d+)\s+(.+)$/;
const RE_ACTION = /^△/;
const RE_DIALOGUE =
  /^\*{0,2}([^：:*\n]{1,30})\*{0,2}\s*(?:（([^）]*)）)?\s*[：:]\s*(.+)$/;
const AMBIGUOUS_SUBJECT = /^△(?:一只手|一只脚|一个身影|一道人影|有人|某人)/;
const GROUP_ROLE =
  /(?:群像|观众|士兵|侍卫|宾客|人群|村民|仆人|随从|骑兵|守卫|路人)/;
const COSTUME_WORD =
  /(盔甲|礼服|婚纱|长裙|睡袍|睡裙|衬衫|马甲|皮靴|靴子|白鞋|法袍|制服|披风|斗篷|便装|工装|装束|衣袍|长袍|裙|鞋|靴|帽|领带|手套|围巾|衣裳|服饰)/;
const PROP_HEAD = /(杯|瓶|剑|刀|枪|钥匙|信封|文件|手机|药|杖|戒指|卷轴|盒|包|行李|托盘)/;

const CATEGORY_TITLES = [
  "拟合并场次清单",
  "拟删除音效/字幕标记及余字幕清单",
  "拟删除着装描述清单",
  "拟修改人物名单",
  "拟合并群像清单",
  "拟删除重复内容、空无效场清单",
  "拟重排集数清单",
  "拟统一道具名称清单",
  "拟明确动作主语清单",
  "拟补充/拟定着装清单",
  "其他需用户决策项",
];

function lineRows(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((raw, index) => ({ raw, line: strip(raw), index: index + 1 }))
    .filter((row) => row.line);
}

function sceneRows(text) {
  return lineRows(text).filter((row) => RE_SCENE.test(row.line));
}

function episodeRows(text) {
  return lineRows(text)
    .map((row) => {
      const hit = RE_EP.exec(row.line);
      return hit ? { ...row, no: Number(hit[1]), title: hit[2] || "" } : null;
    })
    .filter(Boolean);
}

function castRows(text) {
  return lineRows(text)
    .filter((row) => /^人物\s*[：:]/.test(row.line))
    .map((row) => ({
      ...row,
      items: parseCastLine(row.line),
    }));
}

function dialogueSpeakers(text) {
  const speakers = new Set();
  for (const row of lineRows(text)) {
    if (RE_ACTION.test(row.line)) continue;
    const hit = RE_DIALOGUE.exec(row.line);
    if (!hit) continue;
    const name = splitSpeaker(hit[1]).name.replace(/（[^）]*）\s*$/, "").trim();
    if (name) speakers.add(name);
  }
  return [...speakers];
}

function pendingSceneMerges(text) {
  const rows = sceneRows(text);
  const out = [];
  for (let i = 1; i < rows.length; i += 1) {
    const prev = RE_SCENE.exec(rows[i - 1].line);
    const next = RE_SCENE.exec(rows[i].line);
    if (!prev || !next) continue;
    const prevPlace = prev[3].replace(/\s+/g, " ").trim();
    const nextPlace = next[3].replace(/\s+/g, " ").trim();
    if (prev[1] !== next[1] || prevPlace !== nextPlace) continue;
    out.push(
      `第${rows[i - 1].index}行 ${prev[1]}-${prev[2]} 与第${rows[i].index}行 ${next[1]}-${next[2]} 场次同名，候选合并，需确认是否同一时空。`,
    );
  }
  return out;
}

function numberingIssues(text) {
  const issues = [];
  const eps = episodeRows(text);
  const expectedEps = eps.map((_, index) => index + 1);
  const badEps = eps.filter((row, index) => row.no !== expectedEps[index]);
  if (badEps.length) {
    issues.push(
      `集号需按出现顺序重排：${badEps.map((row) => `第${row.no}集→第${expectedEps[eps.indexOf(row)]}集`).join("；")}。`,
    );
  }

  const scenes = sceneRows(text);
  const perEpisode = new Map();
  const mismatches = [];
  for (const row of scenes) {
    const hit = RE_SCENE.exec(row.line);
    const ep = Number(hit[1]);
    const no = Number(hit[2]);
    const expected = (perEpisode.get(ep) || 0) + 1;
    perEpisode.set(ep, expected);
    if (no !== expected) issues.push(`${ep}-${no} 场号不连续，按顺序应为 ${ep}-${expected}。`);

    const owner = [...eps].reverse().find((item) => item.index < row.index);
    if (owner && owner.no !== ep) mismatches.push(`${ep}-${no} 位于第${owner.no}集内。`);
  }
  issues.push(...mismatches);
  return issues;
}

function duplicateAndEmptyIssues(text) {
  const parsed = parseScript(text);
  const duplicates = [];
  const empty = [];
  const seen = new Set();

  for (const episode of parsed.episodes) {
    for (const scene of episode.scenes) {
      const meaningful = scene.body.filter((line) => strip(line));
      if (!meaningful.length) empty.push(scene.key);
      for (const raw of meaningful) {
        const line = strip(raw);
        const dialogue = RE_DIALOGUE.exec(line);
        const speaker = dialogue
          ? splitSpeaker(dialogue[1]).name.replace(/（[^）]*）\s*$/, "").trim()
          : "";
        const key = dialogue
          ? `D:${speaker}:${dialogue[3]
              .replace(/[，。；：:\s]/g, "")
              .toLowerCase()}`
          : `A:${line.replace(/^△/, "").replace(/[，。；：:\s]/g, "")}`;
        if (!key) continue;
        if (seen.has(key)) duplicates.push(strip(raw).slice(0, 80));
        seen.add(key);
      }
    }
  }
  return {
    duplicates: [...new Set(duplicates)],
    empty: [...new Set(empty)],
  };
}

function costumeIssues(text, cast) {
  const cleaned = cleanActionCostume(text);
  const lines = [];
  for (const row of lineRows(text)) {
    if (!RE_ACTION.test(row.line) || !/(身穿|穿着|身着)/.test(row.line)) continue;
    if (!COSTUME_WORD.test(row.line)) continue;
    lines.push(`第${row.index}行：${row.line.slice(0, 90)}`);
  }

  const missing = [];
  for (const row of cast) {
    for (const item of row.items) {
      if (!item.dress) missing.push(`第${row.index}行 ${item.name}`);
    }
  }
  return { remove: lines, missing, cleanedCount: cleaned.count };
}

function aliasCandidates(text, cast) {
  const known = [...new Set(cast.flatMap((row) => row.items.map((item) => item.name)))];
  const speakers = dialogueSpeakers(text);
  const names = [];
  for (const speaker of speakers) {
    if (known.includes(speaker)) continue;
    const matches = known.filter(
      (name) => name.endsWith(speaker) || speaker.endsWith(name),
    );
    if (matches.length === 1) {
      names.push(`台词说话人「${speaker}」候选统一为「${matches[0]}」。`);
    }
  }

  const objects = new Map();
  for (const row of lineRows(text)) {
    if (!RE_ACTION.test(row.line)) continue;
    for (const hit of row.line.matchAll(
      /(?:拿着|举起|端起|握着|抓住|放下|放在|递出|递向|拔起|拔出)([^，。；]{2,12})/g,
    )) {
      const name = hit[1]
        .replace(/^(?:了|着|起|出|向|到|在)/, "")
        .replace(/(?:走到|来到|转向|说道|说道)$/, "")
        .trim();
      if (name.length < 2) continue;
      objects.set(name, (objects.get(name) || 0) + 1);
    }
  }
  const props = [...objects.keys()];
  const guesses = [];
  for (let i = 0; i < props.length; i += 1) {
    for (let j = i + 1; j < props.length; j += 1) {
      const a = props[i];
      const b = props[j];
      if (a === b) continue;
      const aHead = a.match(PROP_HEAD)?.[0] || "";
      const bHead = b.match(PROP_HEAD)?.[0] || "";
      if (
        (aHead && aHead === bHead) ||
        a.endsWith(b) ||
        b.endsWith(a)
      ) {
        guesses.push(`道具称呼「${a}」「${b}」尾词相同，候选统一为首次出现名称。`);
      }
    }
  }
  return { names: [...new Set(names)], props: [...new Set(guesses)] };
}

function groupCandidates(cast) {
  const out = [];
  for (const row of cast) {
    for (const item of row.items) {
      if (item.name.includes("群像")) continue;
      if (GROUP_ROLE.test(item.name) || GROUP_ROLE.test(item.dress)) {
        out.push(`第${row.index}行「${item.name}」是群众或群体角色，候选并入对应群像。`);
      }
    }
  }
  return out;
}

function ambiguousSubjects(text) {
  return lineRows(text)
    .filter((row) => AMBIGUOUS_SUBJECT.test(row.line))
    .map((row) => `第${row.index}行：${row.line.slice(0, 100)}`);
}

function asBody(items, empty = "无。") {
  return items.length ? items.map((item) => `- ${item}`) : [`- ${empty}`];
}

/**
 * 格式检查 MVP：只诊断，不改稿。
 * 输出严格沿用现有《统一确认清单》的 11 个分类，供确认链直接使用。
 */
export function analyzeFormatScript(text) {
  const source = String(text || "");
  const parsed = parseScript(source);
  const cast = castRows(source);
  const sfx = (source.match(/【音效】/g) || []).length;
  const sub = (source.match(/【字幕】/g) || []).length;
  const costumes = costumeIssues(source, cast);
  const aliases = aliasCandidates(source, cast);
  const duplicate = duplicateAndEmptyIssues(source);
  const groups = groupCandidates(cast);
  const subjects = ambiguousSubjects(source);
  const numbering = numberingIssues(source);
  const merges = pendingSceneMerges(source);

  const uncertain = [];
  uncertain.push(...merges, ...groups);
  if (!episodeRows(source).length) uncertain.push("未识别到规范的「第X集」标题。");
  if (!sceneRows(source).length) {
    uncertain.push("未识别到规范的「X-Y 场景名 内/外 天气」场次标题。");
  }
  if (parsed.warnings.length) uncertain.push(...parsed.warnings);

  const categories = [
    asBody([], merges.length ? "同名场次候选见其他需决策项。" : "无。"),
    asBody(
      sfx || sub
        ? [`【音效】${sfx} 处，拟删除标记并保留其后内容。`, `【字幕】${sub} 处，拟先判断内容是否承载剧情。`]
        : [],
    ),
    asBody(costumes.remove),
    asBody(aliases.names),
    asBody([], groups.length ? "群众角色候选见其他需决策项。" : "无。"),
    asBody([
      ...duplicate.empty.map((key) => `${key} 是空场，拟删除或确认保留。`),
      ...duplicate.duplicates.map((line) => `发现完全重复内容：「${line}」`),
    ]),
    asBody(numbering),
    asBody(aliases.props),
    asBody(subjects),
    asBody(costumes.missing.map((item) => `${item} 缺着装，拟补充或确认留空。`)),
    asBody(uncertain),
  ];

  const checklist = CATEGORY_TITLES.map(
    (title, index) => `${index + 1}. **${title}**\n${categories[index].join("\n")}`,
  ).join("\n\n");

  const issueCount = categories.reduce(
    (sum, body) => sum + body.filter((line) => !line.startsWith("- 无")).length,
    0,
  );

  return {
    checklist,
    stats: {
      episodes: parsed.episodes.length,
      scenes: parsed.sceneCount,
      casts: cast.length,
      issues: issueCount,
      chars: source.replace(/\s/g, "").length,
    },
    warnings: parsed.warnings,
  };
}
