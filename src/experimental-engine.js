import { parseScript } from "./split.js";
import {
  ACTION_UNIT_SCHEMA_VERSION,
  auditShotActionDensity,
  auditShotContinuity,
  auditShotResponsibilities,
  buildSceneInput,
  compileScenePlan,
  getScenePlanPolicy,
  mergeScenePlans,
  parseScenePlan,
  renderSceneInput,
  renderScenePlanPrompt,
  repairScenePlan,
  splitSceneInput,
  validateDirectorBrief,
  validateScenePlan,
} from "./scene-engine.js";
import { analyzePlanDurationBudget } from "./duration-calibration.js";
import {
  applyShotRepairPlan,
  buildShotRepairRequest,
  renderShotRepairInstructions,
} from "./shot-repair.js";

const trim = (value) => String(value ?? "").trim();

function issuesText(issues) {
  return (issues || [])
    .map((issue) => `- [${issue.level}] ${issue.where}: ${issue.msg}`)
    .join("\n");
}

function highIssues(result) {
  return (result?.issues || []).filter((issue) => issue.level === "高");
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

async function planScene({
  episode,
  scene,
  sceneIndex,
  callModel,
  briefInstructions,
  sceneInstructions,
  policy,
  chunkSeconds,
  effort,
  signal,
  labelPrefix,
  startShotNo,
  onProgress,
  maxRepairRounds = 2,
}) {
  const baseInput = buildSceneInput({
    episode,
    scene,
    nextScene: nextSceneText(episode, sceneIndex),
    policy,
  });
  onProgress?.({
    stage: "brief",
    episode: episode.no,
    scene: scene.key,
    finished: 0,
    total: 0,
  });
  const briefRaw = await callText(callModel, {
    instructions: briefInstructions,
    input: renderSceneInput(baseInput),
    effort,
    label: `${labelPrefix} 导演提示单 第${episode.no}集 ${scene.key}`,
    signal,
  });
  const briefPlan = parseScenePlan(briefRaw);
  const directorBrief = briefPlan.directorBrief || null;
  const sceneGeography = briefPlan.sceneGeography || null;
  const briefValidation = validateDirectorBrief(
    directorBrief,
    sceneGeography,
    scene.key,
  );
  if (highIssues(briefValidation).length) {
    throw new Error(
      `第${episode.no}集 ${scene.key} 导演提示单不合格：${issuesText(
        highIssues(briefValidation),
      )}`,
    );
  }

  const sceneInput = {
    ...baseInput,
    directorBrief,
    sceneGeography,
  };
  const chunks = splitSceneInput(sceneInput, {
    targetSeconds: chunkSeconds,
    policy,
  });
  const plans = [];
  const chunkStats = [];
  for (let index = 0; index < chunks.length; index += 1) {
    const chunkInput = chunks[index];
    const initialInput = renderSceneInput(chunkInput);
    onProgress?.({
      stage: "plan",
      episode: episode.no,
      scene: scene.key,
      finished: index,
      total: chunks.length,
    });
    let raw = await callText(callModel, {
      instructions: sceneInstructions,
      input: initialInput,
      effort,
      label: `${labelPrefix} 镜头计划 第${episode.no}集 ${scene.key} ${index + 1}/${chunks.length}`,
      signal,
    });
    let plan = parseScenePlan(raw);
    const local = repairScenePlan(plan, chunkInput, policy);
    plan = local.plan;
    let validation = validateScenePlan(plan, chunkInput, policy);
    let modelRepairRounds = 0;
    let localRepairCount = local.repairs.length;
    const repairLimit = Math.max(
      0,
      Math.min(3, Number(maxRepairRounds) || 0),
    );
    while (
      highIssues(validation).length &&
      modelRepairRounds < repairLimit
    ) {
      const repairInput = buildShotRepairRequest({
        initialInput,
        plan,
        issues: validation.issues,
        expectedSchemaVersion: ACTION_UNIT_SCHEMA_VERSION,
      });
      const repairRaw = await callText(callModel, {
        instructions: renderShotRepairInstructions(
          sceneInstructions,
          ACTION_UNIT_SCHEMA_VERSION,
        ),
        input: repairInput,
        effort,
        label: `${labelPrefix} 定点修复 第${episode.no}集 ${scene.key} ${index + 1}/${chunks.length} r${modelRepairRounds + 1}`,
        signal,
      });
      modelRepairRounds += 1;
      const repaired = applyShotRepairPlan(plan, parseScenePlan(repairRaw));
      const localAfterRepair = repairScenePlan(
        repaired.plan,
        chunkInput,
        policy,
      );
      plan = localAfterRepair.plan;
      localRepairCount += localAfterRepair.repairs.length;
      validation = validateScenePlan(plan, chunkInput, policy);
    }
    plans.push(plan);
    chunkStats.push({
      chunk: index + 1,
      total: chunks.length,
      modelRepairRounds,
      localRepairCount,
      validation,
      actionAudit: auditShotActionDensity(plan, chunkInput),
      continuityAudit: auditShotContinuity(plan, chunkInput),
      responsibilityAudit: auditShotResponsibilities(plan),
      durationBudget: analyzePlanDurationBudget(plan, chunkInput, policy),
    });
  }

  const merged = mergeScenePlans(plans, scene.key, {
    schemaVersion: ACTION_UNIT_SCHEMA_VERSION,
    directorBrief,
    sceneGeography,
  });
  const repaired = repairScenePlan(merged, sceneInput, policy);
  const validation = validateScenePlan(repaired.plan, sceneInput, policy);
  return {
    sceneText: compileScenePlan(repaired.plan, sceneInput, startShotNo),
    stats: {
      scene: scene.key,
      chunks: chunkStats,
      repairCount: repaired.repairs.length,
      validation,
      actionAudit: auditShotActionDensity(repaired.plan, sceneInput),
      continuityAudit: auditShotContinuity(repaired.plan, sceneInput),
      responsibilityAudit: auditShotResponsibilities(repaired.plan),
      durationBudget: analyzePlanDurationBudget(
        repaired.plan,
        sceneInput,
        policy,
      ),
    },
  };
}

/**
 * 实验引擎：按集 → 场 → 分块生成，输出标准分镜剧本。
 * 任何模型原始输出仍由本地代理先落盘，再进入本模块解析。
 */
export async function runExperimentalScript({
  text,
  callModel,
  briefInstructions,
  sceneInstructions,
  policyName = "flexible6",
  chunkSeconds = 20,
  effort = "low",
  signal,
  labelPrefix = "实验引擎",
  completedEpisodes = {},
  completedScenes = {},
  onEpisodeComplete,
  onSceneComplete,
  onProgress,
  maxRepairRounds = 2,
}) {
  const parsed = parseScript(text);
  if (!parsed.episodes.length) {
    throw new Error("实验引擎没有识别到任何「第N集」");
  }
  const policy = getScenePlanPolicy(policyName);
  const outputEpisodes = [];
  const episodeStats = [];
  const issues = [];
  for (const episode of parsed.episodes) {
    const cached = completedEpisodes[episode.no];
    if (cached) {
      const cachedText =
        typeof cached === "string" ? cached : trim(cached.text);
      const cachedIssues = Array.isArray(cached.issues) ? cached.issues : [];
      outputEpisodes.push(cachedText);
      issues.push(...cachedIssues);
      episodeStats.push({
        episode: episode.no,
        text: cachedText,
        scenes: [],
        issues: cachedIssues,
        cached: true,
      });
      continue;
    }
    const sceneTexts = [];
    const scenes = [];
    let shotOffset = 1;
    for (let index = 0; index < episode.scenes.length; index += 1) {
      const scene = episode.scenes[index];
      const sceneKey = `${episode.no}:${scene.key}`;
      const cachedScene = completedScenes[sceneKey];
      const result =
        cachedScene ||
        (await planScene({
          episode,
          scene,
          sceneIndex: index,
          callModel,
          briefInstructions,
          sceneInstructions,
          policy,
          chunkSeconds,
          effort,
          signal,
          labelPrefix,
          startShotNo: shotOffset,
          onProgress,
          maxRepairRounds,
        }));
      sceneTexts.push(result.sceneText);
      const shots = (result.stats.validation?.stats?.shots || 0);
      shotOffset += shots;
      scenes.push(result.stats);
      if (!cachedScene) {
        await onSceneComplete?.({
          episode: episode.no,
          scene: scene.key,
          result,
        });
      }
    }
    const episodeText = `第${episode.no}集${
      episode.title ? `：${episode.title}` : ""
    }\n${sceneTexts.join("\n\n")}`.trim();
    outputEpisodes.push(episodeText);
    const episodeIssues = [];
    for (const sceneStats of scenes) {
      for (const issue of sceneStats.validation.issues || []) {
        const scenePrefix = `${sceneStats.scene} `;
        const detail = String(issue.where || "").startsWith(scenePrefix)
          ? String(issue.where).slice(scenePrefix.length)
          : issue.where;
        episodeIssues.push({
          ...issue,
          where: `第${episode.no}集 ${detail}`,
          source: "experimental-engine",
        });
      }
    }
    issues.push(...episodeIssues);
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
    issues,
    stats: {
      episodes: parsed.episodes.length,
      scenes: episodeStats.reduce((sum, episode) => sum + episode.scenes.length, 0),
      chunks: episodeStats.reduce(
        (sum, episode) =>
          sum +
          episode.scenes.reduce(
            (sceneSum, scene) => sceneSum + (scene.chunks?.length || 0),
            0,
          ),
        0,
      ),
    },
  };
}
