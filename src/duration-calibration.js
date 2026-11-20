const CJK = /[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/g;

export const DURATION_MODEL_V1 = {
  version: "duration-v1",
  actionUnitSeconds: 0.8,
  dialogueCps: 4.5,
  dialogueWps: 2.5,
  dialoguePauseSeconds: 0.4,
  toleranceSeconds: 0.75,
};

const trim = (value) => String(value ?? "").trim();

function dialogueSeconds(block, model) {
  const content = String(block?.text || block?.content || "");
  const cjk = (content.match(CJK) || []).length;
  const latin = content
    .replace(CJK, " ")
    .split(/\s+/)
    .filter(Boolean).length;
  return (
    cjk / model.dialogueCps +
    latin / model.dialogueWps +
    model.dialoguePauseSeconds
  );
}

function sceneMaps(sceneInput) {
  const blocks = new Map(
    (sceneInput.blocks || []).map((block) => [block.id, block]),
  );
  const actionUnits = new Map(
    (sceneInput.blocks || []).flatMap((block) =>
      (block.actionUnits || []).map((unit) => [unit.id, unit]),
    ),
  );
  return { blocks, actionUnits };
}

function referencedContent(shot, sceneInput) {
  const { blocks, actionUnits } = sceneMaps(sceneInput);
  const dialogueBlockIds = new Set();
  const actionUnitIds = new Set();

  for (const clip of shot.clips || []) {
    for (const id of clip.sourceBlockIds || []) {
      const block = blocks.get(id);
      if (block?.kind === "dialogue") dialogueBlockIds.add(id);
      if (block?.kind === "action") {
        for (const unit of block.actionUnits || [{ id: `${id}.1` }]) {
          actionUnitIds.add(unit.id);
        }
      }
    }
    for (const id of clip.actionUnitIds || []) {
      if (actionUnits.has(id)) actionUnitIds.add(id);
    }
  }

  return { blocks, dialogueBlockIds, actionUnitIds };
}

export function estimateShotContentBudget(
  shot,
  sceneInput,
  policy,
  model = DURATION_MODEL_V1,
) {
  const { blocks, dialogueBlockIds, actionUnitIds } = referencedContent(
    shot,
    sceneInput,
  );
  const dialogueSec = [...dialogueBlockIds].reduce(
    (sum, id) => sum + dialogueSeconds(blocks.get(id), model),
    0,
  );
  const actionSec = actionUnitIds.size * model.actionUnitSeconds;
  const contentSec = dialogueSec + actionSec;
  const minimum = Number(policy?.shotMin) || 5;
  const maximum = Number(policy?.shotMax) || 15;
  const suggestedDurationSec = Math.min(
    maximum,
    Math.max(minimum, Math.ceil(contentSec)),
  );
  const actualDurationSec = Number(shot.duration) || 0;
  return {
    dialogueBlocks: dialogueBlockIds.size,
    actionUnits: actionUnitIds.size,
    dialogueSec: Number(dialogueSec.toFixed(2)),
    actionSec: Number(actionSec.toFixed(2)),
    contentSec: Number(contentSec.toFixed(2)),
    suggestedDurationSec,
    actualDurationSec,
    deficitSec: Number(
      Math.max(0, contentSec - actualDurationSec).toFixed(2),
    ),
    slackSec: Number(
      Math.max(0, actualDurationSec - contentSec).toFixed(2),
    ),
    status:
      actualDurationSec + model.toleranceSeconds < contentSec
        ? "short"
        : "fit",
  };
}

export function analyzePlanDurationBudget(
  plan,
  sceneInput,
  policy,
  model = DURATION_MODEL_V1,
) {
  const shots = (plan?.shots || []).map((shot, index) => ({
    shot: index + 1,
    ...estimateShotContentBudget(shot, sceneInput, policy, model),
  }));
  const actualTotal = shots.reduce(
    (sum, shot) => sum + shot.actualDurationSec,
    0,
  );
  const contentTotal = shots.reduce((sum, shot) => sum + shot.contentSec, 0);
  const suggestedTotal = shots.reduce(
    (sum, shot) => sum + shot.suggestedDurationSec,
    0,
  );
  const errors = shots.map(
    (shot) => shot.actualDurationSec - shot.suggestedDurationSec,
  );
  return {
    model,
    shots,
    actualTotal,
    contentTotal: Number(contentTotal.toFixed(2)),
    suggestedTotal,
    contentRatio:
      contentTotal > 0
        ? Number((actualTotal / contentTotal).toFixed(2))
        : 1,
    suggestedRatio:
      suggestedTotal > 0
        ? Number((actualTotal / suggestedTotal).toFixed(2))
        : 1,
    meanAbsError: Number(
      (
        errors.reduce((sum, value) => sum + Math.abs(value), 0) /
        Math.max(1, errors.length)
      ).toFixed(2),
    ),
    bias: Number(
      (errors.reduce((sum, value) => sum + value, 0) / Math.max(1, errors.length)).toFixed(2),
    ),
    shortShots: shots.filter((shot) => shot.status === "short").length,
  };
}

export { dialogueSeconds as estimateDialogueSeconds };
