/**
 * 把模型输出的《统一确认清单》/《逻辑诊断清单》解析成可勾选条目。
 * 只做「尽力解析」：解析成功就上逐项确认，解析不出来就退回整体确认。
 *
 * 见过的两种格式：
 *   ### 1. 拟合并场次清单
 *   1. **拟合并场次清单**：无。
 */
const HEAD = /^\s*(?:#{1,6}\s*)?(\d{1,2})\s*[.、)]\s*(.+)$/;

function splitCells(row) {
  return row
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim().replace(/\*\*/g, ""));
}

/** 编号列表格式：### 1. 拟合并场次清单 / 1. **拟合并场次清单**：无。 */
function parseNumbered(lines) {
  const items = [];
  let cur = null;

  for (const raw of lines) {
    const line = raw.replace(/\*\*/g, "");
    const hit = HEAD.exec(line);

    if (hit) {
      if (cur) items.push(cur);
      let title = hit[2].trim();
      let rest = "";
      // 「拟合并场次清单：无。」→ 标题 + 正文
      const cut = title.search(/[：:]/);
      if (cut > 0 && cut <= 24) {
        rest = title.slice(cut + 1).trim();
        title = title.slice(0, cut).trim();
      }
      cur = { no: Number(hit[1]), title, body: rest ? [rest] : [], risk: false };
      continue;
    }

    if (cur) {
      const t = line.trim();
      if (t) cur.body.push(t);
    }
  }
  if (cur) items.push(cur);

  for (const item of items) {
    item.risk = /\bL3\b|高风险|待判断|需确认|候选/.test(
      `${item.title} ${item.body.join(" ")}`,
    );
  }

  return items;
}

/** 表格格式：| 编号 | 集/场 | 类型 | 等级 | ... | 风险等级 | 需确认 | */
function parseTableBlock(block) {
  if (block.length < 3) return [];
  const header = splitCells(block[0]);
  const idx = (...names) =>
    header.findIndex((head) => names.some((name) => head.includes(name)));

  const iId = idx("编号");
  const iScene = idx("集/场", "集数", "场次");
  const iType = idx("类型");
  const iIssue = idx("问题");
  const iFix = idx("建议");
  const iRisk = idx("风险");

  const items = [];
  for (let r = 2; r < block.length; r += 1) {
    const cells = splitCells(block[r]);
    const id = (iId >= 0 ? cells[iId] : cells[0]) || "";
    if (!/^[A-Za-z]{0,3}-?\d+/.test(id)) continue;

    const title = [id, iScene >= 0 ? cells[iScene] : "", iType >= 0 ? cells[iType] : ""]
      .filter(Boolean)
      .join(" · ");
    const body = [];
    if (iIssue >= 0 && cells[iIssue]) body.push(`问题：${cells[iIssue]}`);
    if (iFix >= 0 && cells[iFix]) body.push(`建议：${cells[iFix]}`);

    items.push({
      no: items.length + 1,
      id,
      title,
      body,
      // 保守处理：风险列里出现 L3 就要求单独授权
      risk: /L3/.test(iRisk >= 0 ? cells[iRisk] : ""),
    });
  }
  return items;
}

function parseTable(lines) {
  const blocks = [];
  let cur = null;
  for (const line of lines) {
    if (line.trim().startsWith("|")) {
      if (!cur) cur = [];
      cur.push(line);
    } else if (cur) {
      blocks.push(cur);
      cur = null;
    }
  }
  if (cur) blocks.push(cur);

  for (const block of blocks) {
    const items = parseTableBlock(block);
    if (items.length >= 3) return items;
  }
  return [];
}

export function parseChecklist(text) {
  const lines = String(text || "").split("\n");
  const numbered = parseNumbered(lines);
  if (numbered.length >= 3) return numbered;
  const table = parseTable(lines);
  if (table.length >= 3) return table;
  return numbered.length ? numbered : table;
}

const DIAGNOSTIC_TITLES = [
  "逻辑诊断清单",
  "道具连续性台账",
  "人物动线表",
  "高风险剧情修复清单",
  "台词翻译确认清单",
  "其他需用户决策项",
];

const REVIEWABLE_TITLES = new Set([
  "逻辑诊断清单",
  "高风险剧情修复清单",
  "台词翻译确认清单",
  "其他需用户决策项",
]);

function headingText(line) {
  return line
    .trim()
    .replace(/^#{1,6}\s*/, "")
    .replace(/\*\*/g, "")
    .replace(/^\d+\s*[.、)]\s*/, "")
    .replace(/^[-*]\s+/, "")
    .trim();
}

function diagnosticTitle(line) {
  const text = headingText(line);
  if (!text || text.length > 80 || text.includes("|")) return "";
  for (const title of DIAGNOSTIC_TITLES) {
    if (
      text === title ||
      text === `《${title}》` ||
      text.startsWith(`${title}：`) ||
      text.startsWith(`${title}:`) ||
      text.startsWith(`《${title}》`) ||
      text.startsWith(`${title}（`)
    ) {
      return title;
    }
  }
  return "";
}

/**
 * 第二步会一次输出多份诊断文件。
 * 按标题拆开后分别解析，避免只有第一张表被展示或被确认。
 */
export function splitDiagnosticReports(text) {
  const sections = [];
  let current = { title: "诊断说明", lines: [] };

  for (const line of String(text || "").split("\n")) {
    const title = diagnosticTitle(line);
    if (title) {
      if (current.lines.some((item) => item.trim())) sections.push(current);
      current = { title, lines: [] };
    } else {
      current.lines.push(line);
    }
  }
  if (current.lines.some((item) => item.trim())) sections.push(current);

  const found = sections.filter((section) =>
    DIAGNOSTIC_TITLES.includes(section.title),
  );
  if (!found.length) return [];

  let globalNo = 0;
  return found.map((section, index) => {
    const raw = section.lines.join("\n").trim();
    const reviewable = REVIEWABLE_TITLES.has(section.title);
    const items = parseChecklist(raw).map((item) => {
      if (reviewable) globalNo += 1;
      return {
        ...item,
        no: reviewable ? globalNo : item.id || item.no,
        sourceNo: item.id || item.no,
        section: section.title,
        title: `${section.title} · ${item.title}`,
      };
    });
    return {
      key: `report-${index + 1}`,
      title: section.title,
      raw,
      items,
      reviewable,
    };
  });
}

/** 是否够格走逐项确认（否则退回整体确认） */
export function canReviewPerItem(items) {
  return Array.isArray(items) && items.length >= 3;
}

/**
 * 拼出回给模型的「逐项决定」。
 * 原则：原文清单照样带上（模型需要它），再加上明确的逐项裁定。
 */
export function buildDecisionText(items, isChecked, note) {
  const lines = items.map(
    (item) =>
      `- 第 ${item.no} 项（${item.title}）：${isChecked(item) ? "确认执行" : "不执行"}`,
  );
  const skipped = items.filter((item) => !isChecked(item)).length;

  let out = `【用户的逐项决定】\n${lines.join("\n")}\n`;
  out += `\n合计：确认 ${items.length - skipped} 项，不执行 ${skipped} 项。`;
  out += `\n请**严格按逐项决定执行**：只执行标记为「确认执行」的项；被标为「不执行」的项一律不得执行，也不要顺带处理。`;

  const extra = String(note || "").trim();
  if (extra) {
    out += `\n\n【用户的补充修改要求】\n${extra}\n补充要求优先于上面的默认处理。`;
  }

  return out;
}
