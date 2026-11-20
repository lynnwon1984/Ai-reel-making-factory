import { parseCastLine } from "./storyboard.js";
import { parseScript } from "./split.js";

const trim = (value) => String(value ?? "").trim();
const HAND =
  /(左手|右手|左掌|右掌|双手|手中)/gu;
const HOLD =
  /(拿着|握着|托着|持着|抓着|提着|抱着|捏着|夹着|端着|拎着)/u;
const HOLD_REVERSE =
  /^的?([^，,；;。]+?)(垂在|挂在|搭在|停在)(.+)$/u;
const TRANSFER =
  /换手|换到|换至|交到|交给|递给|接过|转交|放到|放下|收起|取回|用左手|用右手|左手指|右手指/u;

function normalizeObject(value) {
  return trim(value)
    .replace(/^(?:那|这|一|半|整|几|两|三|四|五|六|七|八|九|十)?[个只把杯扎瓶盒张份条根块串]?/u, "")
    .replace(/[。；，,]/g, "")
    .trim();
}

/**
 * 从一个状态句里提取左右手持物。
 * 只认“左手/右手 + 持物动词 + 物件”这类能明确比较的写法。
 */
export function heldItems(text) {
  const out = [];
  for (const clause of trim(text).split(/[。；]/).map(trim).filter(Boolean)) {
    for (const match of clause.matchAll(HAND)) {
      const side = match[1];
      const rest = clause.slice((match.index || 0) + side.length);
      const nextHand = [...rest.matchAll(HAND)]
        .map((item) => item.index)
        .filter((index) => Number.isInteger(index))
        .sort((left, right) => left - right)[0];
      const segment = nextHand == null ? rest : rest.slice(0, nextHand);
      const hold = segment.match(HOLD);
      let objectText = "";
      const reversed = segment.match(HOLD_REVERSE);
      if (reversed) {
        objectText = reversed[1];
      } else if (hold && hold.index != null) {
        objectText = segment
          .slice(hold.index + hold[0].length)
          .split(/[，,；;]|同时|另一只手|左手|右手/u)[0];
      } else {
        continue;
      }
      const object = trim(objectText).replace(/[，,；;。]/g, "").trim();
      if (object) out.push({ side, object });
    }
  }
  return out;
}

function sameObject(left, right) {
  const a = normalizeObject(left);
  const b = normalizeObject(right);
  return Boolean(a && b && (a === b || a.includes(b) || b.includes(a)));
}

/**
 * 相邻 shot 的持物连续性。
 * 上一镜右手持物、下一镜左手持物，且中间没有换手/递交动作 → 高危。
 */
export function auditHandContinuity(plan) {
  const issues = [];
  const shots = Array.isArray(plan?.shots) ? plan.shots : [];
  for (let index = 1; index < shots.length; index += 1) {
    const previous = shots[index - 1];
    const current = shots[index];
    const before = heldItems(previous.endState);
    const after = heldItems(current.startState);
    if (!before.length || !after.length) continue;
    const bridge = [
      current.continuityNote,
      current.startState,
      ...(current.clips || []).map((clip) => clip.visualAction),
    ]
      .filter(Boolean)
      .join("；");
    if (TRANSFER.test(bridge)) continue;

    for (const oldItem of before) {
      const matching = after.find((item) => sameObject(item.object, oldItem.object));
      if (!matching || matching.side === oldItem.side) continue;
      issues.push({
        level: "高",
        where: `shot${index + 1}`,
        msg: `持物换手无来源：上一镜${oldItem.side}持「${oldItem.object}」，本镜变为${matching.side}，未写换手或递交动作`,
      });
    }
  }
  return { issues };
}

/** 给一批已经编译的 shots 找源场人物表，便于后续做人物级连续性检查。 */
export function sceneCastNames(sourceText, sceneKey) {
  for (const episode of parseScript(sourceText).episodes) {
    const scene = episode.scenes.find((item) => item.key === sceneKey);
    if (scene) return parseCastLine(scene.cast || "").map((item) => item.name);
  }
  return [];
}
