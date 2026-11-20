import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  ACTION_UNIT_SCHEMA_VERSION,
  analyzePlanDurationBudget,
  analyzeDirectorFields,
  arbitrateShotTimeline,
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
} from "../src/scene-engine.js";
import { runEngineQc } from "../src/qc-engine.js";
import { buildEpisodeResolutionPlan } from "../src/episode-resolution.js";
import { summarizeModelCalls } from "../src/run-metrics.js";
import { parseScript } from "../src/split.js";
import { parseStoryboard, validateStoryboard } from "../src/storyboard.js";

const ROOT = process.cwd();
const sourceFile = process.argv[2] || "tests/fixtures/final-script.txt";
const sceneKey = process.argv[3] || "1-1";
const policyName = process.argv[4] || process.env.SCENE_PLAN_PROFILE || "flexible6";
const policy = getScenePlanPolicy(policyName);
const endpoint = process.env.SCENE_PLAN_ENDPOINT || "http://127.0.0.1:4190/api/chat";
const chunkSeconds = Number(process.env.SCENE_PLAN_CHUNK_SECONDS || 20);
const concurrency = Math.max(1, Number(process.env.SCENE_PLAN_CONCURRENCY || 2));
const effort = process.env.SCENE_PLAN_EFFORT || "low";
const replayDirArg = process.env.DIRECTOR_PILOT_REPLAY || "";

function findScene(parsed) {
  for (const episode of parsed.episodes) {
    for (let index = 0; index < episode.scenes.length; index += 1) {
      if (episode.scenes[index].key === sceneKey) {
        return { episode, scene: episode.scenes[index], index };
      }
    }
  }
  throw new Error(`没有找到场景 ${sceneKey}`);
}

function nextSceneText(found) {
  const { episode, index } = found;
  const next = episode.scenes[index + 1] || episode.nextScene;
  if (!next) return "";
  if (typeof next === "string") return next;
  return [next.place, next.cast ? `人物：${next.cast}` : "", ...next.body]
    .filter(Boolean)
    .slice(0, 7)
    .join("\n")
    .slice(0, 900);
}

async function requestModelOnce({ instructions, input, label, maxOutputTokens }) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      instructions,
      input,
      effort,
      maxOutputTokens,
      label,
      runId: `director-pilot-${Date.now()}`,
    }),
  });
  if (!res.ok || !res.body) {
    throw new Error((await res.text().catch(() => "")) || `HTTP ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  let done = null;
  for (;;) {
    const chunk = await reader.read();
    if (chunk.done) break;
    buffer += decoder.decode(chunk.value, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() || "";
    for (const frame of frames) {
      const line = frame.split("\n").find((item) => item.startsWith("data:"));
      if (!line) continue;
      let event;
      try {
        event = JSON.parse(line.slice(5).trim());
      } catch {
        continue;
      }
      if (event.t === "text") text += event.d;
      if (event.t === "error") throw new Error(event.message);
      if (event.t === "done") done = event;
    }
  }
  return { text, done };
}

async function runModel({ instructions, input, label, maxOutputTokens = 36000 }) {
  const startedAt = Date.now();
  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const result = await requestModelOnce({
        instructions,
        input,
        label: attempt === 1 ? label : `${label} transport-r${attempt}`,
        maxOutputTokens,
      });
      if (result.done?.status !== "completed") {
        throw new Error(`模型未完整结束：${result.done?.status || "unknown"}`);
      }
      return {
        ...result,
        elapsedMs: Date.now() - startedAt,
        transportAttempts: attempt,
      };
    } catch (error) {
      lastError = error;
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 2500));
      }
    }
  }
  throw lastError;
}

function usageOf(done) {
  return done?.usage || null;
}

function addUsage(total, usage) {
  total.input_tokens += usage?.input_tokens || 0;
  total.output_tokens += usage?.output_tokens || 0;
  total.total_tokens += usage?.total_tokens || 0;
  total.reasoning_tokens += usage?.output_tokens_details?.reasoning_tokens || 0;
  total.cached_tokens += usage?.input_tokens_details?.cached_tokens || 0;
  return total;
}

function issuesText(issues) {
  return issues
    .map((issue) => `- [${issue.level}] ${issue.where}: ${issue.msg}`)
    .join("\n");
}

function highIssues(validation) {
  return (validation.issues || []).filter((issue) => issue.level === "高");
}

function resolveReplayDir(value) {
  if (!value) return "";
  return path.resolve(ROOT, value);
}

const parsed = parseScript(readFileSync(path.join(ROOT, sourceFile), "utf8"));
const found = findScene(parsed);
const baseSceneInput = buildSceneInput({
  episode: found.episode,
  scene: found.scene,
  nextScene: nextSceneText(found),
  policy,
});
const scenePromptTemplate = readFileSync(
  path.join(ROOT, "src/prompts/scene-plan.md"),
  "utf8",
);
const briefPrompt = readFileSync(
  path.join(ROOT, "src/prompts/director-brief.md"),
  "utf8",
);
const sceneInstructions = renderScenePlanPrompt(scenePromptTemplate, policy);
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const replayDir = resolveReplayDir(replayDirArg);
const outDir = replayDir
  ? path.join(ROOT, "runs", "director-pilot", `${stamp}-replay`)
  : path.join(ROOT, "runs", "director-pilot", stamp);
mkdirSync(outDir, { recursive: true });

let trace;
if (replayDir) {
  const traceFile = path.join(replayDir, "trace.json");
  if (!existsSync(traceFile)) throw new Error(`回放目录缺少 ${traceFile}`);
  trace = JSON.parse(readFileSync(traceFile, "utf8"));
  if (trace.sceneId !== sceneKey) {
    throw new Error(`回放场景 ${trace.sceneId} 与当前场景 ${sceneKey} 不一致`);
  }
} else {
  trace = {
    sceneId: sceneKey,
    sourceFile,
    policy: policyName,
    effort,
    chunkSeconds,
    createdAt: new Date().toISOString(),
    director: null,
    chunks: [],
  };
}

const totalUsage = {
  input_tokens: 0,
  output_tokens: 0,
  total_tokens: 0,
  reasoning_tokens: 0,
  cached_tokens: 0,
};
let elapsedMs = 0;

if (replayDir) {
  addUsage(totalUsage, trace.director?.usage);
  elapsedMs += Number(trace.director?.elapsedMs) || 0;
  for (const chunk of trace.chunks || []) {
    for (const attempt of chunk.attempts?.length ? chunk.attempts : [chunk.final]) {
      addUsage(totalUsage, attempt?.usage);
    }
  }
} else {
  const briefInput = renderSceneInput(baseSceneInput);
  const briefRun = await runModel({
    instructions: briefPrompt,
    input: briefInput,
    label: `导演提示单 ${sceneKey} ${policyName}`,
    maxOutputTokens: 12000,
  });
  trace.director = {
    input: briefInput,
    raw: briefRun.text,
    usage: usageOf(briefRun.done),
    elapsedMs: briefRun.elapsedMs,
  };
  addUsage(totalUsage, trace.director.usage);
  elapsedMs += briefRun.elapsedMs;
}

const briefPlan = parseScenePlan(trace.director.raw);
const directorBrief = briefPlan.directorBrief || null;
const sceneGeography = briefPlan.sceneGeography || null;
const briefValidation = validateDirectorBrief(
  directorBrief,
  sceneGeography,
  baseSceneInput.sceneId,
);
const sceneInput = {
  ...baseSceneInput,
  directorBrief,
  sceneGeography,
};
const chunks = splitSceneInput(sceneInput, {
  targetSeconds: chunkSeconds,
  policy,
});

if (trace.chunks.length && trace.chunks.length !== chunks.length) {
  throw new Error(`回放分段数 ${trace.chunks.length} 与当前 ${chunks.length} 不一致`);
}

async function planChunk(chunkInput, ordinal) {
  const initialInput = renderSceneInput(chunkInput);
  const saved = trace.chunks[ordinal - 1];
  let attempts = [];
  let final;

  if (saved?.final?.raw) {
    attempts = saved.attempts?.length ? saved.attempts : [saved.final];
    final = {
      attempt: saved.final.attempt,
      label: saved.final.label,
      input: saved.final.input,
      raw: saved.final.raw,
      usage: saved.final.usage,
      elapsedMs: saved.final.elapsedMs,
    };
  } else {
    const first = await runModel({
      instructions: sceneInstructions,
      input: initialInput,
      label: `导演版分镜 ${sceneKey} ${policyName} ${ordinal}/${chunks.length} r1`,
    });
    final = {
      attempt: 1,
      label: `导演版分镜 ${sceneKey} ${policyName} ${ordinal}/${chunks.length} r1`,
      input: initialInput,
      raw: first.text,
      usage: usageOf(first.done),
      elapsedMs: first.elapsedMs,
    };
    attempts.push(final);
  }

  let plan = parseScenePlan(final.raw);
  let validation = validateScenePlan(plan, chunkInput, policy);
  if (highIssues(validation).length && !saved?.final?.raw) {
    const repairInput = [
      "【原始场景切片】",
      initialInput,
      "",
      "【上一版镜头计划】",
      final.raw,
      "",
      "【必须修复的问题】",
      issuesText(validation.issues),
      "",
      "请只修复上述问题，保持所有源块各出现一次，保留正确字段并补齐 schemaVersion 2 要求的导演字段。只输出完整合法 JSON。",
    ].join("\n");
    const repaired = await runModel({
      instructions: sceneInstructions,
      input: repairInput,
      label: `导演版分镜修复 ${sceneKey} ${policyName} ${ordinal}/${chunks.length} r2`,
    });
    final = {
      attempt: 2,
      label: `导演版分镜修复 ${sceneKey} ${policyName} ${ordinal}/${chunks.length} r2`,
      input: repairInput,
      raw: repaired.text,
      usage: usageOf(repaired.done),
      elapsedMs: repaired.elapsedMs,
    };
    attempts.push(final);
    plan = parseScenePlan(final.raw);
    validation = validateScenePlan(plan, chunkInput, policy);
  }

  const chunkUsage = attempts.reduce(
    (total, item) => addUsage(total, item.usage),
    {
      input_tokens: 0,
      output_tokens: 0,
      total_tokens: 0,
      reasoning_tokens: 0,
      cached_tokens: 0,
    },
  );
  if (!saved?.final?.raw) {
    for (const item of attempts) addUsage(totalUsage, item.usage);
  }
  if (saved?.final?.raw) {
    elapsedMs += attempts.reduce((sum, item) => sum + (Number(item.elapsedMs) || 0), 0);
  } else {
    elapsedMs += attempts.reduce((sum, item) => sum + (item.elapsedMs || 0), 0);
  }

  return {
    plan,
    validation,
    trace: {
      chunkIndex: ordinal,
      chunkCount: chunks.length,
      blocks: chunkInput.blocks.length,
      estimatedSeconds: chunkInput.estimatedSeconds,
      attempts,
      final,
    },
    stats: {
      ordinal,
      blocks: chunkInput.blocks.length,
      estimatedSeconds: chunkInput.estimatedSeconds,
      attempts: attempts.length,
      usage: chunkUsage,
      validation: validation.stats,
      director: analyzeDirectorFields(plan),
      actionAudit: auditShotActionDensity(plan, chunkInput),
      continuityAudit: auditShotContinuity(plan, chunkInput),
      responsibilityAudit: auditShotResponsibilities(plan),
      durationBudget: analyzePlanDurationBudget(plan, chunkInput, policy),
      issues: validation.issues,
    },
  };
}

const plans = Array(chunks.length);
const chunkStats = Array(chunks.length);
let nextChunk = 0;
async function worker() {
  for (;;) {
    const index = nextChunk;
    nextChunk += 1;
    if (index >= chunks.length) return;
    const result = await planChunk(chunks[index], index + 1);
    plans[index] = result.plan;
    chunkStats[index] = result.stats;
    if (!replayDir) trace.chunks[index] = result.trace;
    console.log(
      `[director] chunk ${index + 1}/${chunks.length} · ${result.stats.validation.shots} shot / ${result.stats.director.completePct}% 导演字段完整 / 高问题 ${highIssues(result.validation).length}`,
    );
  }
}
await Promise.all(
  Array.from({ length: Math.min(concurrency, chunks.length) }, () => worker()),
);

const merged = mergeScenePlans(plans, sceneInput.sceneId, {
  schemaVersion: ACTION_UNIT_SCHEMA_VERSION,
  directorBrief,
  sceneGeography,
});
const repaired = repairScenePlan(merged, sceneInput, policy);
const validation = validateScenePlan(repaired.plan, sceneInput, policy);
const storyboard = compileScenePlan(repaired.plan, sceneInput);
const output = `第${found.episode.no}集${found.episode.title ? `：${found.episode.title}` : ""}\n${storyboard}`;
const parsedOutput = parseStoryboard(output);
const storyboardValidation = validateStoryboard(parsedOutput, policy);
const sourceText = [
  `第${found.episode.no}集${found.episode.title ? `：${found.episode.title}` : ""}`,
  found.scene.place,
  found.scene.cast ? `人物：${found.scene.cast}` : "",
  ...found.scene.body,
]
  .filter(Boolean)
  .join("\n");
const contentQc = runEngineQc(sourceText, output);
const arbitration = arbitrateShotTimeline(repaired.plan.shots);
const episodeResolution = buildEpisodeResolutionPlan(arbitration);
const directorStats = analyzeDirectorFields(repaired.plan);
const preRepairDirectorStats = analyzeDirectorFields(merged);
const actionAudit = auditShotActionDensity(repaired.plan, sceneInput);
const continuityAudit = auditShotContinuity(repaired.plan, sceneInput);
const responsibilityAudit = auditShotResponsibilities(repaired.plan);
const durationBudget = analyzePlanDurationBudget(
  repaired.plan,
  sceneInput,
  policy,
);
const callRows = [];
if (trace.director) {
  callRows.push({
    kind: "brief",
    label: `导演提示单 ${sceneKey}`,
    usage: trace.director.usage,
    elapsedMs: trace.director.elapsedMs,
  });
}
for (const chunk of trace.chunks || []) {
  for (const attempt of chunk.attempts?.length ? chunk.attempts : [chunk.final]) {
    callRows.push({
      label: attempt.label,
      usage: attempt.usage,
      elapsedMs: attempt.elapsedMs,
    });
  }
}
const runMetrics = summarizeModelCalls(callRows);

const report = {
  sceneId: sceneKey,
  sceneHeading: baseSceneInput.sceneHeading,
  policy: policyName,
  effort,
  chunkSeconds,
  concurrency,
  replayedFrom: replayDir ? path.relative(ROOT, replayDir) : null,
  sourceBlocks: baseSceneInput.blocks.length,
  estimatedSeconds: baseSceneInput.estimatedSeconds,
  directorBriefValidation: briefValidation,
  chunks: chunkStats,
  preRepairDirectorStats,
  directorStats,
  actionAudit,
  continuityAudit,
  responsibilityAudit,
  durationBudget,
  planValidation: validation,
  storyboardValidation,
  contentQc,
  arbitration,
  episodeResolution,
  repairs: repaired.repairs,
  usage: totalUsage,
  runMetrics,
  elapsedMs,
};

writeFileSync(path.join(outDir, "trace.json"), JSON.stringify(trace, null, 2));
writeFileSync(path.join(outDir, "plan.json"), JSON.stringify(repaired.plan, null, 2));
writeFileSync(path.join(outDir, "storyboard.md"), output);
writeFileSync(path.join(outDir, "report.json"), JSON.stringify(report, null, 2));

console.log(
  JSON.stringify(
    {
      outputDir: path.relative(ROOT, outDir),
      replayedFrom: report.replayedFrom,
      sourceBlocks: report.sourceBlocks,
      estimatedSeconds: report.estimatedSeconds,
      chunks: report.chunks.length,
      shots: validation.stats.shots,
      clips: validation.stats.clips,
      totalDuration: validation.stats.totalDuration,
      directorFields: directorStats,
      actionAudit: {
        complexShots: actionAudit.complexShots,
        denseActionClips: actionAudit.denseActionClips,
        compoundCameraMoves: actionAudit.compoundCameraMoves,
      },
      responsibilityAudit: {
        issues: responsibilityAudit.issues.length,
        high: responsibilityAudit.issues.filter((issue) => issue.level === "高").length,
      },
      continuityAudit: {
        issues: continuityAudit.issues.length,
        high: continuityAudit.issues.filter((issue) => issue.level === "高").length,
      },
      durationBudget: {
        modelVersion: durationBudget.model.version,
        contentTotal: durationBudget.contentTotal,
        suggestedTotal: durationBudget.suggestedTotal,
        actualTotal: durationBudget.actualTotal,
        contentRatio: durationBudget.contentRatio,
        suggestedRatio: durationBudget.suggestedRatio,
        meanAbsError: durationBudget.meanAbsError,
        shortShots: durationBudget.shortShots,
      },
      episodeResolution: {
        episodes: episodeResolution.stats.episodes,
        needsResolution: episodeResolution.stats.short,
        resolvableWithoutContent: episodeResolution.stats.resolvableWithoutContent,
        onlyByContentOrAcceptance: episodeResolution.stats.onlyByContentOrAcceptance,
      },
      highIssues: highIssues(validation).length,
      storyboardHighIssues: storyboardValidation.stats.high,
      contentQcHigh: contentQc.filter((issue) => issue.level === "高").length,
      usage: totalUsage,
      runMetrics: {
        calls: runMetrics.total.calls,
        cacheHitPct: runMetrics.cacheHitPct,
        reasoningPctOfOutput: runMetrics.reasoningPctOfOutput,
        repairTokenPct: runMetrics.repairTokenPct,
        repairTimePct: runMetrics.repairTimePct,
        avgTokensPerCall: runMetrics.avgTokensPerCall,
      },
      elapsedMs,
    },
    null,
    2,
  ),
);
