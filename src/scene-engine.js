import { parseCastLine, splitSpeaker } from "./storyboard.js";
import { buildActionUnits } from "./action-units.js";
import { analyzePlanDurationBudget } from "./duration-calibration.js";
import { bigramSimilarity, flattenText } from "./text-similarity.js";

const trim = (value) => String(value ?? "").trim();

export const DIRECTOR_SCHEMA_VERSION = 2;
export const ACTION_UNIT_SCHEMA_VERSION = 3;

export const STORY_FUNCTIONS = [
  "establish",
  "power",
  "pressure",
  "detail",
  "reaction",
  "shift",
  "impact",
  "aftermath",
  "exit",
];

export const DIRECTOR_BRIEF_FIELDS = [
  "dramaticQuestion",
  "desire",
  "obstacle",
  "powerBefore",
  "powerAfter",
  "informationReveal",
  "visualCore",
  "keyProp",
  "startHook",
  "endHook",
];

export const SCENE_GEOGRAPHY_FIELDS = [
  "anchors",
  "powerPosition",
  "axis",
  "workingSide",
];

const DIRECTOR_SHOT_FIELDS = [
  ["purpose", "缺少镜头职责 purpose"],
  ["storyFunction", "缺少故事功能 storyFunction"],
  ["startState", "缺少起点状态 startState"],
  ["stateChange", "缺少主要状态变化 stateChange"],
  ["endState", "缺少终点状态 endState"],
  ["cameraReason", "缺少运镜理由 cameraReason"],
  ["continuityNote", "缺少连续性说明 continuityNote"],
];

const FAST_ACTION_CUES =
  /击倒|击飞|击退|击中|撞击|砸|破裂|破碎|爆炸|喷火|扔|掷|跃起|跳|扑|冲刺|逃出|飞离|飞出|倒地|吐血|扶住|站起|转身|推开|拔剑|挥剑|挥拳|冲入|跑入|奔跑|施法|挡住|抵挡|大喊|咆哮|展开|张开/gu;
const STATE_TURN_CUES =
  /倒地|站起|扶住|跑入|冲入|进入|离开|转身|击中|破裂|破碎|飞离|逃出|袭来|反击|突袭|然而|但|随后|接着|终于/gu;

export const SCENE_PLAN_POLICIES = {
  strict3: {
    label: "3 Clip / 4秒下限",
    shotMin: 5,
    shotMax: 15,
    clipMin: 4,
    clipMax: 15,
    maxClips: 3,
    wideMaxPct: 15,
    dialogueCps: 4.5,
    dialogueWps: 2.5,
    dialoguePauseSec: 0.4,
    actionBlockSec: 0.8,
    loadToleranceSec: 0.5,
    dialogueSizes: ["CU", "MCU", "ECU"],
    allowGroupMasterDialogue: false,
    dialogueSizeRule:
      "含对白的 Clip 只能使用 `CU`、`MCU` 或 `ECU`；不得使用 `MS`、`FS`、`WS`、`EWS` 承载对白。",
    cameraGuidance:
      "中景及以上镜头只用于建立空间、动作锚点、道具信息或转场，全场合计尽量不超过 15%。对白优先用近景，运镜以稳定、清楚为第一原则。",
  },
  flexible6: {
    label: "6 Clip / 2秒下限",
    shotMin: 5,
    shotMax: 15,
    clipMin: 2,
    clipMax: 8,
    maxClips: 6,
    wideMaxPct: 30,
    dialogueCps: 4.5,
    dialogueWps: 2.5,
    dialoguePauseSec: 0.4,
    actionBlockSec: 0.8,
    loadToleranceSec: 0.5,
    dialogueSizes: ["CU", "MCU", "ECU", "MS"],
    allowGroupMasterDialogue: true,
    dialogueSizeRule:
      "对白优先使用 `CU`、`MCU` 或 `ECU`。多人对话可保留一个用于交代人物关系的群像镜头，并允许其中包含一句短对白；其余对白仍应切到近景。",
    cameraGuidance:
      "镜头选择服务叙事，不机械规定某类镜头只能做什么。按建立空间、强调信息、制造压迫、追随动作、表现反应等目的选择景别和运镜；允许合理的跟拍、横移、甩镜、俯仰、变焦和主观镜头。短促动作可用 2–4 秒的插入镜头，但不得连续堆叠同质镜头，中景及以上全场合计不超过 30%。",
  },
};

export function getScenePlanPolicy(name = "strict3") {
  return SCENE_PLAN_POLICIES[name] || SCENE_PLAN_POLICIES.strict3;
}

export function renderScenePlanPrompt(template, policy = SCENE_PLAN_POLICIES.strict3) {
  return String(template)
    .replaceAll("{{shotMin}}", String(policy.shotMin))
    .replaceAll("{{shotMax}}", String(policy.shotMax))
    .replaceAll("{{clipMin}}", String(policy.clipMin))
    .replaceAll("{{clipMax}}", String(policy.clipMax))
    .replaceAll("{{maxClips}}", String(policy.maxClips))
    .replaceAll("{{dialogueSizeRule}}", policy.dialogueSizeRule)
    .replaceAll("{{cameraGuidance}}", policy.cameraGuidance);
}

function sourceBlock(block, index) {
  const id = `B${String(index + 1).padStart(2, "0")}`;
  if (block.kind === "dialogue") {
    return {
      id,
      kind: "dialogue",
      speaker: block.name,
      tone: block.tone,
      text: block.content,
      source: `${block.name}（${block.tone}）：${block.content}`,
    };
  }
  return {
    id,
    kind: block.kind,
    text: block.text,
    source: block.text,
    ...(block.kind === "action"
      ? { actionUnits: buildActionUnits(block.text, id) }
      : {}),
  };
}

export function estimateBlockSeconds(block, policy = SCENE_PLAN_POLICIES.strict3) {
  if (block.kind !== "dialogue") {
    return (block.actionUnits?.length || 1) * policy.actionBlockSec;
  }
  const content = String(block.text || block.content || "");
  const cjk = (content.match(/[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/g) || []).length;
  const latin = content
    .replace(/[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
  return cjk / policy.dialogueCps + latin / policy.dialogueWps + policy.dialoguePauseSec;
}

function knownSceneCastNames(sceneInput) {
  const explicit = Array.isArray(sceneInput?.castNames) ? sceneInput.castNames : [];
  const speakers = (sceneInput?.blocks || [])
    .filter((block) => block.kind === "dialogue")
    .map((block) => splitSpeaker(block.speaker).name)
    .filter(Boolean);
  return [...new Set([...explicit, ...speakers].map(trim).filter(Boolean))];
}

function canonicalCast(rawName, knownCast, repairs) {
  const value = trim(rawName);
  const normalized = splitSpeaker(value).name;
  if (knownCast.includes(value)) return [value];
  if (knownCast.includes(normalized)) {
    if (normalized !== value) {
      repairs.push(`人物「${value}」统一为「${normalized}」`);
    }
    return [normalized];
  }

  const stem = normalized.replace(/(?:们|群像)$/u, "");
  const exactStem = knownCast.find(
    (known) => splitSpeaker(known).name === stem,
  );
  if (exactStem) {
    repairs.push(`人物「${value}」统一为「${exactStem}」`);
    return [exactStem];
  }

  const matches = knownCast.filter((known) => {
    const knownName = splitSpeaker(known).name;
    return knownName.endsWith(normalized) || normalized.endsWith(knownName);
  });
  if (matches.length === 1) {
    repairs.push(`人物「${value}」统一为「${matches[0]}」`);
    return matches[0];
  }

  const disciples = knownCast.filter((known) => splitSpeaker(known).name.endsWith("弟子"));
  if (/弟子/u.test(normalized) && disciples.length) {
    repairs.push(`人物「${value}」展开为「${disciples.join("、")}」`);
    return disciples;
  }

  const crowd = knownCast.find((known) => splitSpeaker(known).name === "村民群像");
  if (
    crowd &&
    /^(?:村民|人群|围观群众|年轻女子|老妇人|老人|小孩|孩子)$/u.test(normalized)
  ) {
    repairs.push(`人物「${value}」并入「${crowd}」`);
    return [crowd];
  }

  if (/^(?:龙|巨龙)$/u.test(normalized)) {
    const dragon = knownCast.find((known) => splitSpeaker(known).name.endsWith("龙"));
    if (dragon) {
      repairs.push(`人物「${value}」统一为「${dragon}」`);
      return [dragon];
    }
  }

  return [value];
}

function splitOversizedShots(plan, policy, repairs) {
  const output = [];
  for (const original of plan.shots || []) {
    const clips = original.clips || [];
    const total = clips.reduce((sum, clip) => sum + Number(clip.duration || 0), 0);
    if (total <= policy.shotMax || clips.length < 2) {
      output.push(original);
      continue;
    }

    let remaining = [...clips];
    const parts = [];
    while (
      remaining.reduce((sum, clip) => sum + Number(clip.duration || 0), 0) >
        policy.shotMax &&
      remaining.length > 1
    ) {
      let best = null;
      for (let cut = 1; cut < remaining.length; cut += 1) {
        const left = remaining.slice(0, cut);
        const right = remaining.slice(cut);
        const leftDuration = left.reduce(
          (sum, clip) => sum + Number(clip.duration || 0),
          0,
        );
        const rightDuration = right.reduce(
          (sum, clip) => sum + Number(clip.duration || 0),
          0,
        );
        if (leftDuration < policy.shotMin || leftDuration > policy.shotMax) continue;
        const rightInvalid =
          rightDuration < policy.shotMin || rightDuration > policy.shotMax ? 1 : 0;
        const score =
          rightInvalid * 100 +
          Math.abs(leftDuration - (policy.shotMin + policy.shotMax) / 2);
        if (!best || score < best.score) {
          best = { cut, left, right, leftDuration, score };
        }
      }
      if (!best) break;
      parts.push({
        clips: best.left,
        duration: best.leftDuration,
      });
      remaining = best.right;
    }
    parts.push({
      clips: remaining,
      duration: remaining.reduce(
        (sum, clip) => sum + Number(clip.duration || 0),
        0,
      ),
    });

    if (parts.length === 1) {
      output.push(original);
      continue;
    }

    const before = total;
    parts.forEach((part, index) => {
      const previousPart = index > 0 ? parts[index - 1] : null;
      const previousClip = previousPart?.clips.at(-1);
      output.push({
        ...original,
        duration: part.duration,
        startState:
          index === 0
            ? original.startState || original.startPosition
            : `承接上一镜结尾：${
                trim(previousClip?.visualAction) ||
                trim(original.startState) ||
                trim(original.startPosition)
              }`,
        startPosition:
          index === 0
            ? original.startPosition || original.startState
            : `承接上一镜结尾：${
                trim(previousClip?.visualAction) ||
                trim(original.startPosition) ||
                trim(original.startState)
              }`,
        clips: part.clips,
      });
    });
    repairs.push(
      `shot 时长 ${before} 超过 ${policy.shotMax}，在 Clip 边界拆为 ${parts
        .map((part) => `${part.duration}`)
        .join(" + ")} 秒`,
    );
  }
  plan.shots = output;
}

function ensureSplitPartDuration(clips, policy) {
  let sum = clips.reduce((total, clip) => total + Number(clip.duration || 0), 0);
  let need = Math.max(0, policy.shotMin - sum);
  for (let index = clips.length - 1; index >= 0 && need > 0; index -= 1) {
    const clip = clips[index];
    const room = Math.max(0, policy.clipMax - Number(clip.duration || 0));
    const add = Math.min(room, need);
    clip.duration = Number(clip.duration || 0) + add;
    need -= add;
    sum += add;
  }
  return need === 0 ? sum : 0;
}

function splitComplexActionShots(plan, sceneInput, policy, repairs) {
  const split = (shot, depth = 0) => {
    const clips = shot.clips || [];
    const audit = shotActionAudit(shot, sceneInput);
    if (!audit.complexActionByShot || clips.length < 2 || depth >= 8) {
      return [shot];
    }

    let best = null;
    for (let cut = 1; cut < clips.length; cut += 1) {
      const left = structuredClone(clips.slice(0, cut));
      const right = structuredClone(clips.slice(cut));
      const leftDuration = ensureSplitPartDuration(left, policy);
      const rightDuration = ensureSplitPartDuration(right, policy);
      if (
        !leftDuration ||
        !rightDuration ||
        leftDuration > policy.shotMax ||
        rightDuration > policy.shotMax
      ) {
        continue;
      }
      const score = Math.abs(leftDuration - rightDuration);
      if (!best || score < best.score) {
        best = {
          left,
          right,
          leftDuration,
          rightDuration,
          score,
        };
      }
    }
    if (!best) {
      return [shot];
    }

    repairs.push(
      `动作密度过高：shot ${shot.shotIndex || "?"} 在 Clip 边界拆为 ${best.leftDuration} + ${best.rightDuration} 秒`,
    );
    const makePart = (partClips, duration, index, previousClip) => {
      const previousAction = trim(previousClip?.visualAction);
      const firstAction = trim(partClips[0]?.visualAction);
      const lastAction = trim(partClips.at(-1)?.visualAction);
      return {
        ...shot,
        duration,
        purpose: `${trim(shot.purpose)}：${firstAction || `动作阶段 ${index + 1}`}`,
        startState:
          index === 0
            ? shot.startState
            : `承接上一镜结尾：${previousAction}；本镜从${firstAction || "下一动作阶段"}开始。`,
        startPosition:
          index === 0
            ? shot.startPosition
            : `承接上一镜结尾：${previousAction}`,
        stateChange: lastAction || trim(shot.stateChange),
        endState: lastAction || trim(shot.endState),
        continuityNote:
          index === 0
            ? shot.continuityNote
            : `承接上一镜结尾：${previousAction}；按动作阶段拆镜后继续，本镜结束交给下一镜。`,
        clips: partClips,
      };
    };
    const leftShot = makePart(best.left, best.leftDuration, 0);
    const rightShot = makePart(
      best.right,
      best.rightDuration,
      1,
      best.left.at(-1),
    );
    return [
      ...split(leftShot, depth + 1),
      ...split(rightShot, depth + 1),
    ];
  };
  plan.shots = (plan.shots || []).flatMap((shot) => split(shot));
}

function inferClipReferences(clip, sceneInput) {
  const blockIds = new Set(
    Array.isArray(clip.sourceBlockIds) ? clip.sourceBlockIds : [],
  );
  const actionUnitIds = new Set(
    Array.isArray(clip.actionUnitIds) ? clip.actionUnitIds : [],
  );
  if (blockIds.size && actionUnitIds.size) {
    return { blockIds: [], actionUnitIds: [] };
  }

  const visual = flattenText(clip.visualAction);
  if (visual.length < 4) return { blockIds: [], actionUnitIds: [] };
  const inferredBlocks = [];
  const inferredUnits = [];
  for (const block of sceneInput.blocks || []) {
    const blockText = flattenText(block.text || block.source);
    if (
      !blockIds.size &&
      block.kind !== "action" &&
      blockText.length >= 4 &&
      (visual.includes(blockText) ||
        (blockText.includes(visual) && visual.length >= 8))
    ) {
      inferredBlocks.push(block.id);
      continue;
    }
    if (actionUnitIds.size || block.kind !== "action") continue;
    const wholeBlockMatches =
      blockText.length >= 4 &&
      (visual.includes(blockText) ||
        (blockText.includes(visual) && visual.length >= 8));
    if (wholeBlockMatches) {
      inferredUnits.push(
        ...(block.actionUnits || []).map((unit) => unit.id),
      );
    }
  }
  return {
    blockIds: [...new Set(inferredBlocks)],
    actionUnitIds: [...new Set(inferredUnits)],
  };
}

function normalizeDialogueContinuations(shot, blockMap, repairs) {
  const firstOwner = new Map();
  for (let index = 0; index < (shot.clips || []).length; index += 1) {
    const clip = shot.clips[index];
    const sourceIds = Array.isArray(clip.sourceBlockIds)
      ? clip.sourceBlockIds
      : [];
    const continuationIds = new Set(
      Array.isArray(clip.dialogueContinuationIds)
        ? clip.dialogueContinuationIds
        : [],
    );
    const kept = [];
    for (const id of sourceIds) {
      if (blockMap.get(id)?.kind !== "dialogue") {
        kept.push(id);
        continue;
      }
      const owner = firstOwner.get(id);
      if (owner === undefined) {
        firstOwner.set(id, index);
        kept.push(id);
      } else if (owner === index) {
        repairs.push(`同一 Clip 重复引用的台词 ${id} 已去重`);
      } else {
        continuationIds.add(id);
        repairs.push(
          `长台词 ${id} 在同 shot 后续 Clip 标为台词延续，不重复编译`,
        );
      }
    }
    clip.sourceBlockIds = kept;
    if (continuationIds.size) {
      clip.dialogueContinuationIds = [...continuationIds];
    }
  }
}

function splitOverloadedActionClips(shot, sceneInput, policy, repairs) {
  const blocks = new Map(
    (sceneInput.blocks || []).map((block) => [block.id, block]),
  );
  const units = new Map(
    (sceneInput.blocks || []).flatMap((block) =>
      (block.actionUnits || []).map((unit) => [unit.id, unit]),
    ),
  );
  const output = [];
  for (const clip of shot.clips || []) {
    const sourceBlockIds = Array.isArray(clip.sourceBlockIds)
      ? clip.sourceBlockIds
      : [];
    const actionUnitIds = Array.isArray(clip.actionUnitIds)
      ? clip.actionUnitIds
      : [];
    const hasDialogue = sourceBlockIds.some(
      (id) => blocks.get(id)?.kind === "dialogue",
    );
    const contentLoad =
      sourceBlockIds.reduce(
        (sum, id) => {
          const block = blocks.get(id);
          return block ? sum + estimateBlockSeconds(block, policy) : sum;
        },
        0,
      ) +
      actionUnitIds.reduce(
        (sum, id) => (units.has(id) ? sum + policy.actionBlockSec : sum),
        0,
      );
    // 单个 Clip 的最大可承载量（含容差）。
    const clipCapacity = policy.clipMax + policy.loadToleranceSec;
    if (contentLoad <= clipCapacity) {
      output.push(clip);
      continue;
    }
    // 纯动作路径保持原有行为：按「一屏能放下的动作单元数」等分，时长按 load+容差 取整。
    if (!hasDialogue) {
      const maxUnitsPerClip = Math.max(
        1,
        Math.floor(clipCapacity / policy.actionBlockSec),
      );
      if (actionUnitIds.length <= maxUnitsPerClip) {
        output.push(clip);
        continue;
      }
      const groups = [];
      for (let index = 0; index < actionUnitIds.length; index += maxUnitsPerClip) {
        groups.push(actionUnitIds.slice(index, index + maxUnitsPerClip));
      }
      const splitClips = groups.map((group, index) => {
        const load = group.reduce(
          (sum, id) => (units.has(id) ? sum + policy.actionBlockSec : sum),
          0,
        );
        const duration = Math.min(
          policy.clipMax,
          Math.max(policy.clipMin, Math.ceil(load + policy.loadToleranceSec)),
        );
        return {
          ...clip,
          duration,
          visualAction: group
            .map((id) => trim(units.get(id)?.text))
            .filter(Boolean)
            .join("；"),
          actionUnitIds: group,
          beat: trim(clip.beat)
            ? `${trim(clip.beat)} ${index + 1}/${groups.length}`
            : trim(clip.beat),
        };
      });
      if (
        splitClips.some((item) => !trim(item.visualAction)) ||
        splitClips.length > policy.maxClips
      ) {
        output.push(clip);
        continue;
      }
      repairs.push(
        `Clip ${clip.letter || "?"} 内容 ${contentLoad.toFixed(1)}s 超过 ${policy.clipMax}s，在动作微单元边界拆为 ${splitClips
          .map((item) => item.duration)
          .join(" + ")} 秒`,
      );
      output.push(...splitClips);
      continue;
    }
    // 按「总负载」决定要拆几段，而不是只看动作单元数：
    // 长台词单独就能把 Clip 撑爆，此时没有动作单元也不该整段放过。
    const wantedParts = Math.max(2, Math.ceil(contentLoad / clipCapacity));
    if (wantedParts > policy.maxClips) {
      output.push(clip);
      continue;
    }
    // 没有足够动作单元时（纯台词镜），按画面描述的分句均分。
    let textParts = null;
    if (actionUnitIds.length < wantedParts) {
      const clauses = trim(clip.visualAction)
        .split(/[，。；]/)
        .map(trim)
        .filter(Boolean);
      if (clauses.length < wantedParts) {
        output.push(clip);
        continue;
      }
      const per = Math.ceil(clauses.length / wantedParts);
      textParts = [];
      for (let i = 0; i < wantedParts; i += 1) {
        const group = clauses.slice(i * per, (i + 1) * per);
        if (!group.length) {
          textParts = null;
          break;
        }
        textParts.push(group.join("，"));
      }
      if (!textParts) {
        output.push(clip);
        continue;
      }
    }
    const perGroup = Math.ceil(actionUnitIds.length / wantedParts) || 0;
    const otherDuration = (shot.clips || []).reduce(
      (sum, other) => (other === clip ? sum : sum + Number(other.duration || 0)),
      0,
    );
    const groups = [];
    if (textParts) {
      for (let index = 0; index < wantedParts; index += 1) groups.push([]);
      // 文本拆分不按动作单元切，原有动作单元全部归首段，避免「源内容未覆盖」。
      groups[0] = actionUnitIds.slice();
    } else {
      for (let index = 0; index < actionUnitIds.length; index += perGroup) {
        groups.push(actionUnitIds.slice(index, index + perGroup));
      }
    }
    const splitClips = groups.map((group, index) => {
      const load = group.reduce(
        (sum, id) => (units.has(id) ? sum + policy.actionBlockSec : sum),
        0,
      );
      // 台词被复制到每段，编译时归一到首段、后续段标为承接，负载按段数均摊。
      const shared = contentLoad - actionUnitIds.reduce(
        (sum, id) => (units.has(id) ? sum + policy.actionBlockSec : sum),
        0,
      );
      const perClipLoad = load + shared / groups.length;
      const duration = Math.min(
        policy.clipMax,
        Math.max(policy.clipMin, Math.ceil(perClipLoad - policy.loadToleranceSec)),
      );
      return {
        ...clip,
        duration,
        visualAction: textParts
          ? textParts[index]
          : group
              .map((id) => trim(units.get(id)?.text))
              .filter(Boolean)
              .join("；"),
        actionUnitIds: group,
        beat: trim(clip.beat)
          ? `${trim(clip.beat)} ${index + 1}/${groups.length}`
          : trim(clip.beat),
      };
    });
    if (
      splitClips.some((item) => !trim(item.visualAction)) ||
      splitClips.length > policy.maxClips ||
      splitClips.reduce((sum, item) => sum + Number(item.duration || 0), 0) >
        policy.shotMax - otherDuration
    ) {
      output.push(clip);
      continue;
    }
    repairs.push(
      `Clip ${clip.letter || "?"} 内容 ${contentLoad.toFixed(1)}s 超过 ${policy.clipMax}s，在动作微单元边界拆为 ${splitClips
        .map((item) => item.duration)
        .join(" + ")} 秒`,
    );
    output.push(...splitClips);
  }
  shot.clips = output;
}

/** 给云端模型的最小、可追溯场景输入。 */
export function buildSceneInput({
  episode,
  scene,
  previousEnd = "",
  nextScene = "",
  policy = SCENE_PLAN_POLICIES.strict3,
  directorBrief = null,
  sceneGeography = null,
}) {
  const blocks = scene.blocks.map(sourceBlock);
  const castNames = [
    ...parseCastLine(scene.cast || "").map((item) => item.name),
    ...blocks
      .filter((block) => block.kind === "dialogue")
      .map((block) => splitSpeaker(block.speaker).name),
  ].filter(Boolean);
  const input = {
    aspectRatio: "9:16",
    sceneId: scene.key,
    episode: `第${episode.no}集${episode.title ? `：${episode.title}` : ""}`,
    sceneHeading: scene.place,
    cast: scene.cast || "",
    castNames: [...new Set(castNames)],
    previousEnd: trim(previousEnd),
    nextScene: trim(nextScene),
    estimatedSeconds: Math.ceil(blocks.reduce((sum, block) => sum + estimateBlockSeconds(block, policy), 0)),
    blocks,
  };
  if (directorBrief) input.directorBrief = directorBrief;
  if (sceneGeography) input.sceneGeography = sceneGeography;
  return input;
}

export function renderSceneInput(sceneInput) {
  const modelBlocks = (sceneInput.blocks || []).map((block) => {
    if (block.kind === "dialogue") {
      return {
        id: block.id,
        kind: block.kind,
        speaker: block.speaker,
        tone: block.tone,
        text: block.text,
      };
    }
    if (block.kind === "action") {
      return {
        id: block.id,
        kind: block.kind,
        text: block.text,
        actionUnits: (block.actionUnits || []).map((unit) => ({
          id: unit.id,
          text: unit.text,
        })),
      };
    }
    return {
      id: block.id,
      kind: block.kind,
      text: block.text,
    };
  });
  const stable = {
    aspectRatio: sceneInput.aspectRatio,
    sceneId: sceneInput.sceneId,
    episode: sceneInput.episode,
    sceneHeading: sceneInput.sceneHeading,
    castNames: sceneInput.castNames,
    ...(sceneInput.directorBrief
      ? { directorBrief: sceneInput.directorBrief }
      : {}),
    ...(sceneInput.sceneGeography
      ? { sceneGeography: sceneInput.sceneGeography }
      : {}),
  };
  const chunk = {
    ...(sceneInput.chunkIndex ? { chunkIndex: sceneInput.chunkIndex } : {}),
    ...(sceneInput.chunkCount ? { chunkCount: sceneInput.chunkCount } : {}),
    ...(sceneInput.previousEnd ? { previousEnd: sceneInput.previousEnd } : {}),
    ...(sceneInput.nextScene ? { nextScene: sceneInput.nextScene } : {}),
    estimatedSeconds: sceneInput.estimatedSeconds,
    blocks: modelBlocks,
  };
  return JSON.stringify({ ...stable, ...chunk }, null, 2);
}

/**
 * 把长场按源块预算切成连续的小规划单元。
 * 不切断源块；如果单个源块本身就超预算，会单独成段并交给校验标记风险。
 */
export function splitSceneInput(
  sceneInput,
  {
    targetSeconds = 20,
    maxBlocks = 22,
    policy = SCENE_PLAN_POLICIES.strict3,
  } = {},
) {
  const groups = [];
  let current = [];
  let load = 0;

  const flush = () => {
    if (!current.length) return;
    groups.push({ blocks: current, estimatedSeconds: Math.ceil(load) });
    current = [];
    load = 0;
  };

  for (const block of sceneInput.blocks || []) {
    const add = estimateBlockSeconds(block, policy);
    if (current.length && (load + add > targetSeconds || current.length >= maxBlocks)) flush();
    current.push(block);
    load += add;
  }
  flush();

  return groups.map((group, index) => {
    const next = groups[index + 1];
    const previous = groups[index - 1];
    const nextPreview = next
      ? next.blocks
          .slice(0, 4)
          .map((block) => block.source)
          .join("\n")
          .slice(0, 700)
      : sceneInput.nextScene;
    return {
      ...sceneInput,
      chunkIndex: index + 1,
      chunkCount: groups.length,
      estimatedSeconds: group.estimatedSeconds,
      nextScene: nextPreview,
      previousEnd:
        index === 0
          ? sceneInput.previousEnd
          : previous.blocks
              .slice(-3)
              .map((block) => block.source)
              .join("\n")
              .slice(-700),
      blocks: group.blocks,
    };
  });
}

export function mergeScenePlans(plans, sceneId, context = {}) {
  const schemaVersion = Math.max(
    0,
    ...plans.map((plan) => Number(plan?.schemaVersion) || 0),
    Number(context.schemaVersion) || 0,
  );
  const directorBrief =
    context.directorBrief || plans.find((plan) => plan?.directorBrief)?.directorBrief || null;
  const sceneGeography =
    context.sceneGeography ||
    plans.find((plan) => plan?.sceneGeography)?.sceneGeography ||
    null;
  return {
    sceneId,
    ...(schemaVersion ? { schemaVersion } : {}),
    ...(directorBrief ? { directorBrief } : {}),
    ...(sceneGeography ? { sceneGeography } : {}),
    shots: plans.flatMap((plan) => plan.shots || []).map((shot, index) => ({
      ...shot,
      shotIndex: index + 1,
    })),
  };
}

/**
 * 确定性修正模型的轻量漂移：人物短名、Clip 过短、shot 不足 5 秒。
 * 不处理需要重写画面的语义问题；修不了的留给校验器报错。
 */
export function repairScenePlan(plan, sceneInput, policy = SCENE_PLAN_POLICIES.strict3) {
  const next = structuredClone(plan);
  const knownCast = knownSceneCastNames(sceneInput);
  const knownCastLongestFirst = [...knownCast].sort((a, b) => b.length - a.length);
  const actionUnitMap = new Map(
    (sceneInput.blocks || []).flatMap((block) =>
      (block.actionUnits || []).map((unit) => [unit.id, unit]),
    ),
  );
  const blockMap = new Map(
    (sceneInput.blocks || []).map((block) => [block.id, block]),
  );
  const repairs = [];

  for (const shot of next.shots || []) {
    shot.cast = [
      ...new Set(
        (shot.cast || []).flatMap((name) => canonicalCast(name, knownCast, repairs)),
      ),
    ];

    const sourceText = [
      shot.startState,
      shot.startPosition,
      shot.purpose,
      shot.stateChange,
      shot.endState,
      shot.cameraReason,
      shot.continuityNote,
      ...(shot.clips || []).flatMap((clip) => [
        clip.visualAction,
        ...(clip.actionUnitIds || [])
          .map((id) => actionUnitMap.get(id)?.text)
          .filter(Boolean),
        ...(clip.sourceBlockIds || [])
          .map((id) => (sceneInput.blocks || []).find((block) => block.id === id)?.source)
          .filter(Boolean),
      ]),
    ]
      .filter(Boolean)
      .join("；");
    let unmatchedText = sourceText;
    for (const name of knownCastLongestFirst) {
      if (!unmatchedText.includes(name)) continue;
      if (!shot.cast.includes(name)) {
        shot.cast.push(name);
        repairs.push(`从源块补回人物「${name}」`);
      }
      unmatchedText = unmatchedText.replaceAll(name, " ");
    }

    for (const clip of shot.clips || []) {
      const inferred = inferClipReferences(clip, sceneInput);
      if (inferred.blockIds.length) {
        clip.sourceBlockIds = inferred.blockIds;
        repairs.push(
          `Clip ${clip.letter || "?"} 从可见动作原文回填源块 ${inferred.blockIds.join("、")}`,
        );
      }
      if (inferred.actionUnitIds.length) {
        clip.actionUnitIds = inferred.actionUnitIds;
        repairs.push(
          `Clip ${clip.letter || "?"} 从可见动作原文回填动作微单元 ${inferred.actionUnitIds.join("、")}`,
        );
      }
    }

    normalizeDialogueContinuations(shot, blockMap, repairs);

    for (const clip of shot.clips || []) {
      const blocks = (clip.sourceBlockIds || [])
        .map((id) => (sceneInput.blocks || []).find((block) => block.id === id))
        .filter(Boolean);
      const dialogueContinuations = (clip.dialogueContinuationIds || [])
        .map((id) => blockMap.get(id))
        .filter(Boolean);
      const hasDialogue =
        blocks.some((block) => block.kind === "dialogue") ||
        dialogueContinuations.length > 0;
      const wideSize = ["MS", "FS", "WS", "EWS"].includes(trim(clip.size).toUpperCase());
      if (hasDialogue && wideSize) {
        const target =
          policy.allowGroupMasterDialogue && shot.cast.length >= 3 ? "MS" : "MCU";
        repairs.push(`含台词的 ${trim(clip.size)} 改为 ${target}`);
        clip.size = target;
      }
      // 负载口径必须与 validateScenePlan 一致：台词块（含承接）+ 动作单元。
      // 之前只统计 sourceBlockIds，漏掉 dialogueContinuationIds 和 actionUnitIds，
      // 导致审计报超载、修复却认为装得下，一句话都不改。
      const actorUnitIds = Array.isArray(clip.actionUnitIds) ? clip.actionUnitIds : [];
      const countedIds = new Set([
        ...(clip.sourceBlockIds || []),
        ...(clip.dialogueContinuationIds || []),
      ]);
      const load =
        [...countedIds].reduce((sum, id) => {
          const block = blockMap.get(id);
          return block ? sum + estimateBlockSeconds(block, policy) : sum;
        }, 0) +
        actorUnitIds.reduce((sum) => sum + policy.actionBlockSec, 0);
      const wanted = Math.max(
        policy.clipMin,
        Number.isFinite(Number(clip.duration)) ? Number(clip.duration) : policy.clipMin,
        // 审计通过的条件是 load ≤ duration + tolerance，取 ceil(load - tolerance) 即最小可通过时长。
        Math.ceil(load - policy.loadToleranceSec),
      );
      if (wanted <= policy.clipMax && wanted !== clip.duration) {
        repairs.push(`Clip ${clip.letter || "?"} 时长 ${clip.duration}→${wanted} 秒`);
        clip.duration = wanted;
      }
    }

    splitOverloadedActionClips(shot, sceneInput, policy, repairs);
    // 拆分会把同一句台词复制到每一段，这里再归一一次：
    // 首段保留源引用，后续段标为台词承接，保证只编译一条 EN。
    normalizeDialogueContinuations(shot, blockMap, repairs);

    let sum = (shot.clips || []).reduce((total, clip) => total + Number(clip.duration || 0), 0);
    if (sum < policy.shotMin) {
      let need = policy.shotMin - sum;
      for (let index = (shot.clips || []).length - 1; index >= 0 && need > 0; index -= 1) {
        const clip = shot.clips[index];
        const room = Math.max(0, policy.clipMax - Number(clip.duration || 0));
        const add = Math.min(room, need);
        if (add > 0) {
          repairs.push(`Clip ${clip.letter || "?"} 补足 ${add} 秒以保持 shot 最短时长`);
          clip.duration = Number(clip.duration || 0) + add;
          need -= add;
        }
      }
      sum = shot.clips.reduce((total, clip) => total + Number(clip.duration || 0), 0);
    }
    if (sum !== shot.duration) {
      repairs.push(`shot 时长 ${shot.duration}→${sum} 秒`);
      shot.duration = sum;
    }
  }
  splitComplexActionShots(next, sceneInput, policy, repairs);
  splitOversizedShots(next, policy, repairs);

  return { plan: next, repairs };
}

function betterArbitration(a, b) {
  if (!b) return true;
  if (a.invalid !== b.invalid) return a.invalid < b.invalid;
  if (a.overSeconds !== b.overSeconds) return a.overSeconds < b.overSeconds;
  if (a.shortSeconds !== b.shortSeconds) return a.shortSeconds < b.shortSeconds;
  if (a.deviation !== b.deviation) return a.deviation < b.deviation;
  return a.count < b.count;
}

/**
 * 成片时长裁决：只在完整 shot 之间下刀，不拆动作，不删内容。
 * 目标是把每集装进 75–105 秒；无法避免短集时保留并明确标出。
 */
export function arbitrateShotTimeline(
  shots,
  { minSeconds = 75, midSeconds = 90, maxSeconds = 105 } = {},
) {
  const list = (shots || []).map((shot, index) => ({
    ...shot,
    sourceIndex: index,
    duration: Number(shot.duration) || 0,
  }));
  const n = list.length;
  const dp = Array(n + 1).fill(null);
  dp[0] = { invalid: 0, overSeconds: 0, shortSeconds: 0, deviation: 0, count: 0, start: -1 };

  for (let end = 1; end <= n; end += 1) {
    let duration = 0;
    for (let start = end - 1; start >= 0; start -= 1) {
      duration += list[start].duration;
      if (duration > maxSeconds && start < end - 1) break;
      if (!dp[start]) continue;
      const overSeconds = Math.max(0, duration - maxSeconds);
      const shortSeconds = Math.max(0, minSeconds - duration);
      const candidate = {
        invalid: dp[start].invalid + (overSeconds > 0 || shortSeconds > 0 ? 1 : 0),
        overSeconds: dp[start].overSeconds + overSeconds,
        shortSeconds: dp[start].shortSeconds + shortSeconds,
        deviation: dp[start].deviation + Math.abs(duration - midSeconds),
        count: dp[start].count + 1,
        start,
      };
      if (betterArbitration(candidate, dp[end])) dp[end] = candidate;
    }
  }

  if (!dp[n]) {
    return {
      groups: [],
      issues: [{ level: "高", where: "时间裁决", msg: "无法在 shot 边界完成时长分组" }],
      stats: { episodes: 0, totalDuration: 0, inWindow: 0, short: 0, over: 0 },
    };
  }

  const ranges = [];
  let cursor = n;
  while (cursor > 0) {
    const start = dp[cursor].start;
    ranges.unshift({
      start,
      end: cursor,
      shots: list.slice(start, cursor).map((shot, index) => ({ ...shot, shotIndex: index + 1 })),
    });
    cursor = start;
  }

  const issues = [];
  const groups = ranges.map((range, index) => {
    const duration = range.shots.reduce((sum, shot) => sum + shot.duration, 0);
    const status = duration < minSeconds ? "short" : duration > maxSeconds ? "over" : "fit";
    if (status !== "fit") {
      issues.push({
        level: status === "over" ? "高" : "中",
        where: `提案第${index + 1}集`,
        msg: `时长 ${duration}s 不在 ${minSeconds}–${maxSeconds}s`,
      });
    }
    return {
      no: index + 1,
      duration,
      status,
      firstShotIndex: range.start,
      lastShotIndex: range.end - 1,
      shots: range.shots,
    };
  });

  return {
    groups,
    issues,
    stats: {
      episodes: groups.length,
      totalDuration: groups.reduce((sum, group) => sum + group.duration, 0),
      inWindow: groups.filter((group) => group.status === "fit").length,
      short: groups.filter((group) => group.status === "short").length,
      over: groups.filter((group) => group.status === "over").length,
    },
  };
}

export function parseScenePlan(raw) {
  const text = trim(raw)
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("模型输出中没有找到 JSON 对象");
  const objectText = text.slice(start, end + 1);
  let repaired = "";
  let inString = false;
  let escaped = false;
  for (let index = 0; index < objectText.length; index += 1) {
    const char = objectText[index];
    if (inString) {
      repaired += char;
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
      repaired += char;
      continue;
    }
    if (char === ",") {
      let lookahead = index + 1;
      while (/\s/.test(objectText[lookahead] || "")) lookahead += 1;
      if (objectText[lookahead] === "}" || objectText[lookahead] === "]") {
        continue;
      }
    }
    repaired += char;
  }
  return JSON.parse(repaired);
}

export function validateDirectorBrief(
  directorBrief,
  sceneGeography,
  sceneId = "scene",
) {
  const issues = [];
  const add = (level, where, msg) => issues.push({ level, where, msg });

  if (!directorBrief || typeof directorBrief !== "object") {
    add("高", sceneId, "缺少导演提示单 directorBrief");
  } else {
    for (const field of DIRECTOR_BRIEF_FIELDS) {
      if (!trim(directorBrief[field])) {
        add("高", sceneId, `导演提示单缺少 ${field}`);
      }
    }
  }

  if (!sceneGeography || typeof sceneGeography !== "object") {
    add("高", sceneId, "缺少场景地理 sceneGeography");
  } else {
    if (
      !Array.isArray(sceneGeography.anchors) ||
      !sceneGeography.anchors.map(trim).filter(Boolean).length
    ) {
      add("高", sceneId, "场景地理缺少 anchors");
    }
    for (const field of SCENE_GEOGRAPHY_FIELDS.filter((item) => item !== "anchors")) {
      if (!trim(sceneGeography[field])) {
        add("高", sceneId, `场景地理缺少 ${field}`);
      }
    }
  }

  return { issues };
}

export function analyzeDirectorFields(plan) {
  const shots = Array.isArray(plan?.shots) ? plan.shots : [];
  const count = (field) => shots.filter((shot) => trim(shot?.[field])).length;
  const validFunctions = shots.filter((shot) =>
    STORY_FUNCTIONS.includes(trim(shot?.storyFunction)),
  ).length;
  const completeShots = shots.filter((shot) =>
    DIRECTOR_SHOT_FIELDS.every(([field]) => trim(shot?.[field])),
  ).length;
  const percent = (value) =>
    shots.length ? Number(((value / shots.length) * 100).toFixed(1)) : 0;
  return {
    schemaVersion: Number(plan?.schemaVersion) || 0,
    shots: shots.length,
    completeShots,
    completePct: percent(completeShots),
    purpose: count("purpose"),
    storyFunction: count("storyFunction"),
    validStoryFunction: validFunctions,
    startState: count("startState"),
    stateChange: count("stateChange"),
    endState: count("endState"),
    cameraReason: count("cameraReason"),
    continuityNote: count("continuityNote"),
    hasDirectorBrief: Boolean(plan?.directorBrief),
    hasSceneGeography: Boolean(plan?.sceneGeography),
  };
}

function shotActionAudit(shot, sceneInput) {
  const sourceBlocks = new Map(
    (sceneInput.blocks || []).map((block) => [block.id, block]),
  );
  const actionUnits = new Map(
    (sceneInput.blocks || []).flatMap((block) =>
      (block.actionUnits || []).map((unit) => [unit.id, unit]),
    ),
  );
  const sourceIds = [
    ...new Set(
      (shot.clips || []).flatMap((clip) => [
        ...(clip.sourceBlockIds || []),
        ...(clip.actionUnitIds || []),
      ]),
    ),
  ];
  const actionText = [
    shot.stateChange,
    ...(shot.clips || []).map((clip) => clip.visualAction),
    ...sourceIds.map(
      (id) => actionUnits.get(id)?.text || sourceBlocks.get(id)?.source || "",
    ),
  ]
    .filter(Boolean)
    .join("；");
  const stateClauses = trim(shot.stateChange)
    .split(/[；;]|(?:，|,)?(?:随后|接着|然后|转而|与此同时|同时)/u)
    .map(trim)
    .filter(Boolean);
  const fastActionCount = (actionText.match(FAST_ACTION_CUES) || []).length;
  const turnCount = (actionText.match(STATE_TURN_CUES) || []).length;
  const clips = shot.clips || [];
  const durations = clips
    .map((clip) => Number(clip.duration))
    .filter((duration) => Number.isFinite(duration) && duration > 0);
  const totalClipSeconds = durations.reduce((sum, duration) => sum + duration, 0);
  const averageClipSeconds = durations.length
    ? Number((totalClipSeconds / durations.length).toFixed(2))
    : 0;
  const sourceBlockCount = sourceIds.length;
  const knownCast = knownSceneCastNames(sceneInput);
  const compoundCameraClips = clips
    .map((clip, index) => {
      const visualAction = trim(clip.visualAction);
      const actionPhrases = visualAction
        .split(/[；;]|(?:，|,)?(?:随后|随即|接着|然后|继而|同时|并(?=[把将朝向抬转说走跑站扶]))/u)
        .map(trim)
        .filter(Boolean);
      const fastActions = (visualAction.match(FAST_ACTION_CUES) || []).length;
      const mentionedCast = knownCast.filter((name) => visualAction.includes(name));
      const duration = Number(clip.duration) || 0;
      return {
        letter: String.fromCharCode(65 + index),
        cameraMove: trim(clip.cameraMove),
        visualAction,
        duration,
        actionPhrases: actionPhrases.length,
        fastActions,
        mentionedCast: mentionedCast.length,
        denseAction:
          (actionPhrases.length >= 3 &&
            (mentionedCast.length >= 2 || fastActions >= 3)) ||
          (duration > 0 &&
            duration <= 3 &&
            actionPhrases.length >= 2 &&
            fastActions >= 2 &&
            mentionedCast.length >= 2),
      };
    });
  const denseActionClips = compoundCameraClips.filter((clip) => clip.denseAction);
  const compoundCameraClipsOnly = compoundCameraClips.filter(({ cameraMove }) =>
    /(?:后|再|并|同时)(?:固定|推|拉|摇|移|跟|切|升|降|环绕)/u.test(cameraMove),
  );
  const complexActionByShot =
    sourceBlockCount >= 4 &&
    clips.length >= 3 &&
    averageClipSeconds > 0 &&
    averageClipSeconds < 2.9 &&
    (stateClauses.length >= 2 || (turnCount >= 2 && fastActionCount >= 3));
  const complexAction = complexActionByShot || denseActionClips.length > 0;
  return {
    sourceBlockCount,
    clipCount: clips.length,
    totalClipSeconds,
    averageClipSeconds,
    stateClauses: stateClauses.length,
    fastActionCount,
    turnCount,
    complexAction,
    complexActionByShot,
    denseActionClips,
    compoundCameraClips: compoundCameraClipsOnly,
  };
}

/**
 * 按 Seedance 2.0 官方提示词指南检查动作转折：
 * - 复杂快速动作适合分段生成后再剪辑；
 * - 优先连续、缓慢、可看懂的细微动作；
 * - 不把“15 秒上限”当成必须填满的目标。
 */
export function auditShotActionDensity(plan, sceneInput) {
  const issues = [];
  const shots = [];
  for (let index = 0; index < (plan?.shots || []).length; index += 1) {
    const shot = plan.shots[index];
    const audit = shotActionAudit(shot, sceneInput);
    const where = `${sceneInput.sceneId} shot${index + 1}`;
    if (audit.complexActionByShot) {
      issues.push({
        level: "高",
        where,
        msg:
          `动作密度过高：${audit.clipCount} 个 Clip / ${audit.totalClipSeconds}s，` +
          `平均 ${audit.averageClipSeconds}s，检测到 ${audit.stateClauses} 个状态分句。` +
          "按 Seedance 2.0 官方指南，应在动作/剧情转折处拆镜；不要把时长直接填满 15 秒。",
      });
    }
    for (const clip of audit.denseActionClips) {
      issues.push({
        level: "高",
        where: `${where} Clip ${clip.letter}`,
        msg:
          `单个 Clip 动作阶段过载：${clip.duration}s 内检测到 ${clip.actionPhrases} 个动作分句、` +
          `${clip.fastActions} 个动作提示。应在此 Clip 内按动作阶段继续切分；` +
          "如果每个阶段不足最短可读时长，则拆成独立 shot。",
      });
    }
    for (const clip of audit.compoundCameraClips) {
      issues.push({
        level: "中",
        where: `${where} Clip ${clip.letter}`,
        msg: `单个镜头包含复合运镜「${clip.cameraMove}」；官方建议一个 shot 只指定一种主要运镜`,
      });
    }
    shots.push({ shot: index + 1, ...audit });
  }
  return {
    issues,
    shots,
    complexShots: shots.filter((shot) => shot.complexAction).length,
    denseActionClips: shots.reduce(
      (sum, shot) => sum + shot.denseActionClips.length,
      0,
    ),
    compoundCameraMoves: issues.filter((issue) => /复合运镜/.test(issue.msg)).length,
  };
}

function shotReferenceSet(shot) {
  return new Set(
    (shot.clips || []).flatMap((clip) => [
      ...(clip.sourceBlockIds || []),
      ...(clip.actionUnitIds || []),
    ]),
  );
}

function intersectionSize(left, right) {
  let count = 0;
  for (const value of left) if (right.has(value)) count += 1;
  return count;
}

function jaccardScore(left, right) {
  if (!left.size && !right.size) return 0;
  const intersection = intersectionSize(left, right);
  return intersection / (left.size + right.size - intersection);
}

/**
 * 检测镜头职责重复。完全重复报高；高度相似但可能补充了信息的报中。
 * 不自动删除镜头。
 */
export function auditShotResponsibilities(plan) {
  const issues = [];
  const shots = plan?.shots || [];
  const pairs = [];
  for (let leftIndex = 0; leftIndex < shots.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < shots.length; rightIndex += 1) {
      const left = shots[leftIndex];
      const right = shots[rightIndex];
      const leftPurpose = trim(left.purpose);
      const rightPurpose = trim(right.purpose);
      const leftChange = trim(left.stateChange);
      const rightChange = trim(right.stateChange);
      const leftEnd = trim(left.endState);
      const rightEnd = trim(right.endState);
      const leftAction = (left.clips || []).map((clip) => clip.visualAction).join("；");
      const rightAction = (right.clips || []).map((clip) => clip.visualAction).join("；");
      const purposeScore = bigramSimilarity(leftPurpose, rightPurpose);
      const changeScore = bigramSimilarity(leftChange, rightChange);
      const endScore = bigramSimilarity(leftEnd, rightEnd);
      const actionScore = bigramSimilarity(leftAction, rightAction);
      const castScore = jaccardScore(
        new Set(left.cast || []),
        new Set(right.cast || []),
      );
      const sharedRefs = intersectionSize(
        shotReferenceSet(left),
        shotReferenceSet(right),
      );
      const exactPurpose =
        flattenText(leftPurpose) &&
        flattenText(leftPurpose) === flattenText(rightPurpose);
      const exactState =
        flattenText(leftChange) &&
        flattenText(leftChange) === flattenText(rightChange);
      const exactAction =
        flattenText(leftAction) &&
        flattenText(leftAction) === flattenText(rightAction);
      const sameFunction =
        trim(left.storyFunction) === trim(right.storyFunction);
      const high =
        sharedRefs > 0 ||
        exactPurpose ||
        exactState ||
        exactAction;
      const medium =
        !high &&
        (purposeScore >= 0.72 ||
          (sameFunction &&
            actionScore >= 0.78 &&
            changeScore >= 0.5 &&
            endScore >= 0.45) ||
          (trim(left.storyFunction) === "reaction" &&
            trim(right.storyFunction) === "reaction" &&
            actionScore >= 0.7 &&
            castScore >= 0.5));
      if (!high && !medium) continue;
      const where = `shot${leftIndex + 1} / shot${rightIndex + 1}`;
      if (high) {
        issues.push({
          level: "高",
          where,
          msg:
            sharedRefs > 0
              ? `两个镜头重复引用 ${sharedRefs} 个源动作/台词，同一内容被拍了两遍`
              : "两个镜头职责或动作描述完全相同，应合并或删除重复镜头",
        });
      } else {
        issues.push({
          level: "中",
          where,
          msg:
            `镜头职责高度相似（职责 ${(purposeScore * 100).toFixed(0)}%，` +
            `动作 ${(actionScore * 100).toFixed(0)}%）；需确认后一镜是否带来新信息或新状态`,
        });
      }
      pairs.push({
        left: leftIndex + 1,
        right: rightIndex + 1,
        purposeScore: Number(purposeScore.toFixed(2)),
        changeScore: Number(changeScore.toFixed(2)),
        endScore: Number(endScore.toFixed(2)),
        actionScore: Number(actionScore.toFixed(2)),
        castScore: Number(castScore.toFixed(2)),
        sharedRefs,
        level: high ? "高" : "中",
      });
    }
  }
  return { issues, pairs };
}

function postureOf(text) {
  const value = trim(text);
  const postures = [
    ["倒地", /倒地|倒下|躺倒/],
    ["躺", /躺在|躺着/],
    ["跪", /跪在|跪着|跪倒/],
    ["坐", /坐在|坐着|坐回/],
    ["蹲", /蹲在|蹲着/],
    ["站", /站在|站着|站起|起身/],
  ];
  return postures.find(([, pattern]) => pattern.test(value))?.[0] || "";
}

const GENERIC_CONTINUITY =
  /^(?:无|无变化|保持不变|同上|沿用上一镜(?:结尾)?(?:状态)?)[。.]?$/u;
const TRANSITION_CUE =
  /场首|承接|继续|保持|切至|转到|跳转|时间|地点|省略|蒙太奇|入画|进入|走进|走入|跑进|跑入|冲入|出现在|离开|离场|出画|走出|跑出|退开|放下|交给|接过|收起|坐下|跪下|站起|起身/u;

/**
 * 检查上一镜终点能否接住下一镜起点。
 * 只报告确定性冲突和缺少承接说明，不替代导演做艺术判断。
 */
export function auditShotContinuity(plan, sceneInput) {
  const issues = [];
  const shots = plan?.shots || [];
  const transitions = [];
  const add = (level, where, msg) => issues.push({ level, where, msg });

  for (let index = 0; index < shots.length; index += 1) {
    const shot = shots[index];
    const note = trim(shot.continuityNote);
    const where = `shot${index + 1}`;
    if (index === 0) {
      if (!note.includes("场首")) {
        add("中", where, "首镜 continuityNote 应明确写“场首”并交代初始空间状态");
      }
      continue;
    }

    const previous = shots[index - 1];
    const previousEnd = trim(previous.endState);
    const start = trim(shot.startState);
    const transitionText = [
      note,
      start,
      ...(shot.clips || []).map((clip) => clip.visualAction),
    ]
      .filter(Boolean)
      .join("；");
    const prevCast = new Set(previous.cast || []);
    const nextCast = new Set(shot.cast || []);
    const entering = [...nextCast].filter((name) => !prevCast.has(name));
    const leaving = [...prevCast].filter((name) => !nextCast.has(name));
    const previousPosture = postureOf(previousEnd);
    const nextPosture = postureOf(start);
    const declaredTransition = TRANSITION_CUE.test(note);
    const stateScore = bigramSimilarity(previousEnd, start);
    let pairIssues = 0;

    if (!note || GENERIC_CONTINUITY.test(note)) {
      add(
        "高",
        where,
        "continuityNote 为空或使用“同上/沿用上一镜”等通用说明，无法验证承接",
      );
      pairIssues += 1;
    }

    if (
      previousPosture &&
      nextPosture &&
      previousPosture !== nextPosture &&
      !note.includes(nextPosture)
    ) {
      add(
        "高",
        where,
        `人物姿势从上一镜“${previousPosture}”变为“${nextPosture}”，但没有来源动作、时间跳转或省略说明`,
      );
      pairIssues += 1;
    }

    if (!declaredTransition && stateScore < 0.12) {
      const sharedCast = [...nextCast].filter((name) => prevCast.has(name));
      if (!sharedCast.length) {
        add(
          "中",
          where,
          "上一镜 endState 与本镜 startState 没有可见承接，且没有声明时间、地点或转场",
        );
        pairIssues += 1;
      }
    }

    transitions.push({
      from: index,
      to: index + 1,
      stateScore: Number(stateScore.toFixed(2)),
      previousPosture,
      nextPosture,
      entering,
      leaving,
      declaredTransition,
      issues: pairIssues,
    });
  }

  return { issues, transitions };
}

export function validateScenePlan(plan, sceneInput, policy = SCENE_PLAN_POLICIES.strict3) {
  const issues = [];
  const blocks = new Map((sceneInput.blocks || []).map((block) => [block.id, block]));
  const actionUnits = new Map();
  for (const block of sceneInput.blocks || []) {
    for (const unit of block.actionUnits || []) actionUnits.set(unit.id, unit);
  }
  const inputHasActionUnits = actionUnits.size > 0;
  const knownCast = new Set(knownSceneCastNames(sceneInput));
  const used = new Map();
  const usedActionUnits = new Map();
  let overloadedClips = 0;
  const add = (level, where, msg) => issues.push({ level, where, msg });

  if (!plan || typeof plan !== "object") {
    add("高", sceneInput.sceneId, "镜头规划不是对象");
    return { issues, stats: { shots: 0, clips: 0, blocks: blocks.size } };
  }
  if (plan.sceneId && plan.sceneId !== sceneInput.sceneId) {
    add("高", sceneInput.sceneId, `sceneId 不匹配：${plan.sceneId}`);
  }
  const directorSchema = Number(plan.schemaVersion) >= DIRECTOR_SCHEMA_VERSION;
  const actionSchema = Number(plan.schemaVersion) >= ACTION_UNIT_SCHEMA_VERSION;
  const directorContext = Boolean(
    sceneInput.directorBrief && sceneInput.sceneGeography,
  );
  if (directorContext && inputHasActionUnits && !actionSchema) {
    add("高", sceneInput.sceneId, "输入已包含动作微单元，镜头计划必须使用 schemaVersion 3");
  }
  if (directorSchema) {
    const brief = validateDirectorBrief(
      plan.directorBrief || sceneInput.directorBrief,
      plan.sceneGeography || sceneInput.sceneGeography,
      sceneInput.sceneId,
    );
    issues.push(...brief.issues);
  }
  if (!Array.isArray(plan.shots) || !plan.shots.length) {
    add("高", sceneInput.sceneId, "没有 shots");
  }

  const dialogueReferenceCounts = new Map();
  for (const shot of plan.shots || []) {
    for (const clip of shot.clips || []) {
      const dialogueIds = new Set([
        ...(Array.isArray(clip?.sourceBlockIds) ? clip.sourceBlockIds : []),
        ...(Array.isArray(clip?.dialogueContinuationIds)
          ? clip.dialogueContinuationIds
          : []),
      ]);
      for (const id of dialogueIds) {
        if (blocks.get(id)?.kind === "dialogue") {
          dialogueReferenceCounts.set(
            id,
            (dialogueReferenceCounts.get(id) || 0) + 1,
          );
        }
      }
    }
  }

  let clipCount = 0;
  let totalDuration = 0;
  for (let si = 0; si < (plan.shots || []).length; si += 1) {
    const shot = plan.shots[si];
    const where = `${sceneInput.sceneId} shot${si + 1}`;
    const seenShotDialogue = new Set();
    const shotDuration = Number(shot?.duration);
    if (Number.isFinite(shotDuration)) totalDuration += shotDuration;
    if (
      !Number.isInteger(shotDuration) ||
      shotDuration < policy.shotMin ||
      shotDuration > policy.shotMax
    ) {
      add("高", where, `shot 时长 ${shotDuration || "?"} 不在 ${policy.shotMin}–${policy.shotMax}`);
    }
    if (!trim(shot?.startPosition) && !trim(shot?.startState)) {
      add("中", where, "缺少 startPosition/startState");
    }
    if (directorSchema) {
      for (const [field, message] of DIRECTOR_SHOT_FIELDS) {
        if (!trim(shot?.[field])) add("高", where, message);
      }
      if (
        trim(shot?.storyFunction) &&
        !STORY_FUNCTIONS.includes(trim(shot.storyFunction))
      ) {
        add(
          "高",
          where,
          `storyFunction「${trim(shot.storyFunction)}」不在允许值：${STORY_FUNCTIONS.join("、")}`,
        );
      }
      if (
        trim(shot?.startState) &&
        trim(shot?.endState) &&
        trim(shot.startState) === trim(shot.endState)
      ) {
        add("中", where, "startState 与 endState 完全相同，需确认本镜是否真的有状态变化");
      }
    }
    if (!Array.isArray(shot?.cast)) {
      add("高", where, "缺少 shot 级 cast");
    } else {
      for (const name of shot.cast) {
        if (!knownCast.has(name)) add("高", where, `出现未登记人物：${name}`);
      }
    }
    if (!Array.isArray(shot?.clips) || !shot.clips.length) {
      add("高", where, "没有 clips");
      continue;
    }
    if (shot.clips.length > policy.maxClips) {
      add("高", where, `Clip 数 ${shot.clips.length} 超过 ${policy.maxClips}`);
    }

    let sum = 0;
    for (let ci = 0; ci < shot.clips.length; ci += 1) {
      const clip = shot.clips[ci];
      const cwhere = `${where} Clip ${String.fromCharCode(65 + ci)}`;
      clipCount += 1;
      const duration = Number(clip?.duration);
      if (!Number.isInteger(duration) || duration < policy.clipMin || duration > policy.clipMax) {
        add("高", cwhere, `Clip 时长 ${duration || "?"} 不在 ${policy.clipMin}–${policy.clipMax}`);
      } else {
        sum += duration;
      }
      if (!trim(clip?.visualAction)) add("中", cwhere, "缺少 visualAction");
      if (!trim(clip?.cameraMove)) add("中", cwhere, "缺少 cameraMove");
      const blockIds = Array.isArray(clip?.sourceBlockIds) ? clip.sourceBlockIds : [];
      const actionUnitIds = Array.isArray(clip?.actionUnitIds) ? clip.actionUnitIds : [];
      const continuationIds = Array.isArray(clip?.dialogueContinuationIds)
        ? clip.dialogueContinuationIds
        : [];
      if (
        (!blockIds.length && !actionUnitIds.length && !continuationIds.length) ||
        (!actionSchema && !blockIds.length)
      ) {
        add(
          "高",
          cwhere,
          actionSchema
            ? "没有 sourceBlockIds/actionUnitIds/dialogueContinuationIds"
            : "没有 sourceBlockIds",
        );
      }
      for (const id of blockIds) {
        if (!blocks.has(id)) {
          add("高", cwhere, `引用不存在的源块 ${id}`);
          continue;
        }
        if (actionSchema && blocks.get(id)?.kind === "action") {
          add("高", cwhere, `action schema v3 必须用 actionUnitIds 引用动作块 ${id}`);
        }
        used.set(id, (used.get(id) || 0) + 1);
        if (blocks.get(id)?.kind === "dialogue") seenShotDialogue.add(id);
      }
      for (const id of continuationIds) {
        const block = blocks.get(id);
        if (!block) {
          add("高", cwhere, `引用不存在的台词延续块 ${id}`);
          continue;
        }
        if (block.kind !== "dialogue") {
          add("高", cwhere, `台词延续引用 ${id} 不是台词块`);
          continue;
        }
        if (!seenShotDialogue.has(id)) {
          add("高", cwhere, `台词延续 ${id} 之前没有同 shot 的源引用`);
        }
      }
      for (const unitId of actionUnitIds) {
        if (!actionUnits.has(unitId)) {
          add("高", cwhere, `引用不存在的动作微单元 ${unitId}`);
          continue;
        }
        usedActionUnits.set(unitId, (usedActionUnits.get(unitId) || 0) + 1);
      }
      const ids = blockIds;
      const dialogueIds = new Set([...blockIds, ...continuationIds]);
      const hasDialogue = [...dialogueIds].some(
        (id) => blocks.get(id)?.kind === "dialogue",
      );
      const size = trim(clip?.size).toUpperCase();
      const groupMasterDialogue =
        policy.allowGroupMasterDialogue &&
        size === "MS" &&
        Array.isArray(shot.cast) &&
        shot.cast.length >= 3;
      if (hasDialogue && !policy.dialogueSizes.includes(size) && !groupMasterDialogue) {
        add("中", cwhere, `含台词的 Clip 使用了 ${trim(clip?.size) || "未知景别"}`);
      }
      for (const id of ids) {
        const block = blocks.get(id);
        if (block?.kind !== "dialogue") continue;
        const speaker = trim(block.speaker).replace(/（[^）]+）\s*$/, "");
        if (!(shot.cast || []).includes(speaker)) {
          add("高", cwhere, `说话人 ${speaker} 未列入 shot 出场人物`);
        }
      }
      const estimatedLoad =
        [...dialogueIds].reduce((sum, id) => {
          const block = blocks.get(id);
          if (!block) return sum;
          const share =
            block.kind === "dialogue"
              ? Math.max(1, dialogueReferenceCounts.get(id) || 1)
              : 1;
          return sum + estimateBlockSeconds(block, policy) / share;
        }, 0) +
        actionUnitIds.reduce(
          (sum, id) => (actionUnits.has(id) ? sum + policy.actionBlockSec : sum),
          0,
        );
      if (Number.isFinite(duration) && estimatedLoad > duration + policy.loadToleranceSec) {
        overloadedClips += 1;
        add(
          "高",
          cwhere,
          `内容预算约 ${estimatedLoad.toFixed(1)}s，超过 Clip 时长 ${duration}s`,
        );
      }
    }
    if (Number.isInteger(shotDuration) && sum !== shotDuration) {
      add("高", where, `Clip 加总 ${sum}s ≠ shot ${shotDuration}s`);
    }
  }

  if (actionSchema) {
    const missingDialogue = [...blocks.values()]
      .filter((block) => block.kind === "dialogue" && !used.has(block.id))
      .map((block) => block.id);
    const missingOther = [...blocks.values()]
      .filter(
        (block) =>
          !["action", "dialogue"].includes(block.kind) && !used.has(block.id),
      )
      .map((block) => block.id);
    const missingUnits = [...actionUnits.keys()].filter(
      (id) => !usedActionUnits.has(id),
    );
    const duplicateUnits = [...usedActionUnits.entries()]
      .filter(([, count]) => count > 1)
      .map(([id]) => id);
    const duplicateDialogue = [...used.entries()]
      .filter(
        ([id, count]) =>
          count > 1 && blocks.get(id)?.kind === "dialogue",
      )
      .map(([id]) => id);
    if (
      missingDialogue.length ||
      missingOther.length ||
      missingUnits.length ||
      duplicateDialogue.length
    ) {
      add(
        "高",
        sceneInput.sceneId,
        `源内容未覆盖：${[
          ...missingDialogue,
          ...missingOther,
          ...missingUnits,
        ].join("、")}${
          duplicateDialogue.length
            ? `；台词重复引用：${duplicateDialogue.join("、")}`
            : ""
        }`,
      );
    }
    if (duplicateUnits.length) {
      add(
        "高",
        sceneInput.sceneId,
        `动作微单元重复引用：${duplicateUnits.join("、")}`,
      );
    }
  } else {
    const missing = [...blocks.keys()].filter((id) => !used.has(id));
    const duplicate = [...used.entries()]
      .filter(([, count]) => count > 1)
      .map(([id]) => id);
    if (missing.length) add("高", sceneInput.sceneId, `源块未覆盖：${missing.join("、")}`);
    if (duplicate.length) {
      add("高", sceneInput.sceneId, `源块重复引用：${duplicate.join("、")}`);
    }
  }

  const allClips = (plan.shots || []).flatMap((shot) => shot.clips || []);
  const wide = allClips.filter((clip) =>
    ["MS", "FS", "WS", "EWS"].includes(trim(clip.size).toUpperCase()),
  ).length;
  const widePct = allClips.length ? (wide / allClips.length) * 100 : 0;
  if (widePct > policy.wideMaxPct) {
    add("中", sceneInput.sceneId, `中景及以上占比 ${widePct.toFixed(1)}% 超过 ${policy.wideMaxPct}%`);
  }
  if (directorSchema) {
    issues.push(...auditShotActionDensity(plan, sceneInput).issues);
    issues.push(...auditShotResponsibilities(plan).issues);
    issues.push(...auditShotContinuity(plan, sceneInput).issues);
  }
  if (actionSchema) {
    const durationAudit = analyzePlanDurationBudget(plan, sceneInput, policy);
    for (const shot of durationAudit.shots) {
      if (shot.status === "short") {
        add(
          "高",
          `${sceneInput.sceneId} shot${shot.shot}`,
          `内容预算约 ${shot.contentSec}s，超过 shot 时长 ${shot.actualDurationSec}s`,
        );
      }
    }
  }

  return {
    issues,
    stats: {
      shots: (plan.shots || []).length,
      clips: clipCount,
      blocks: blocks.size,
      widePct: Number(widePct.toFixed(1)),
      overloadedClips,
      totalDuration,
    },
  };
}

function quoteDialogue(text) {
  return `"${trim(text).replaceAll('"', '\\"')}"`;
}

/** 用源文回填台词，把模型计划编译成当前项目的正式分镜格式。 */
export function compileScenePlan(plan, sceneInput, startShotNo = 1) {
  const blocks = new Map((sceneInput.blocks || []).map((block) => [block.id, block]));
  const castMap = new Map(parseCastLine(sceneInput.cast || "").map((item) => [item.name, item]));
  const chunks = [];

  for (let si = 0; si < (plan.shots || []).length; si += 1) {
    const shot = plan.shots[si];
    const shotNo = startShotNo + si;
    const cast = (shot.cast || [])
      .map((name) => {
        const item = castMap.get(name);
        if (!item) return name;
        const meta = [item.full, item.dress ? `着装：${item.dress}` : ""].filter(Boolean).join("，");
        return meta ? `${item.name}（${meta}）` : item.name;
      })
      .join("、");
    const props = Array.isArray(shot.props) && shot.props.length ? shot.props.join("、") : "无";
    const lines = [
      `【分镜${String(shotNo).padStart(2, "0")}】`,
      `[shot${String(shotNo).padStart(2, "0")} | 时长：${Number(shot.duration)}秒 | 场景：${sceneInput.sceneHeading} | 人物：${cast || "无"} | 道具：${props}]`,
      "人物空间位置：",
      trim(shot.startState) || trim(shot.startPosition) || "沿用上一镜结尾状态。",
    ];

    for (let ci = 0; ci < (shot.clips || []).length; ci += 1) {
      const clip = shot.clips[ci];
      const letter = String.fromCharCode(65 + ci);
      const size = trim(clip.size).toUpperCase() || "MS";
      lines.push(`Clip ${letter} | 时长：${Number(clip.duration)}秒 | 景别：${size}`);
      lines.push(
        `CAMERA: ${trim(clip.cameraMove) || "固定机位"} / ${size}. ${trim(clip.visualAction)}`,
      );
      for (const id of clip.sourceBlockIds || []) {
        const block = blocks.get(id);
        if (block?.kind === "dialogue") {
          lines.push(`EN: ${block.speaker}: ${quoteDialogue(block.text)}`);
        }
      }
    }
    chunks.push(lines.join("\n"));
  }
  return chunks.join("\n\n");
}

