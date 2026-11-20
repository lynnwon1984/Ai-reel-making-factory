const trim = (value) => String(value ?? "").trim();

const SHOT_REFERENCE = /\b(?:shot|分镜)\s*(\d+)\b/gi;

function cloneShot(shot, index) {
  return {
    shotIndex: index + 1,
    ...structuredClone(shot),
  };
}

function issueShotIndexes(issues) {
  const indexes = new Set();
  for (const issue of issues || []) {
    const where = String(issue?.where || "");
    for (const match of where.matchAll(SHOT_REFERENCE)) {
      const index = Number(match[1]);
      if (Number.isInteger(index) && index > 0) indexes.add(index);
    }
  }
  return [...indexes].sort((left, right) => left - right);
}

function compactShotForPrompt(shot, index) {
  return {
    shotIndex: index + 1,
    ...structuredClone(shot),
  };
}

function contiguousRanges(indexes) {
  const ranges = [];
  for (const index of indexes) {
    const previous = ranges.at(-1);
    if (previous && index === previous.end + 1) {
      previous.end = index;
    } else {
      ranges.push({ start: index, end: index });
    }
  }
  return ranges;
}

/**
 * 从校验结果定位真正需要重写的 shot。
 * 只有无法落到具体 shot 的规则才进入 globalIssues，交给模型在同一修复任务中一并处理。
 */
export function collectShotRepairTargets(plan, issues) {
  const totalShots = (plan?.shots || []).length;
  let targetIndexes = issueShotIndexes(issues).filter(
    (index) => index <= totalShots,
  );
  let fallback = "";
  if (!targetIndexes.length && totalShots && (issues || []).length) {
    const mentionedRefs = new Set(
      (issues || [])
        .flatMap((issue) =>
          String(issue?.msg || "").match(/\bB\d+(?:\.\d+)?\b/g) || [],
        ),
    );
    const referenced = [];
    for (let index = 0; index < (plan.shots || []).length; index += 1) {
      const refs = new Set(
        (plan.shots[index].clips || []).flatMap((clip) => [
          ...(clip.sourceBlockIds || []),
          ...(clip.actionUnitIds || []),
        ]),
      );
      if ([...mentionedRefs].some((ref) => refs.has(ref))) {
        referenced.push(index + 1);
      }
    }
    targetIndexes = referenced;
    fallback = referenced.length ? "mentioned-source" : "whole-plan";
    if (!targetIndexes.length) {
      targetIndexes = Array.from({ length: totalShots }, (_, index) => index + 1);
    }
  }
  const targetSet = new Set(targetIndexes);
  const globalIssues = (issues || []).filter((issue) => {
    const where = String(issue?.where || "");
    return ![...where.matchAll(SHOT_REFERENCE)].some(
      (match) => Number(match[1]) <= totalShots,
    );
  });
  const contextIndexes = new Set();
  for (const index of targetIndexes) {
    if (index > 1) contextIndexes.add(index - 1);
    if (index < totalShots) contextIndexes.add(index + 1);
  }
  for (const index of targetSet) contextIndexes.delete(index);

  return {
    totalShots,
    targetIndexes,
    ranges: contiguousRanges(targetIndexes),
    contextIndexes: [...contextIndexes].sort((left, right) => left - right),
    targetedIssues: (issues || []).filter((issue) =>
      [...String(issue?.where || "").matchAll(SHOT_REFERENCE)].some((match) =>
        targetSet.has(Number(match[1])),
      ),
    ),
    globalIssues,
    fallback,
  };
}

/**
 * 只为问题 shot 构造修复输入。完整源切片仍在输入中，便于本地校验覆盖；
 * 不再把整版镜头计划重新发给模型，也禁止模型重写未命中的正确镜头。
 */
export function buildShotRepairRequest({
  initialInput,
  plan,
  issues,
  expectedSchemaVersion,
}) {
  const targets = collectShotRepairTargets(plan, issues);
  if (!targets.targetIndexes.length) throw new Error("计划没有可修复的 shot");

  const targetShots = targets.targetIndexes.map((index) =>
    compactShotForPrompt(plan.shots[index - 1], index),
  );
  const contextShots = targets.contextIndexes.map((index) =>
    compactShotForPrompt(plan.shots[index - 1], index),
  );
  const repairTask = {
    repairProtocol: "shot_replacements_v1",
    sceneId: plan.sceneId,
    schemaVersion: expectedSchemaVersion,
    originalShotCount: targets.totalShots,
    replaceableShotIndexes: targets.targetIndexes,
    replaceableRanges: targets.ranges,
    targetSelection: targets.fallback || "issue-location",
    targetShots,
    contextShots,
    globalIssues: targets.globalIssues,
  };

  return [
    "【原始场景切片】",
    initialInput,
    "",
    "【定点修复任务】",
    JSON.stringify(repairTask, null, 2),
    "",
    "【必须修复的问题】",
    (issues || [])
      .map((issue) => `- [${issue.level}] ${issue.where}: ${issue.msg}`)
      .join("\n"),
    "",
    "【输出协议】",
    "只输出一个合法 JSON 对象，不要 Markdown、代码围栏或解释。",
    "只返回需要替换的问题 shot，不得返回整版镜头计划，不得重写 contextShots。",
    "可以拆分或合并 replaceableRanges 内的 shot；sourceBlockIds/actionUnitIds 仍须全量覆盖且只引用一次。",
    "一条长台词跨多个 Clip 时，首段用 sourceBlockIds，后续段用 dialogueContinuationIds；不得在每个 Clip 重复引用同一条台词。",
    "",
    JSON.stringify(
      {
        repairProtocol: "shot_replacements_v1",
        sceneId: plan.sceneId,
        schemaVersion: expectedSchemaVersion,
        replacements: [
          {
            startShotIndex: targets.targetIndexes[0],
            endShotIndex: targets.targetIndexes[0],
            reason: "对应校验问题",
            shots: ["替换后的完整 shot 对象；可多于或少于原范围"],
          },
        ],
      },
      null,
      2,
    ),
  ].join("\n");
}

/** 与初稿 prompt 分开的修复系统指令，避免“继续输出整版计划”的旧约束抢占。 */
export function renderShotRepairInstructions(
  sceneInstructions,
  expectedSchemaVersion = 3,
) {
  return [
    String(sceneInstructions || ""),
    "",
    "## 定点修复模式（本次调用优先）",
    "你不是在重新生成整场分镜，而是在修复已有计划中的一个或多个问题 shot。",
    `本次要求的 schemaVersion 是 ${expectedSchemaVersion}。只输出 repairs 协议规定的 JSON 替换包，不要输出整版 scene plan。`,
    "targetShots 和 contextShots 都是只读参考；只有 replaceableShotIndexes 允许被替换。",
    "可以在一个替换范围内把 shot 拆分或合并，但必须保持源内容全量覆盖、顺序不变、台词不重复。",
    "不要为了填满 15 秒拉长镜头；内容过载时在动作阶段或动作微单元边界继续拆分。",
  ].join("\n");
}

function requireInteger(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number)) {
    throw new Error(`${label} 必须是整数`);
  }
  return number;
}

/**
 * 把模型的 shot 替换计划合回原计划。
 * 完整计划只作为旧输出漂移的兼容入口，并会在统计里明确标记。
 */
export function applyShotRepairPlan(plan, payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("修复结果不是 JSON 对象");
  }
  if (Array.isArray(payload.shots)) {
    return {
      plan: structuredClone(payload),
      mode: "full-plan-compat",
      replacements: [],
    };
  }
  if (
    payload.repairProtocol !== "shot_replacements_v1" ||
    !Array.isArray(payload.replacements)
  ) {
    throw new Error("修复结果缺少 shot_replacements_v1 协议或 replacements");
  }

  const total = (plan?.shots || []).length;
  const replacements = payload.replacements
    .map((replacement, index) => ({
      startShotIndex: requireInteger(
        replacement?.startShotIndex,
        `replacements[${index}].startShotIndex`,
      ),
      endShotIndex: requireInteger(
        replacement?.endShotIndex,
        `replacements[${index}].endShotIndex`,
      ),
      reason: trim(replacement?.reason),
      shots: Array.isArray(replacement?.shots) ? replacement.shots : [],
    }))
    .sort((left, right) => left.startShotIndex - right.startShotIndex);

  if (!replacements.length) throw new Error("修复结果 replacements 为空");
  for (const replacement of replacements) {
    if (
      replacement.startShotIndex < 1 ||
      replacement.endShotIndex < replacement.startShotIndex ||
      replacement.endShotIndex > total
    ) {
      throw new Error(
        `替换范围 ${replacement.startShotIndex}-${replacement.endShotIndex} 超出 1-${total}`,
      );
    }
    if (!replacement.shots.length) {
      throw new Error(
        `替换范围 ${replacement.startShotIndex}-${replacement.endShotIndex} 没有 shots`,
      );
    }
  }
  for (let index = 1; index < replacements.length; index += 1) {
    if (
      replacements[index].startShotIndex <=
      replacements[index - 1].endShotIndex
    ) {
      throw new Error("修复结果存在重叠的 shot 替换范围");
    }
  }

  const output = [];
  let originalIndex = 1;
  for (const replacement of replacements) {
    while (originalIndex < replacement.startShotIndex) {
      output.push(structuredClone(plan.shots[originalIndex - 1]));
      originalIndex += 1;
    }
    output.push(...replacement.shots.map((shot) => structuredClone(shot)));
    originalIndex = replacement.endShotIndex + 1;
  }
  while (originalIndex <= total) {
    output.push(structuredClone(plan.shots[originalIndex - 1]));
    originalIndex += 1;
  }

  return {
    plan: {
      ...structuredClone(plan),
      shots: output.map((shot, index) => ({
        ...shot,
        shotIndex: index + 1,
      })),
    },
    mode: "shot-replacements",
    replacements: replacements.map((replacement) => ({
      startShotIndex: replacement.startShotIndex,
      endShotIndex: replacement.endShotIndex,
      replacementCount: replacement.shots.length,
      reason: replacement.reason,
    })),
  };
}
