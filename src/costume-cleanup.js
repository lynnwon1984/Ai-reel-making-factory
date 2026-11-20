/**
 * 流程一的确定性收尾：只处理动作行里明确写出的着装描述。
 *
 * 规则来源：《格式整理》要求正文不重复人物行里的着装。
 * 这里不调用模型，也不碰台词、人物行和剧情动作。
 */

const COSTUME_MARKER = /(?:身穿|穿着|身着)/;
const COSTUME_WORD =
  /(盔甲|礼服|婚纱|长裙|睡袍|睡裙|衬衫|马甲|皮靴|靴子|白鞋|法袍|制服|披风|斗篷|便装|工装|装束|衣袍|长袍|裙|鞋|靴|帽|领带|手套|围巾|衣裳|服饰)/;

function cleanSubjectCostume(line) {
  let changed = false;
  const next = line.replace(
    /([^，。；]+?)(?:身穿|穿着|身着)([^，。；]+)[，；]([^，。；].*)/g,
    (whole, subject, costume, rest) => {
      if (!COSTUME_WORD.test(costume)) return whole;
      changed = true;
      return `${subject}${rest}`;
    },
  );
  return { text: next, changed };
}

function cleanAttributiveCostume(line) {
  let changed = false;
  const next = line.replace(
    /((?:一|两|几|数|多|半)?(?:个|名|位|只|双|群|队|众)?)(?:身穿|穿着|身着)([^，。；]+?)的/g,
    (whole, count, costume) => {
      const parts = costume
        .split("、")
        .map((part) => part.trim())
        .filter(Boolean);
      const kept = parts.filter((part) => !COSTUME_WORD.test(part));
      if (kept.length === parts.length) return whole;
      changed = true;
      return kept.length ? `${count}${kept.join("、")}的` : count;
    },
  );
  return { text: next, changed };
}

function cleanBootQualifier(line) {
  if (!line.includes("两双脚并排走在")) return { text: line, changed: false };
  const next = line.replace(/，一双是.*$/u, "。");
  return { text: next, changed: next !== line };
}

export function cleanActionCostume(input) {
  const source = String(input || "");
  let count = 0;

  const text = source
    .split("\n")
    .map((line) => {
      const hit = /^(\s*△)(.*)$/.exec(line);
      if (!hit || !COSTUME_MARKER.test(hit[2])) return line;

      let body = hit[2];
      let changed = false;

      const attributive = cleanAttributiveCostume(body);
      body = attributive.text;
      changed ||= attributive.changed;

      const subject = cleanSubjectCostume(body);
      body = subject.text;
      changed ||= subject.changed;

      const boot = cleanBootQualifier(body);
      body = boot.text;
      changed ||= boot.changed;

      body = body
        .replace(/([，。；])\1+/g, "$1")
        .replace(/，。/g, "。")
        .replace(/，；/g, "；");

      if (!changed) return line;
      count += 1;
      return `${hit[1]}${body}`;
    })
    .join("\n");

  return { text, count };
}
