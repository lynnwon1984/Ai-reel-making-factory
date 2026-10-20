/**
 * 剧本结构校验：纯规则，不花 token，只报告、不修改内容。
 * 规则来自《格式整理》提示词的规范：集标题 / 场次标题 / 人物行 / 标记清理 / 正文不着装。
 */
// 「集」字后面只能跟：结尾、空白的、或冒号。
// 否则像「第11集后半缺失：原文在……中断」这种正文句子会被误判成集标题
// （真样本里就是这么误报出「集号不连续」的）。
const RE_EP = /^第\s*(\d+)\s*集(?![^\s：:])/;
const RE_SCENE = /^(\d+)\s*-\s*(\d+)\s+\S/;
const RE_CAST = /^人物\s*[：:]/;
const RE_ACTION = /^△/;

export function validateScript(text) {
  const all = String(text || "")
    .split("\n")
    .map((line) => line.replace(/\*\*/g, "").trimEnd());
  // 模型常在正文前后附一段说明；从第一个「第X集」起才算正文，
  // 否则说明里出现的「【字幕】」会被误判成标记残留。
  const start = all.findIndex((line) => RE_EP.test(line.trim()));
  const lines = start > 0 ? all.slice(start) : all;
  const src = lines.join("\n");
  const checks = [];

  /* 集 */
  const eps = [];
  lines.forEach((line, idx) => {
    const hit = RE_EP.exec(line.trim());
    if (hit) eps.push({ no: Number(hit[1]), idx });
  });

  if (!eps.length) {
    checks.push({ level: "warn", title: "没找到集标题", detail: "未匹配到「第X集：集名」" });
  } else {
    const bad = eps.filter((ep, k) => ep.no !== k + 1).map((ep) => `第${ep.no}集`);
    if (bad.length) {
      checks.push({
        level: "warn",
        title: "集号不连续",
        detail: `${bad.join("、")} —— 与出现顺序不符`,
      });
    } else {
      checks.push({ level: "ok", title: `集号连续（共 ${eps.length} 集）` });
    }
  }

  /* 场次 */
  const scenes = [];
  lines.forEach((line, idx) => {
    const hit = RE_SCENE.exec(line.trim());
    if (hit) scenes.push({ ep: Number(hit[1]), no: Number(hit[2]), idx });
  });

  if (!scenes.length) {
    checks.push({
      level: "warn",
      title: "没找到场次标题",
      detail: "未匹配到「X-Y 场景名 内/外 天气」",
    });
  } else {
    const gap = [];
    let prevEp = null;
    let expect = 1;
    for (const scene of scenes) {
      if (scene.ep !== prevEp) {
        prevEp = scene.ep;
        expect = 1;
      }
      if (scene.no !== expect) gap.push(`${scene.ep}-${scene.no}（应为 ${scene.ep}-${expect}）`);
      expect = scene.no + 1;
    }

    const mismatch = [];
    for (const scene of scenes) {
      const owner = [...eps].reverse().find((ep) => ep.idx < scene.idx);
      if (!owner) continue;
      if (owner.no !== scene.ep) mismatch.push(`${scene.ep}-${scene.no}`);
    }

    if (gap.length) {
      checks.push({ level: "warn", title: "场次编号不连续", detail: gap.slice(0, 6).join("、") });
    } else {
      checks.push({ level: "ok", title: `场次编号连续（共 ${scenes.length} 场）` });
    }
    if (mismatch.length) {
      checks.push({
        level: "warn",
        title: "场次编号与所属集不一致",
        detail: mismatch.slice(0, 6).join("、"),
      });
    }
  }

  /* 标记残留 */
  const sfx = (src.match(/【音效】/g) || []).length;
  const sub = (src.match(/【字幕】/g) || []).length;
  if (sfx || sub) {
    checks.push({
      level: "warn",
      title: "标记残留",
      detail: `【音效】${sfx} 处、【字幕】${sub} 处`,
    });
  } else {
    checks.push({ level: "ok", title: "无【音效】【字幕】标记残留" });
  }

  /* 人物行 */
  const castIssues = [];
  if (scenes.length) {
    scenes.forEach((scene, k) => {
      const end = k + 1 < scenes.length ? scenes[k + 1].idx : lines.length;
      const block = lines.slice(scene.idx + 1, end);
      const castAt = block.findIndex((line) => RE_CAST.test(line.trim()));
      const actionAt = block.findIndex((line) => RE_ACTION.test(line.trim()));

      if (castAt < 0) {
        castIssues.push(`${scene.ep}-${scene.no} 缺人物行`);
        return;
      }
      if (actionAt >= 0 && castAt > actionAt) {
        castIssues.push(`${scene.ep}-${scene.no} 人物行应在动作之前`);
      }
      const entries = block[castAt].match(/（[^）]*）/g) || [];
      const missing = entries.filter((one) => !one.includes("着装"));
      if (missing.length) {
        castIssues.push(`${scene.ep}-${scene.no} 有 ${missing.length} 个角色缺「着装：」`);
      }
    });
  }
  checks.push(
    castIssues.length
      ? { level: "warn", title: "人物行问题", detail: castIssues.slice(0, 5).join("；") }
      : { level: "ok", title: "人物行齐全且都带「着装：」" },
  );

  /* 空场 */
  const empty = [];
  scenes.forEach((scene, k) => {
    const end = k + 1 < scenes.length ? scenes[k + 1].idx : lines.length;
    const body = lines.slice(scene.idx + 1, end).filter((line) => line.trim());
    if (!body.length) empty.push(`${scene.ep}-${scene.no}`);
  });
  if (empty.length) {
    checks.push({ level: "warn", title: "空场（没有任何内容）", detail: empty.join("、") });
  } else if (scenes.length) {
    checks.push({ level: "ok", title: "无空场" });
  }

  /* 正文着装描述（启发式，可能有误报） */
  const dress = lines.filter((line) => RE_ACTION.test(line.trim()) && /穿着|身穿|身着/.test(line));
  if (dress.length) {
    checks.push({
      level: "warn",
      title: "正文可能残留着装描述（启发式）",
      detail: `${dress.length} 处，例：${dress[0].trim().slice(0, 40)}…`,
    });
  } else {
    checks.push({ level: "ok", title: "正文未见着装描述" });
  }

  return {
    checks,
    stats: `共 ${eps.length || "?"} 集 · ${scenes.length} 场 · ${src.replace(/\s/g, "").length} 字`,
  };
}
