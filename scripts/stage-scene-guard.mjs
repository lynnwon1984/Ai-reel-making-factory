const HEADER_FIELDS = new Set(["时间", "地点", "人物"]);
const FILM_TERMS = ["镜头", "景别", "特写", "推拉", "摇移", "剪辑", "切镜", "淡入", "淡出", "蒙太奇", "分屏"];

export function validateSceneDraft(
  content,
  { minHanChars = 0, sourceQuotes = [], forbiddenSnippets = [] } = {},
) {
  const text = String(content ?? "");
  const issues = [];
  const add = (code, detail) => issues.push({ code, severity: "P0", detail });
  const hanChars = [...text.matchAll(/\p{Script=Han}/gu)].length;

  if (!/^S\d+\s+\S+/m.test(text)) add("SCENE_HEADER_MISSING", "缺少场次标题");
  for (const field of ["时间", "地点", "人物"]) {
    if (!new RegExp(`^${field}：`, "m").test(text)) {
      add("SCENE_HEADER_FIELD_MISSING", `缺少${field}栏`);
    }
  }
  if (/^角色名：/m.test(text)) add("SCENE_LITERAL_LABEL", "残留模板文字“角色名：”");
  if (hanChars < minHanChars) {
    add(
      "SCENE_TOO_SHORT",
      `正文只有 ${hanChars} 个汉字，低于本场预算 ${minHanChars} 个`,
    );
  }

  for (const term of FILM_TERMS) {
    if (text.includes(term)) add("SCENE_FILM_GRAMMAR", `出现影视术语：${term}`);
  }

  const dialogueLines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => {
      const match = line.match(/^([^：]{1,12})：\s*(.+)$/);
      return match && !HEADER_FIELDS.has(match[1]);
    });
  if (!dialogueLines.length) add("SCENE_DIALOGUE_MISSING", "没有解析到实际对白行");

  for (const quote of sourceQuotes) {
    if (!text.includes(quote)) {
      add("SCENE_SOURCE_QUOTE_MISSING", `原文对白未进入本场：${quote}`);
    }
  }

  for (const snippet of forbiddenSnippets) {
    if (snippet && text.includes(snippet)) {
      add("SCENE_BOUNDARY_BREACH", `提前写入下一场内容：${snippet}`);
    }
  }

  const seenLines = new Map();
  for (const line of text
    .split("\n")
    .map((item) => item.trim())
    .filter(
      (item) =>
        item.length >= 10 &&
        !item.startsWith("【") &&
        !/^(时间|地点|人物)：/.test(item),
    )) {
    if (seenLines.has(line)) {
      add("SCENE_REPEATED_LINE", `重复段落：${line.slice(0, 30)}`);
    }
    seenLines.set(line, true);
  }

  return { issues, hanChars, dialogueLines };
}
