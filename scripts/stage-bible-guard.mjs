const REQUIRED_HEADINGS = [
  "## 1. 制作命题",
  "## 2. 因果脊柱",
  "## 3. 主角",
  "## 4. 对手与关系动力",
  "## 5. 舞台世界",
  "## 6. 人物表与兼任",
  "## 7. 母题与兑现",
  "## 8. 改编变更账",
  "## 9. 缺席与风险",
];

const REQUIRED_FIELDS = [
  "LOG LINE:",
  "DRAMATIC QUESTION:",
  "THEATRICAL PREMISE:",
  "WANT:",
  "NEED:",
  "OBSTACLE:",
  "STAKES:",
  "TACTICS:",
  "ARC:",
];

export function validateStoryBible(
  content,
  { castMax = Infinity, source = "" } = {},
) {
  const issues = [];
  const text = String(content ?? "");
  const add = (code, detail) => issues.push({ code, severity: "P0", detail });

  for (const heading of REQUIRED_HEADINGS) {
    if (!text.includes(heading)) add("BIBLE_SECTION_MISSING", `缺少段落：${heading}`);
  }
  for (const field of REQUIRED_FIELDS) {
    if (!text.includes(field)) add("BIBLE_FIELD_MISSING", `缺少字段：${field}`);
  }

  for (const match of text.matchAll(/<[^>\n]{1,40}>/g)) {
    add("BIBLE_PLACEHOLDER_LEFT", `残留模板占位：${match[0]}`);
  }
  if (text.includes("原文名")) {
    add("BIBLE_ORIGINAL_NAME_PLACEHOLDER", "人物名仍写着“原文名”");
  }

  const castLines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^C\d{2}\s*\|/.test(line));
  if (!castLines.length) add("BIBLE_CAST_MISSING", "CASTING 没有人物行");
  for (const line of castLines) {
    if (line.split("|").length !== 8) {
      add("BIBLE_CAST_COLUMNS", `CASTING 列数不是 8：${line}`);
    }
  }

  const doublingRows = [...text.matchAll(/^A\d{2}[：:]\s*演员[^饰]+饰\s*(.+)$/gm)];
  const doubledRoles = doublingRows.filter((match) => match[1].includes("/"));
  if (castLines.length && castLines.length <= castMax && doubledRoles.length) {
    add(
      "BIBLE_UNNECESSARY_DOUBLING",
      `CAST_MAX=${castMax} 足以一人一角，却安排了兼任`,
    );
  }

  if (!/POWER:|DEPENDENCY:|SCENIC_RULE:/.test(text)) {
    add("BIBLE_RELATION_FIELDS_MISSING", "关系动力或舞台规则字段不完整");
  }
  if (!text.includes("OPEN_QUESTIONS")) add("BIBLE_QUESTIONS_MISSING", "缺少 OPEN_QUESTIONS");
  if (!text.includes("DOUBLING_GUARDS")) add("BIBLE_DOUBLING_GUARDS_MISSING", "缺少兼任风险表");
  if (/^TRANSITION_GRAMMAR:\s*无\s*$/m.test(text)) {
    add("BIBLE_TRANSITION_MISSING", "TRANSITION_GRAMMAR 不能只写“无”");
  }
  if (!/^STAKES:\s*(?:\[原文\]|推断：)/m.test(text)) {
    add("BIBLE_STAKES_UNMARKED", "STAKES 未标明 [原文] 或“推断：”");
  }

  if (source) {
    for (const match of text.matchAll(/从\s*[“"]([^”"\n]+)[”"]\s*到/g)) {
      const quote = match[1].trim();
      if (quote && !source.includes(quote)) {
        add("BIBLE_QUOTE_UNVERIFIED", `引用了原文中没有的内容：${quote}`);
      }
    }
  }

  return issues;
}
