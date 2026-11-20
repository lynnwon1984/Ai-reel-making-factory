const CARD_FIELDS = [
  "ACT",
  "SOURCE",
  "TITLE",
  "WHEN",
  "WHERE",
  "CAST",
  "ON_STAGE_OPEN",
  "OFF_STAGE",
  "EVENT",
  "OBJECTIVE",
  "OBSTACLE",
  "TACTICS",
  "TURN",
  "CHANGE",
  "ENTER_EXIT",
  "PROPS",
  "SOUND_LIGHT",
  "DOUBLING_RISK",
  "EST_MINUTES",
  "RISK",
];

function field(block, name) {
  return block.match(new RegExp(`^${name}:\\s*(.+)$`, "m"))?.[1]?.trim() || "";
}

function minuteMidpoint(value) {
  const numbers = String(value).match(/\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  if (!numbers.length) return null;
  return numbers.length === 1 ? numbers[0] : (numbers[0] + numbers[1]) / 2;
}

export function validateScenePlan(content, { targetMinutes = Infinity } = {}) {
  const issues = [];
  const text = String(content ?? "");
  const add = (code, sceneId, detail) =>
    issues.push({ code, severity: "P0", sceneId, detail });
  const cards = [
    ...text.matchAll(/^### (S\d+)\n([\s\S]*?)(?=^### S\d+\n|^## ACT CLOSE)/gm),
  ].map((match) => ({ id: match[1], block: match[2] }));

  if (!cards.length) add("SCENE_PLAN_EMPTY", "", "没有解析到场景卡");
  if (!text.includes("## ACT CONTRACT")) add("SCENE_ACT_CONTRACT_MISSING", "", "缺少 ACT CONTRACT");
  if (!text.includes("## ACT CLOSE")) add("SCENE_ACT_CLOSE_MISSING", "", "缺少 ACT CLOSE");
  for (const match of text.matchAll(/^ACT_\d+_END_CHANGE:\s*(.+)$/gm)) {
    if (/是否/.test(match[1])) {
      add("SCENE_END_CHANGE_OPEN", "", `幕终变化仍写成开放问题：${match[1]}`);
    }
  }

  let totalMinutes = 0;
  const seenProps = new Map();
  for (const { id, block } of cards) {
    for (const name of CARD_FIELDS) {
      if (!field(block, name)) add("SCENE_FIELD_MISSING", id, `缺少字段：${name}`);
    }
    const midpoint = minuteMidpoint(field(block, "EST_MINUTES"));
    if (midpoint == null) {
      add("SCENE_DURATION_INVALID", id, "EST_MINUTES 不是数字或范围");
    } else {
      totalMinutes += midpoint;
    }
    if (/^(发生分歧|未解决|关系未改变)/.test(field(block, "CHANGE"))) {
      add("SCENE_CHANGE_VAGUE", id, "CHANGE 只写了未解决或抽象分歧");
    }
    if (/未知|未提及/.test(field(block, "OBSTACLE"))) {
      add("SCENE_OBSTACLE_INVALID", id, "OBSTACLE 写成了信息未知或未被提及");
    }
    const event = field(block, "EVENT");
    const enterExit = field(block, "ENTER_EXIT");
    if (/离开|走进|出门|进入|进场|离场/.test(event) && /^无/.test(enterExit)) {
      add("SCENE_ENTER_EXIT_MISSING", id, "EVENT 有进出/跨门界，ENTER_EXIT 却写无");
    }
    if (
      /进门|进入场内|从门外进来|跨进门/.test(field(block, "ON_STAGE_OPEN")) &&
      /^无/.test(enterExit)
    ) {
      add("SCENE_ENTER_EXIT_MISSING", id, "开场描述已有进场，ENTER_EXIT 却写无");
    }

    const props = field(block, "PROPS");
    for (const match of props.matchAll(/([^；;，,：:\s]+)首次出现/g)) {
      const prop = match[1];
      if (seenProps.has(prop)) {
        add(
          "SCENE_PROP_REDEBUT",
          id,
          `${prop} 已在 ${seenProps.get(prop)} 首次出现，不能重复首次出现`,
        );
      } else {
        seenProps.set(prop, id);
      }
    }
  }

  if (Number.isFinite(targetMinutes) && cards.length) {
    const low = targetMinutes * 0.85;
    const high = targetMinutes * 1.15;
    if (totalMinutes < low || totalMinutes > high) {
      add(
        "SCENE_RUNTIME_OUT_OF_RANGE",
        "",
        `场景估时中值合计 ${totalMinutes} 分钟，目标 ${targetMinutes} 分钟允许范围 ${low.toFixed(1)}–${high.toFixed(1)}`,
      );
    }
    if (targetMinutes <= 15 && (cards.length < 3 || cards.length > 5)) {
      add("SCENE_COUNT_OUT_OF_RANGE", "", `目标 ${targetMinutes} 分钟应有 3–5 场，实际 ${cards.length} 场`);
    }
  }

  return { issues, cards, totalMinutes };
}
