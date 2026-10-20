/**
 * 从第②步的产出里，捞出被它判定为「属第①步范畴、本版不执行」的条目。
 * 目的：把这类问题显式交回给第①步（格式整理），而不是两边都不管。
 * 尽力解析；解析不出来也没关系——用户可以把内容直接写进输入框。
 */
const HEADER = /(未执行|不执行|交回)/;
const SCOPE = /(第\s*[①1]\s*步|第一步|格式整理|格式(类|范畴)|格式环节)/;
const RULE = /^[-*_=]{3,}$/; // 分隔线不算列表项
const BULLET = /^(?:[-*•]\s+|\d+[.、)]\s*)(.+)$/;

export function extractDeferredItems(text) {
  const lines = String(text || "")
    .split("\n")
    .map((line) => line.replace(/\*\*/g, "").trim());

  // 逐个候选表头去找：**表头后面必须紧跟列表项**，否则换下一个候选。
  // （否则会被正文里"属第①步范畴……不执行"这类句子带偏，漂到后面无关的列表上。）
  for (let i = 0; i < lines.length; i += 1) {
    if (!(HEADER.test(lines[i]) && SCOPE.test(lines[i]))) continue;

    const items = [];
    for (let j = i + 1; j < lines.length; j += 1) {
      const next = lines[j];
      if (!next) {
        if (items.length) break;
        continue;
      }
      if (RULE.test(next)) {
        if (items.length) break;
        continue;
      }
      const bullet = BULLET.exec(next);
      if (bullet) {
        items.push(bullet[1].trim());
        continue;
      }
      break;
    }
    if (items.length) return items.slice(0, 15);
  }

  return [];
}

/** 拼出送回第①步的输入 */
export function buildStep1Brief(items, script) {
  return [
    "【本次需按《格式整理》规范处理的事项】",
    "（来源：逻辑环节的标注 —— 属格式范畴，逻辑环节不执行，现交回格式环节处理）",
    ...items.map((one) => `- ${one}`),
    "",
    "【待处理的剧本】",
    script,
    "",
    "请按《格式整理》规范处理上述事项，并输出完整的剧本。",
  ].join("\n");
}
