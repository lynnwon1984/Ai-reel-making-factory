import { buildCharacterRegistry } from "./storyboard.js";

/** 默认每 2 批停一次；0 表示不停 */
export const CHECKPOINT_DEFAULT = 2;

/**
 * 接力包：把已生成的批次压缩成「下一批必须沿用的设定」。纯解析，不调模型。
 */
export function buildLedger(parsed) {
  const registry = buildCharacterRegistry(parsed);
  const characters = [];
  const seen = new Set();
  const scenes = [];

  for (const ep of parsed.episodes) {
    for (const shot of ep.shots) {
      for (const c of shot.cast) {
        if (!c.name || seen.has(c.name)) continue;
        seen.add(c.name);
        characters.push({
          code: registry.get(c.name) || c.name,
          name: c.name,
          dress: c.dress || "",
        });
      }
      const scene = String(shot.scene || "").trim();
      if (scene && !scenes.includes(scene)) scenes.push(scene);
    }
  }

  const lastEp = parsed.episodes[parsed.episodes.length - 1];
  const lastShot = lastEp ? lastEp.shots[lastEp.shots.length - 1] : null;

  return {
    characters,
    scenes,
    lastPosition: lastShot ? String(lastShot.position || "").trim() : "",
    nextCode: `C${String(characters.length + 1).padStart(2, "0")}`,
  };
}

/** 拼成下一批 seed 的前缀；没有内容时返回空串 */
export function ledgerSeed(ledger) {
  if (!ledger) return "";
  const { characters = [], scenes = [], lastPosition = "", nextCode = "" } = ledger;
  if (!characters.length && !scenes.length && !lastPosition) return "";

  const lines = ["【已确立设定·务必沿用，不得重新编号】"];
  if (characters.length) {
    lines.push(
      "角色：" +
        characters
          .map((c) => (c.dress ? `${c.code}（${c.dress}）` : c.code))
          .join("｜"),
    );
  }
  if (scenes.length) lines.push("已用场景名：" + scenes.join("｜"));
  if (lastPosition) lines.push("上一批结尾空间状态：" + lastPosition);
  if (nextCode) lines.push(`新角色从 ${nextCode} 继续编号，不得复用已有编号。`);
  return lines.join("\n");
}

/** 跑完第 done 批之后是否该停 */
export function shouldPause({ done, total, every }) {
  if (!every || every <= 0) return false;
  if (done <= 0 || done >= total) return false;
  return done % every === 0;
}

/** 当前这一段的起始批号（从 0 起） */
export function segmentStart({ done, every }) {
  if (!every || every <= 0) return 0;
  return Math.max(0, done - (done % every || every));
}
