import { parseScript } from "./split.js";
import {
  STABLE_LEAN_SCHEMA_VERSION,
  buildSceneInput,
  compileScenePlan,
  getScenePlanPolicy,
  mergeScenePlans,
  parseScenePlan,
  renderSceneInput,
  renderScenePlanPrompt,
  repairScenePlan,
  splitSceneInput,
  validateScenePlan,
} from "./scene-engine.js";
import { auditHandContinuity } from "./continuity-ledger.js";
import {
  applyShotRepairPlan,
  buildShotRepairRequest,
  renderShotRepairInstructions,
} from "./shot-repair.js";

const trim = (value) => String(value ?? "").trim();

function highIssues(issues) {
  return (issues || []).filter((issue) => issue.level === "高");
}

function issuesText(issues) {
  return (issues || [])
    .map((issue) => `- [${issue.level}] ${issue.where}: ${issue.msg}`)
    .join("\n");
}

function nextSceneText(episode, index) {
  const next = episode.scenes[index + 1];
  if (!next) return "";
  return [next.place, next.cast ? `人物：${next.cast}` : "", ...next.body]
    .filter(Boolean)
    .slice(0, 7)
    .join("\n")
    .slice(0, 900);
}

async function callText(callModel, args) {
  const result = await callModel(args);
  const text = trim(result?.text ?? result);
  if (!text) throw new Error(`${args.label} 没有返回内容`);
  return text;
}

function auditPlan(plan, sceneInput, policy) {
  const validation = validateScenePlan(plan, sceneInput, policy);
  const hand = auditHandContinuity(plan);
  return {
    ...validation,
    issues: [...validation.issues, ...hand.issues],
    handContinuity: hand,
  };
}

async function planChunk({
  chunkInput,
  initialInput,
  instructions,
  callModel,
  policy,
  effort,
  signal,
  label,
  maxRepairRounds,
  onProgress,
  progressMeta,
}) {
  let raw = await callText(callModel, {
    instructions,
    input: initialInput,
    effort,
    label,
    signal,
  });
  let plan = parseScenePlan(raw);
  const local = repairScenePlan(plan, chunkInput, policy);
  plan = local.plan;
  let validation = auditPlan(plan, chunkInput, policy);
  let repairRounds = 0;
  const repairs = [...local.repairs];
  const repairLimit = Math.max(
    0,
    Math.min(2, Number(maxRepairRounds) || 0),
  );

  while (highIssues(validation.issues).length && repairRounds < repairLimit) {
    const repairInput = buildShotRepairRequest({
      initialInput,
      plan,
      issues: validation.issues,
      expectedSchemaVersion: STABLE_LEAN_SCHEMA_VERSION,
    });
    const repairRaw = await callText(callModel, {
      instructions: renderShotRepairInstructions(
        instructions,
        STABLE_LEAN_SCHEMA_VERSION,
      ),
      input: repairInput,
      effort,
      label: `${label} 定点修复 r${repairRounds + 1}`,
      signal,
    });
    repairRounds += 1;
    const payload = parseScenePlan(repairRaw);
    const applied = applyShotRepairPlan(plan, payload);
    const repaired = repairScenePlan(applied.plan, chunkInput, policy);
    plan = repaired.plan;
    repairs.push(...repaired.repairs);
    validation = auditPlan(plan, chunkInput, policy);
    onProgress?.({
      stage: "repair",
      repair: repairRounds,
      high: highIssues(validation.issues).length,
      ...progressMeta,
    });
  }

  return { plan, validation, repairs, repairRounds };
}

/**
 * 稳定链路 v5：
 * 动作微单元计划 → 本地编译 → 零模型校验 → 失败 shot 定点修复。
 *
 * 与实验引擎的区别：不生成导演提示单，不要求完整导演字段，
 * 不再让模型直接写最终 Markdown。
 */
export async function runStableV5Script({
  text,
  planInstructions,
  callModel,
  policyName = "strict3",
  effort = "low",
  signal,
  labelPrefix = "稳定 v5",
  maxRepairRounds = 2,
  maxBlocksPerChunk = 40,
  chunkSeconds = 180,
  completedScenes = {},
  onSceneComplete,
  onEpisodeComplete,
  onProgress,
}) {
  const parsed = parseScript(text);
  if (!parsed.episodes.length) {
    throw new Error("稳定 v5 没有识别到任何「第N集」");
  }
  const policy = getScenePlanPolicy(policyName);
  const instructions = renderScenePlanPrompt(planInstructions, policy);
  const outputEpisodes = [];
  const episodeStats = [];
  const allIssues = [];

  for (const episode of parsed.episodes) {
    const sceneTexts = [];
    const scenes = [];
    let shotOffset = 1;
    let previousEnd = "";

    for (let index = 0; index < episode.scenes.length; index += 1) {
      const scene = episode.scenes[index];
      const cacheKey = `${episode.no}:${scene.key}`;
      const cached = completedScenes[cacheKey];
      if (cached) {
        const result = cached;
        sceneTexts.push(result.sceneText);
        scenes.push(result.stats);
        shotOffset += result.stats.validation?.stats?.shots || 0;
        previousEnd = trim(
          result.stats.lastEndState || previousEnd,
        );
        continue;
      }

      const baseInput = buildSceneInput({
        episode,
        scene,
        previousEnd,
        nextScene: nextSceneText(episode, index),
        policy,
        requiredSchemaVersion: STABLE_LEAN_SCHEMA_VERSION,
      });
      const chunks = splitSceneInput(baseInput, {
        targetSeconds: Math.max(30, Number(chunkSeconds) || 180),
        maxBlocks: Math.max(10, Number(maxBlocksPerChunk) || 40),
        policy,
      });
      const plans = [];
      const chunkStats = [];

      for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex += 1) {
        const chunkInput = chunks[chunkIndex];
        const initialInput = renderSceneInput(chunkInput);
        onProgress?.({
          stage: "plan",
          episode: episode.no,
          scene: scene.key,
          finished: chunkIndex,
          total: chunks.length,
        });
        const result = await planChunk({
          chunkInput,
          initialInput,
          instructions,
          callModel,
          policy,
          effort,
          signal,
          label:
            `${labelPrefix} 第${episode.no}集 ${scene.key} ` +
            `计划 ${chunkIndex + 1}/${chunks.length}`,
          maxRepairRounds,
          onProgress,
          progressMeta: {
            episode: episode.no,
            scene: scene.key,
            finished: chunkIndex,
            total: chunks.length,
          },
        });
        plans.push(result.plan);
        chunkStats.push({
          chunk: chunkIndex + 1,
          total: chunks.length,
          repairRounds: result.repairRounds,
          repairs: result.repairs,
          validation: result.validation,
        });
      }

      const merged = mergeScenePlans(plans, scene.key, {
        schemaVersion: STABLE_LEAN_SCHEMA_VERSION,
      });
      const repaired = repairScenePlan(merged, baseInput, policy);
      const validation = auditPlan(repaired.plan, baseInput, policy);
      const sceneText = compileScenePlan(repaired.plan, baseInput, shotOffset);
      const lastShot = repaired.plan.shots?.at(-1);
      const stats = {
        scene: scene.key,
        chunks: chunkStats,
        repairs: repaired.repairs,
        validation,
        lastEndState: trim(lastShot?.endState),
      };
      shotOffset += validation.stats?.shots || 0;
      previousEnd = trim(lastShot?.endState);
      sceneTexts.push(sceneText);
      scenes.push(stats);
      await onSceneComplete?.({
        episode: episode.no,
        scene: scene.key,
        result: { sceneText, stats },
      });
    }

    const episodeText = `第${episode.no}集${
      episode.title ? `：${episode.title}` : ""
    }\n${sceneTexts.join("\n\n")}`.trim();
    outputEpisodes.push(episodeText);
    const episodeIssues = [];
    for (const sceneStats of scenes) {
      for (const issue of sceneStats.validation?.issues || []) {
        episodeIssues.push({
          ...issue,
          where: `第${episode.no}集 ${issue.where}`,
          source: "stable-v5",
        });
      }
    }
    allIssues.push(...episodeIssues);
    const episodeResult = {
      episode: episode.no,
      text: episodeText,
      scenes,
      issues: episodeIssues,
    };
    episodeStats.push(episodeResult);
    await onEpisodeComplete?.(episodeResult);
  }

  return {
    text: outputEpisodes.join("\n\n"),
    episodes: episodeStats,
    issues: allIssues,
    stats: {
      episodes: parsed.episodes.length,
      scenes: episodeStats.reduce(
        (sum, episode) => sum + episode.scenes.length,
        0,
      ),
      chunks: episodeStats.reduce(
        (sum, episode) =>
          sum +
          episode.scenes.reduce(
            (sceneSum, scene) => sceneSum + (scene.chunks?.length || 0),
            0,
          ),
        0,
      ),
      high: highIssues(allIssues).length,
      mid: allIssues.filter((issue) => issue.level === "中").length,
      schemaVersion: STABLE_LEAN_SCHEMA_VERSION,
    },
  };
}
