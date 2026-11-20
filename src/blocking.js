/**
 * blocking 闸门（零模型）。
 *
 * 稳定链路每一镜都有一行「人物空间位置」，但没人检查它是否**覆盖了本镜所有人物**。
 * 这一闸门只做两件确定能判的事：
 *   1. 人物表里列出的人，空间位置行里必须有他，且附近带位置/姿态线索
 *   2. 空间位置行里出现的人，必须在人物表里
 *
 * 不做：判断位置是否"合理"、与上一镜是否矛盾（那是 state-chain 的活）。
 */

const POSITION_CUE =
  /(画面|左侧|右侧|左边|右边|中央|中部|前景|背景|门口|床边|身旁|身后|身前|前方|后方|面朝|面向|看着|站在|坐在|躺在|跪在|蹲在|靠在|位于|手中|怀里|端|抱着|距离|米|步)/;

const TITLE = /(长老|伯爵夫人|伯爵|侯爵|公爵|爵士|先生|女士|夫人|小姐|公子|大人|将军|总裁|老板|管家|侍卫|仆人|侍女)$/;

/** 去掉称谓，保留核心名；用于识别「巴里长老」与「巴里」是同一人。 */
function coreName(name) {
  const stripped = trim(name).replace(TITLE, "");
  return stripped.length >= 2 ? stripped : trim(name);
}

function trim(value) {
  return String(value == null ? "" : value).trim();
}

function splitNames(segment) {
  return segment
    // 只用顿号分隔：括号里常带中文逗号（着装：…），按逗号切会把括注拆开。
    .split(/、/)
    .map((item) => trim(item.replace(/[（(][^）)]*[）)]/g, "")))
    .filter(Boolean);
}

/** 分镜稿 → [{no, label, cast, space, spaceLine}] */
export function parseBlockingShots(markdown) {
  const shots = [];
  let current = null;
  let expectSpace = false;
  for (const raw of String(markdown || "").split("\n")) {
    const line = raw.trim();
    const head = line.match(/^【分镜(\d+)】/);
    if (head) {
      current = { no: head[1], label: `分镜${head[1]}`, cast: [], space: "", spaceLine: "" };
      shots.push(current);
      expectSpace = false;
      continue;
    }
    if (!current) continue;
    const meta = line.match(/^\[shot\d+\s*\|(.+)\]$/);
    if (meta) {
      const cast = meta[1].match(/人物\s*[：:]\s*([^｜|]+)/);
      current.cast = cast ? splitNames(cast[1]) : [];
      continue;
    }
    if (/^人物空间位置[：:]?$/.test(line)) {
      expectSpace = true;
      continue;
    }
    if (expectSpace) {
      current.space = line;
      current.spaceLine = line;
      expectSpace = false;
    }
  }
  return shots;
}

/** @returns {Array<{level,where,rule,evidence}>} */
export function auditBlocking(markdown) {
  const shots = parseBlockingShots(markdown);
  const issues = [];

  for (const shot of shots) {
    if (!shot.cast.length) continue;

    if (!trim(shot.space)) {
      issues.push({
        level: "中",
        where: shot.label,
        rule: "缺空间位置",
        evidence: `人物表有 ${shot.cast.length} 人，但没有「人物空间位置」行`,
      });
      continue;
    }

    if (!POSITION_CUE.test(shot.space)) {
      issues.push({
        level: "低",
        where: shot.label,
        rule: "空间位置无方位",
        evidence: `「${shot.space.slice(0, 30)}」没有任何方位或姿态线索`,
      });
    }

    for (const name of shot.cast) {
      if (shot.space.includes(name)) continue;
      const core = coreName(name);
      if (core !== name && shot.space.includes(core)) {
        issues.push({
          level: "低",
          where: shot.label,
          rule: "称谓不一致",
          evidence: `人物表写「${name}」，空间位置行写「${core}」——同一人最好统一写法`,
        });
        continue;
      }
      // 「诺曼伯爵夫人」在正文里写成「伯爵夫人」：保留称谓、省掉姓氏。
      const title = trim(name).match(TITLE);
      if (title && shot.space.includes(title[0])) {
        issues.push({
          level: "低",
          where: shot.label,
          rule: "称谓不一致",
          evidence: `人物表写「${name}」，空间位置行写「${title[0]}」——同一人最好统一写法`,
        });
        continue;
      }
      issues.push({
        level: "中",
        where: shot.label,
        rule: "人物未定位",
        evidence: `人物表有「${name}」，但空间位置行里没有他——模型不知道这个人在画面哪里`,
      });
    }

    for (const name of shot.cast) {
      if (!shot.space.includes(name)) continue;
      const at = shot.space.indexOf(name);
      const window = shot.space.slice(Math.max(0, at - 6), at + name.length + 24);
      if (!POSITION_CUE.test(window)) {
        issues.push({
          level: "低",
          where: shot.label,
          rule: "人物缺方位",
          evidence: `「${name}」出现在空间位置行里，但附近没有方位或姿态描述`,
        });
      }
    }
  }

  return issues;
}
