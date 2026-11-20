import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  DEFAULT_OPTIONS,
  autoCuts,
  autoSplitScenes,
  estimateAll,
  parseScript,
  rebuildCast,
  renderScript,
  renumber,
} from "../src/split.js";
import {
  arbitrateShotTimeline,
  buildSceneInput,
  compileScenePlan,
  getScenePlanPolicy,
  mergeScenePlans,
  parseScenePlan,
  repairScenePlan,
  renderSceneInput,
  renderScenePlanPrompt,
  splitSceneInput,
  validateScenePlan,
} from "../src/scene-engine.js";
import {
  parseStoryboard,
  splitCamera,
  validateStoryboard,
} from "../src/storyboard.js";
import { flatten, runEngineQc } from "../src/qc-engine.js";

const ROOT = process.cwd();
const sourceFile = process.argv[2] || "tests/fixtures/final-script.txt";
const wanted = (process.argv[3] || "1,4,6")
  .split(",")
  .map(Number)
  .filter(Number.isInteger);
const policyName = process.argv[4] || "flexible6";
const endpoint = process.env.SCENE_PLAN_ENDPOINT || "http://127.0.0.1:4177/api/chat";
const chunkSeconds = Number(process.env.SCENE_PLAN_CHUNK_SECONDS || 20);
const concurrency = Math.max(1, Number(process.env.SCENE_PLAN_CONCURRENCY || 3));
const policy = getScenePlanPolicy(policyName);
const resume = process.env.SCENE_PLAN_RESUME === "1";

function instructionBody(text, marker) {
  const index = text.indexOf(marker);
  return index >= 0 ? text.slice(index) : text;
}

const baselineInstructions = instructionBody(
  readFileSync(path.join(ROOT, "src/prompts/default-storyboard.md"), "utf8"),
  "# 海外竖屏短剧 AI 分镜提示词",
);
const engineInstructions = renderScenePlanPrompt(
  readFileSync(path.join(ROOT, "src/prompts/scene-plan.md"), "utf8"),
  policy,
);

async function requestModelOnce({ instructions, input, label, maxOutputTokens }) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      instructions,
      input,
      effort: "low",
      maxOutputTokens,
      label,
      runId: `ab-storyboard-${Date.now()}`,
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

async function runModel({ instructions, input, label, maxOutputTokens = 64000 }) {
  const startedAt = Date.now();
  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const result = await requestModelOnce({
        instructions,
        input,
        label:
          attempt === 1
            ? label
            : `${label} transport-r${attempt}`,
        maxOutputTokens,
      });
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

function issuesText(issues) {
  return issues
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

function normalizeEpisodeOutput(raw, episodeNo, title) {
  const lines = String(raw || "")
    .trim()
    .split(/\r?\n/)
    .filter((line) => !/^\s*```(?:\w+)?\s*$/.test(line));
  const episodeHeading = new RegExp(`^第\\s*${episodeNo}\\s*集(?:\\s*[：:].*)?$`);
  let seenHeading = false;
  const body = lines.filter((line) => {
    if (!episodeHeading.test(line.trim())) return true;
    if (!seenHeading) {
      seenHeading = true;
      return true;
    }
    return false;
  });
  const text = body.join("\n").trim();
  return /^第\s*\d+\s*集/.test(text) ? text : `第${episodeNo}集：${title}\n${text}`;
}

async function planChunk(chunkInput, ordinal, total, episodeNo, previous = null) {
  const previousHistory = previous?.history?.length ? previous.history : previous ? [previous] : [];
  const attempts = previousHistory.map((item) => ({
    attempt: item.attempt,
    label: item.label,
    input: item.input,
    raw: item.output,
    status: item.status,
    usage: item.usage,
    elapsedMs: item.ms,
    resumed: true,
  }));
  const runAttempt = async ({
    instructions,
    input,
    label,
    maxOutputTokens,
    attemptNumber,
  }) => {
    const result = await runModel({ instructions, input, label, maxOutputTokens });
    attempts.push({
      attempt: attemptNumber || attempts.length + 1,
      label,
      input,
      raw: result.text,
      status: result.done?.status || null,
      usage: result.done?.usage || null,
      elapsedMs: result.elapsedMs,
      transportAttempts: result.transportAttempts,
    });
    return result;
  };

  let attempt = previousHistory.reduce((max, item) => Math.max(max, item.attempt), 0);
  const initialInput = renderSceneInput(chunkInput);
  let result = previous
    ? {
        text: previous.output,
        done: { status: previous.status, usage: previous.usage },
        elapsedMs: previous.ms,
        transportAttempts: 1,
      }
    : await runAttempt({
        instructions: engineInstructions,
        input: initialInput,
        label: `AB 新引擎 EP${episodeNo} ${chunkInput.chunkIndex}/${total} r1`,
        maxOutputTokens: 36000,
      });
  if (!attempt) attempt = 1;
  if (result.done?.status !== "completed") {
    throw new Error(`EP${episodeNo} 第 ${ordinal} 段模型未完成：${result.done?.status}`);
  }
  let plan = parseScenePlan(result.text);
  let validation = validateScenePlan(plan, chunkInput, policy);
  if (validation.issues.some((issue) => issue.level === "高")) {
    attempt += 1;
    result = await runAttempt({
      instructions: engineInstructions,
      input: `【原始场景切片】\n${initialInput}\n\n【上一版镜头计划】\n${result.text}\n\n【必须修复的问题】\n${issuesText(validation.issues)}\n\n请只修复上述问题，保持所有源块各出现一次，只输出完整合法 JSON。`,
      label: `AB 新引擎修复 EP${episodeNo} ${chunkInput.chunkIndex}/${total} r${attempt}`,
      maxOutputTokens: 36000,
      attemptNumber: attempt,
    });
    if (result.done?.status !== "completed") {
      throw new Error(`EP${episodeNo} 第 ${ordinal} 段修复未完成：${result.done?.status}`);
    }
    plan = parseScenePlan(result.text);
    validation = validateScenePlan(plan, chunkInput, policy);
  }
  const usage = attempts.reduce(
    (totalUsage, item) => {
      totalUsage.input_tokens += item.usage?.input_tokens || 0;
      totalUsage.output_tokens += item.usage?.output_tokens || 0;
      totalUsage.total_tokens += item.usage?.total_tokens || 0;
      return totalUsage;
    },
    { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
  );
  return {
    plan,
    validation,
    attempts: attempt,
    usage,
    elapsedMs: attempts.reduce((sum, item) => sum + item.elapsedMs, 0),
    trace: {
      chunkIndex: chunkInput.chunkIndex,
      sceneInput: chunkInput,
      finalPlan: plan,
      finalRaw: result.text,
      attempts,
    },
  };
}

async function planScene(sceneInput, episodeNo, existingChunks = new Map()) {
  const chunks = splitSceneInput(sceneInput, { targetSeconds: chunkSeconds, policy });
  const plans = Array(chunks.length);
  const results = Array(chunks.length);
  const traces = Array(chunks.length);
  let next = 0;
  async function worker() {
    for (;;) {
      const index = next;
      next += 1;
      if (index >= chunks.length) return;
      const chunkInput = chunks[index];
      const existing = existingChunks.get(index + 1);
      let run = existing;
      if (existing) {
        const plan = parseScenePlan(existing.output);
        const validation = validateScenePlan(plan, chunkInput, policy);
        if (validation.issues.some((issue) => issue.level === "高")) {
          console.log(
            `[resume] EP${episodeNo} 第 ${index + 1}/${chunks.length} 段仍有高问题，继续修复 ${existing.file}`,
          );
          run = await planChunk(
            chunkInput,
            index + 1,
            chunks.length,
            episodeNo,
            existing,
          );
        } else {
          const history = existing.history?.length ? existing.history : [existing];
          const usage = history.reduce(
            (totalUsage, item) => {
              totalUsage.input_tokens += item.usage?.input_tokens || 0;
              totalUsage.output_tokens += item.usage?.output_tokens || 0;
              totalUsage.total_tokens += item.usage?.total_tokens || 0;
              return totalUsage;
            },
            { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
          );
          run = {
            plan,
            validation,
            attempts: history.length,
            usage,
            elapsedMs: history.reduce((sum, item) => sum + item.ms, 0),
            trace: {
              chunkIndex: index + 1,
              sceneInput: chunkInput,
              finalPlan: plan,
              finalRaw: existing.output,
              resumedFrom: existing.file,
              attempts: history.map((item) => ({
                attempt: item.attempt,
                label: item.label,
                raw: item.output,
                status: item.status,
                usage: item.usage,
                elapsedMs: item.ms,
                resumed: true,
              })),
            },
          };
          console.log(
            `[resume] EP${episodeNo} 第 ${index + 1}/${chunks.length} 段复用 ${existing.file}`,
          );
        }
      } else {
        run = await planChunk(chunkInput, index + 1, chunks.length, episodeNo);
      }
      plans[index] = run.plan;
      results[index] = {
        index: index + 1,
        blocks: chunks[index].blocks.length,
        estimatedSeconds: chunks[index].estimatedSeconds,
        attempts: run.attempts,
        stats: run.validation.stats,
        issues: run.validation.issues,
        usage: run.usage,
        elapsedMs: run.elapsedMs,
      };
      traces[index] = run.trace;
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, chunks.length) }, () => worker()));
  const merged = mergeScenePlans(plans, sceneInput.sceneId);
  const repaired = repairScenePlan(merged, sceneInput, policy);
  return {
    ...repaired,
    validation: validateScenePlan(repaired.plan, sceneInput, policy),
    chunks: results,
    traces,
  };
}

function runStartTime(outDir) {
  const stamp = path.basename(outDir);
  const match = stamp.match(
    /^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/,
  );
  if (!match) return 0;
  return Date.parse(
    `${match[1]}T${match[2]}:${match[3]}:${match[4]}.${match[5]}Z`,
  );
}

function existingChunkArtifacts(episodeNo, startedAt) {
  const pattern = new RegExp(
    `^AB 新引擎(?:修复)? EP${episodeNo} (\\d+)/(\\d+) r(\\d+)(?: transport-r\\d+)?$`,
  );
  const buckets = new Map();
  for (const file of readdirSync(path.join(ROOT, "runs", "artifacts"))) {
    if (!file.endsWith(".json")) continue;
    const full = path.join(ROOT, "runs", "artifacts", file);
    const artifact = JSON.parse(readFileSync(full, "utf8"));
    if (Date.parse(artifact.at) < startedAt) continue;
    const match = String(artifact.label || "").match(pattern);
    if (!match) continue;
    const chunk = Number(match[1]);
    const attempt = Number(match[3]);
    const history = buckets.get(chunk) || [];
    history.push({ ...artifact, attempt, file });
    buckets.set(chunk, history);
  }
  return new Map(
    [...buckets.entries()].map(([chunk, history]) => {
      const sorted = history.sort((a, b) => {
        if (a.attempt !== b.attempt) return a.attempt - b.attempt;
        return Date.parse(a.at) - Date.parse(b.at);
      });
      const final = sorted.at(-1);
      return [chunk, { ...final, history: sorted }];
    }),
  );
}

function existingBaselineArtifact(episodeNo, startedAt) {
  const pattern = new RegExp(`^AB 基线 EP${episodeNo}(?: transport-r\\d+)?$`);
  let latest = null;
  for (const file of readdirSync(path.join(ROOT, "runs", "artifacts"))) {
    if (!file.endsWith(".json")) continue;
    const artifact = JSON.parse(
      readFileSync(path.join(ROOT, "runs", "artifacts", file), "utf8"),
    );
    if (Date.parse(artifact.at) < startedAt || artifact.status !== "completed") continue;
    if (!pattern.test(String(artifact.label || ""))) continue;
    if (!latest || Date.parse(artifact.at) > Date.parse(latest.at)) {
      latest = { ...artifact, file };
    }
  }
  return latest;
}

function metrics(output, sourceText, limits = policy) {
  const parsed = parseStoryboard(output);
  const validation = validateStoryboard(parsed, limits);
  const qc = runEngineQc(sourceText, output);
  const clips = parsed.episodes.flatMap((ep) => ep.shots.flatMap((shot) => shot.clips));
  const totalDuration = parsed.episodes.reduce(
    (sum, ep) => sum + ep.shots.reduce((epSum, shot) => epSum + (shot.duration || 0), 0),
    0,
  );
  const wide = clips.filter((clip) => ["MS", "FS", "WS", "EWS"].includes(clip.size)).length;
  const wideDialogueClips = clips.filter(
    (clip) =>
      clip.dialogue.length > 0 &&
      ["MS", "FS", "WS", "EWS"].includes(clip.size),
  ).length;
  const sourceDialogues = parseScript(sourceText).episodes.flatMap((episode) =>
    episode.scenes.flatMap((scene) =>
      scene.blocks
        .filter((block) => block.kind === "dialogue")
        .map((block) => flatten(block.content)),
    ),
  );
  const outputDialogues = new Set(
    clips.flatMap((clip) => clip.dialogue.map((line) => flatten(line.text))),
  );
  const coveredDialogues = sourceDialogues.filter((line) => outputDialogues.has(line)).length;
  return {
    episodes: parsed.episodes.length,
    shots: parsed.episodes.reduce((sum, ep) => sum + ep.shots.length, 0),
    clips: clips.length,
    totalDuration,
    high: validation.stats.high,
    mid: validation.stats.mid,
    qcHigh: qc.filter((issue) => issue.level === "高").length,
    qcMid: qc.filter((issue) => issue.level === "中").length,
    dialogueLines: clips.reduce((sum, clip) => sum + clip.dialogue.length, 0),
    sourceDialogueLines: sourceDialogues.length,
    sourceDialogueCovered: coveredDialogues,
    sourceDialogueCoveragePct: sourceDialogues.length
      ? Number(((coveredDialogues / sourceDialogues.length) * 100).toFixed(1))
      : 100,
    widePct: clips.length ? Number(((wide / clips.length) * 100).toFixed(1)) : 0,
    wideDialogueClips,
    cameraMoves: new Set(
      clips
        .map((clip) => splitCamera(clip.camera).move || clip.camera.trim())
        .filter(Boolean),
    ).size,
    issues: [...validation.issues, ...qc],
  };
}

const parsedSource = parseScript(readFileSync(path.join(ROOT, sourceFile), "utf8"));
const splits = autoSplitScenes(parsedSource, DEFAULT_OPTIONS, {});
const estimated = estimateAll(parsedSource, DEFAULT_OPTIONS, {}, splits);
const episodes = renumber(estimated, autoCuts(estimated, DEFAULT_OPTIONS), DEFAULT_OPTIONS);
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outDir = process.env.SCENE_PLAN_OUT_DIR
  ? path.resolve(ROOT, process.env.SCENE_PLAN_OUT_DIR)
  : path.join(ROOT, "runs", "ab-storyboard", stamp);
mkdirSync(outDir, { recursive: true });
const startedAt = runStartTime(outDir);
if (resume && !startedAt) {
  throw new Error("断点续跑目录名必须使用 ISO 时间戳格式");
}

const reportFile = path.join(outDir, "report.json");
const report =
  resume && existsSync(reportFile)
    ? JSON.parse(readFileSync(reportFile, "utf8")).filter(
        (item) => !wanted.includes(item.episode),
      )
    : [];
for (const episodeNo of wanted) {
  const episode = episodes.find((item) => item.no === episodeNo);
  if (!episode) throw new Error(`流程二没有第 ${episodeNo} 集`);
  rebuildCast([episode]);
  const sourceText = renderScript([episode]).replaceAll("**", "");
  const parsedEpisode = parseScript(sourceText).episodes[0];
  console.log(
    `[A/B] EP${episodeNo} ${episode.title} · flow2 estimate ${episode.sec}s · ${parsedEpisode.scenes.length} scenes`,
  );

  const baselineFile = path.join(outDir, `EP${episodeNo}-baseline.md`);
  const reuseBaseline = resume && existsSync(baselineFile);
  const baselineArtifact = reuseBaseline
    ? existingBaselineArtifact(episodeNo, startedAt)
    : null;
  const baseline = reuseBaseline
    ? {
        text: readFileSync(baselineFile, "utf8"),
        done: { status: "reused", usage: baselineArtifact?.usage || null },
        usage: baselineArtifact?.usage || null,
        elapsedMs: baselineArtifact?.ms || 0,
      }
    : await runModel({
        instructions: baselineInstructions,
        input: sourceText,
        label: `AB 基线 EP${episodeNo}`,
      });
  const baselineOutput = normalizeEpisodeOutput(
    baseline.text,
    episodeNo,
    episode.title,
  );
  writeFileSync(baselineFile, baselineOutput);

  const sceneInputs = parsedEpisode.scenes.map((scene, index) =>
    buildSceneInput({
      episode: parsedEpisode,
      scene,
      nextScene: nextSceneText(parsedEpisode, index),
      policy,
    }),
  );
  const scenePlans = [];
  const existingChunks = resume
    ? existingChunkArtifacts(episodeNo, startedAt)
    : new Map();
  for (const sceneInput of sceneInputs) {
    scenePlans.push(await planScene(sceneInput, episodeNo, existingChunks));
  }
  const trace = {
    episode: episodeNo,
    title: episode.title,
    flow2Estimate: episode.sec,
    scenes: scenePlans.map((item, index) => ({
      sceneInput: sceneInputs[index],
      chunks: item.traces,
    })),
  };
  writeFileSync(
    path.join(outDir, `EP${episodeNo}-engine-trace.json`),
    JSON.stringify(trace, null, 2),
  );

  let shotOffset = 1;
  const sceneTexts = scenePlans.map(({ plan }, index) => {
    const text = compileScenePlan(plan, sceneInputs[index], shotOffset);
    shotOffset += plan.shots.length;
    return text;
  });
  const engineOutput = `第${episodeNo}集：${episode.title}\n${sceneTexts.join("\n\n")}`;
  writeFileSync(path.join(outDir, `EP${episodeNo}-engine.md`), engineOutput);

  const combinedShots = scenePlans.flatMap(({ plan }) => plan.shots);
  const arbitration = arbitrateShotTimeline(combinedShots);
  const baselineMetrics = metrics(baselineOutput, sourceText, {
    shotMin: 5,
    shotMax: 15,
    clipMin: 4,
    clipMax: 15,
    maxClips: 6,
  });
  const engineMetrics = metrics(engineOutput, sourceText);
  baselineMetrics.durationRatio = Number(
    (baselineMetrics.totalDuration / episode.sec).toFixed(2),
  );
  engineMetrics.durationRatio = Number(
    (engineMetrics.totalDuration / episode.sec).toFixed(2),
  );
  const engineUsage = scenePlans
    .flatMap((item) => item.chunks)
    .reduce(
      (totalUsage, item) => {
        totalUsage.input_tokens += item.usage?.input_tokens || 0;
        totalUsage.output_tokens += item.usage?.output_tokens || 0;
        totalUsage.total_tokens += item.usage?.total_tokens || 0;
        totalUsage.elapsedMs += item.elapsedMs || 0;
        return totalUsage;
      },
      { input_tokens: 0, output_tokens: 0, total_tokens: 0, elapsedMs: 0 },
    );
  report.push({
    episode: episodeNo,
    title: episode.title,
    flow2Estimate: episode.sec,
    scenes: parsedEpisode.scenes.length,
    baseline: {
      status: baseline.done?.status,
      resumed: reuseBaseline,
      artifact: baselineArtifact ? `runs/artifacts/${baselineArtifact.file}` : null,
      usage: baseline.done?.usage || null,
      elapsedMs: baseline.elapsedMs,
      metrics: baselineMetrics,
    },
    engine: {
      resumed: resume,
      chunks: scenePlans.flatMap((item) => item.chunks),
      repairs: scenePlans.flatMap((item) => item.repairs),
      planValidation: scenePlans.map((item) => item.validation),
      arbitration,
      usage: engineUsage,
      metrics: engineMetrics,
      trace: `EP${episodeNo}-engine-trace.json`,
    },
  });
  console.log(
    `[A/B] EP${episodeNo} done · baseline ${baselineMetrics.shots}/${baselineMetrics.clips}/${baselineMetrics.totalDuration}s · engine ${engineMetrics.shots}/${engineMetrics.clips}/${engineMetrics.totalDuration}s`,
  );
}

writeFileSync(reportFile, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ outputDir: path.relative(ROOT, outDir), report }, null, 2));
