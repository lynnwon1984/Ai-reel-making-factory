import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { parseScript } from "../src/split.js";
import { runEngineQc, flatten } from "../src/qc-engine.js";
import { parseStoryboard, validateStoryboard } from "../src/storyboard.js";
import {
  getScenePlanPolicy,
  renderScenePlanPrompt,
} from "../src/scene-engine.js";
import { runExperimentalScript } from "../src/experimental-engine.js";
import { runStableV5Script } from "../src/stable-v5-engine.js";
import { summarizeModelCalls } from "../src/run-metrics.js";
import { auditBeatClaims, numberStoryboardBeats } from "../src/beat-claim.js";

const ROOT = process.cwd();
const sourceFile = process.argv[2] || "tests/fixtures/final-script.txt";
const endpoint = process.env.SCENE_PLAN_ENDPOINT || "http://127.0.0.1:4177/api/chat";
const effort = process.env.SCENE_PLAN_EFFORT || "low";
const chunkSeconds = Number(process.env.SCENE_PLAN_CHUNK_SECONDS || 20);
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const requestedOutDir = process.env.SCENE_PLAN_AB_OUT_DIR || "";
const outDir = requestedOutDir
  ? path.resolve(ROOT, requestedOutDir)
  : path.join(ROOT, "runs", "storyboard-3scene-ab", stamp);
const resume = process.env.SCENE_PLAN_AB_RESUME === "1";
const requestedEngines = new Set(
  String(process.env.SCENE_PLAN_AB_ENGINES || "stable,experimental")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean),
);
const runStable = requestedEngines.has("stable");
const runExperimental = requestedEngines.has("experimental");
const runStableV5 = requestedEngines.has("stable-v5");
if (!runStable && !runStableV5 && !runExperimental) {
  throw new Error(
    "SCENE_PLAN_AB_ENGINES 至少要包含 stable、stable-v5 或 experimental",
  );
}
const requestedCases = new Set(
  String(process.env.SCENE_PLAN_AB_CASES || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean),
);
const stableReuseRoot = process.env.SCENE_PLAN_AB_REUSE_STABLE_FROM
  ? path.resolve(ROOT, process.env.SCENE_PLAN_AB_REUSE_STABLE_FROM)
  : "";
mkdirSync(outDir, { recursive: true });
const reportFile = path.join(outDir, "report.json");
const previousReport = new Map(
  (existsSync(reportFile)
    ? JSON.parse(readFileSync(reportFile, "utf8"))
    : []
  ).map((item) => [item.key, item]),
);
const runStamp = path.basename(outDir);
const runStampMatch = runStamp.match(
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/,
);
const startedAt = runStampMatch
  ? Date.parse(
      `${runStampMatch[1]}-${runStampMatch[2]}-${runStampMatch[3]}T${runStampMatch[4]}:${runStampMatch[5]}:${runStampMatch[6]}.${runStampMatch[7]}Z`,
    )
  : 0;

const ALL_CASES = [
  { key: "5-1", label: "对白场" },
  { key: "4-2", label: "动作场" },
  { key: "8-1", label: "多人调度场" },
];
const CASES = requestedCases.size
  ? ALL_CASES.filter((item) => requestedCases.has(item.key))
  : ALL_CASES;
if (!CASES.length) {
  throw new Error(`SCENE_PLAN_AB_CASES 没有命中任何场景：${[...requestedCases].join(",")}`);
}
const reusedStableReport = new Map(
  stableReuseRoot && existsSync(path.join(stableReuseRoot, "report.json"))
    ? JSON.parse(
        readFileSync(path.join(stableReuseRoot, "report.json"), "utf8"),
      ).map((item) => [item.key, item])
    : [],
);

const source = readFileSync(path.join(ROOT, sourceFile), "utf8");
const parsedSource = parseScript(source);
const defaultPrompt = readFileSync(
  path.join(ROOT, "src/prompts/default-storyboard.md"),
  "utf8",
);
const defaultMarker = "# 海外竖屏短剧 AI 分镜提示词";
const stableInstructions = (() => {
  const index = defaultPrompt.indexOf(defaultMarker);
  return index >= 0 ? defaultPrompt.slice(index) : defaultPrompt;
})();
const briefInstructions = readFileSync(
  path.join(ROOT, "src/prompts/director-brief.md"),
  "utf8",
);
const sceneInstructions = renderScenePlanPrompt(
  readFileSync(path.join(ROOT, "src/prompts/scene-plan.md"), "utf8"),
  getScenePlanPolicy("flexible6"),
);
const stableV5Instructions = renderScenePlanPrompt(
  readFileSync(path.join(ROOT, "src/prompts/stable-v5-plan.md"), "utf8"),
  getScenePlanPolicy("strict3"),
);

function findScene(sceneKey) {
  for (const episode of parsedSource.episodes) {
    for (const scene of episode.scenes) {
      if (scene.key === sceneKey) return { episode, scene };
    }
  }
  throw new Error(`找不到场景 ${sceneKey}`);
}

function renderSceneSource({ episode, scene }) {
  return [
    `第${episode.no}集${episode.title ? `：${episode.title}` : ""}`,
    `${scene.key} ${scene.place}`,
    scene.cast ? `人物：${scene.cast}` : "",
    ...scene.body,
  ]
    .filter(Boolean)
    .join("\n");
}

function normalizeEpisode(raw, episodeNo, title = "") {
  const text = String(raw || "")
    .trim()
    .replace(/^```(?:markdown|md)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  return /^第\s*\d+\s*集/.test(text)
    ? text
    : `第${episodeNo}集${title ? `：${title}` : ""}\n${text}`;
}

async function requestModel({ instructions, input, label, maxOutputTokens = 64000 }) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      instructions,
      input,
      effort,
      maxOutputTokens,
      label,
      runId: `3scene-ab-${Date.now()}`,
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
  return { text, status: done?.status, usage: done?.usage };
}

function dialogueKeys(text) {
  const keys = [];
  for (const ep of parseScript(text).episodes) {
    for (const scene of ep.scenes) {
      for (const block of scene.blocks) {
        if (block.kind === "dialogue") keys.push(flatten(block.content));
      }
    }
  }
  return keys;
}

function outputMetrics(
  output,
  sourceText,
  policy,
  { requireBeatClaims = false } = {},
) {
  const parsed = parseStoryboard(output);
  const validation = validateStoryboard(parsed, policy);
  const qc = runEngineQc(sourceText, output);
  const beatIssues = auditBeatClaims(output, sourceText, {
    requireClaims: requireBeatClaims,
    cps: policy.dialogueCps,
    wps: policy.dialogueWps,
    pause: policy.dialoguePauseSec,
  });
  const clips = parsed.episodes.flatMap((ep) =>
    ep.shots.flatMap((shot) => shot.clips || []),
  );
  const sourceDialogues = dialogueKeys(sourceText);
  const outputDialogues = new Set(
    clips.flatMap((clip) =>
      (clip.dialogue || []).map((line) => flatten(line.text)),
    ),
  );
  const outputDialogueKeys = [...outputDialogues];
  const covered = sourceDialogues.filter((sourceKey) =>
    outputDialogueKeys.some(
      (outputKey) =>
        outputKey === sourceKey ||
        outputKey.includes(sourceKey) ||
        sourceKey.includes(outputKey),
    ),
  ).length;
  const shots = parsed.episodes.reduce((sum, ep) => sum + ep.shots.length, 0);
  const duration = parsed.episodes.reduce(
    (sum, ep) =>
      sum +
      ep.shots.reduce(
        (sceneSum, shot) => sceneSum + (Number(shot.duration) || 0),
        0,
      ),
    0,
  );
  return {
    shots,
    clips: clips.length,
    duration,
    high: validation.stats.high,
    mid: validation.stats.mid,
    qcHigh: qc.filter((issue) => issue.level === "高").length,
    qcMid: qc.filter((issue) => issue.level === "中").length,
    beatHigh: beatIssues.filter((issue) => issue.level === "高").length,
    beatMid: beatIssues.filter((issue) => issue.level === "中").length,
    sourceDialogues: sourceDialogues.length,
    coveredDialogues: covered,
    dialogueCoveragePct: sourceDialogues.length
      ? Number(((covered / sourceDialogues.length) * 100).toFixed(1))
      : 100,
    issues: [...validation.issues, ...qc, ...beatIssues],
  };
}

function matchingArtifacts(labelPart) {
  const dir = path.join(ROOT, "runs", "artifacts");
  return readdirSync(dir)
    .map((file) => {
      const artifact = JSON.parse(readFileSync(path.join(dir, file), "utf8"));
      return { ...artifact, file };
    })
    .filter(
      (artifact) =>
        Date.parse(artifact.at) >= startedAt &&
        String(artifact.label || "").includes(labelPart) &&
        artifact.status === "completed",
    )
    .sort((left, right) => Date.parse(left.at) - Date.parse(right.at));
}

const report = [];
for (const item of CASES) {
  const found = findScene(item.key);
  const sceneSource = renderSceneSource(found);
  const numberedSource = numberStoryboardBeats(sceneSource);
  writeFileSync(path.join(outDir, `${item.key}-source.txt`), sceneSource);
  writeFileSync(path.join(outDir, `${item.key}-numbered-source.txt`), numberedSource.text);

  let stableRun = { usage: null };
  let stableOutput = "";
  let stableElapsedMs = 0;
  let stableMetrics = null;
  if (runStable) {
    console.log(`[A/B] ${item.label} ${item.key} · stable`);
    const stableStartedAt = Date.now();
    const stableFile = path.join(outDir, `${item.key}-stable.md`);
    const reusedStableFile = stableReuseRoot
      ? path.join(stableReuseRoot, `${item.key}-stable.md`)
      : "";
    if (reusedStableFile && existsSync(reusedStableFile)) {
      const previousStable = reusedStableReport.get(item.key)?.stable;
      stableRun = {
        text: readFileSync(reusedStableFile, "utf8"),
        status: "completed",
        usage: previousStable?.usage || null,
      };
      stableElapsedMs = previousStable?.elapsedMs || 0;
      console.log(`[A/B] ${item.key} stable 复用指定基线`);
    } else if (resume && existsSync(stableFile)) {
      const artifact = matchingArtifacts(`三场AB 稳定 ${item.key} ${item.label}`).at(-1);
      stableRun = {
        text: readFileSync(stableFile, "utf8"),
        status: "completed",
        usage: artifact?.usage || null,
      };
      stableElapsedMs = artifact?.ms || 0;
      console.log(`[A/B] ${item.key} stable 复用已有结果`);
    } else {
      stableRun = await requestModel({
        instructions: stableInstructions,
        input: numberedSource.text,
        label: `三场AB 稳定 ${item.key} ${item.label}`,
      });
      if (stableRun.status !== "completed") {
        throw new Error(`稳定链路 ${item.key} 未完成：${stableRun.status}`);
      }
      stableElapsedMs = Date.now() - stableStartedAt;
    }
    stableOutput =
      (reusedStableFile && existsSync(reusedStableFile)) ||
      (resume && existsSync(stableFile))
        ? stableRun.text
        : normalizeEpisode(stableRun.text, found.episode.no, found.episode.title);
    writeFileSync(path.join(outDir, `${item.key}-stable.md`), stableOutput);
    stableMetrics = outputMetrics(
      stableOutput,
      sceneSource,
      getScenePlanPolicy("strict3"),
    );
  }

  let stableV5Result = null;
  let stableV5Metrics = null;
  const stableV5Calls = [];
  if (runStableV5) {
    console.log(`[A/B] ${item.label} ${item.key} · stable-v5`);
    const startedAt = Date.now();
    stableV5Result = await runStableV5Script({
      text: sceneSource,
      planInstructions: stableV5Instructions,
      policyName: "strict3",
      effort,
      labelPrefix: `稳定v5 ${item.key} ${item.label}`,
      maxRepairRounds: 2,
      maxBlocksPerChunk: 40,
      chunkSeconds: 180,
      onProgress: () => {},
      callModel: async (args) => {
        const callStartedAt = Date.now();
        const result = await requestModel(args);
        stableV5Calls.push({
          label: args.label,
          usage: result.usage,
          elapsedMs: Date.now() - callStartedAt,
        });
        return result;
      },
    });
    writeFileSync(
      path.join(outDir, `${item.key}-stable-v5.md`),
      stableV5Result.text,
    );
    stableV5Metrics = outputMetrics(
      stableV5Result.text,
      sceneSource,
      getScenePlanPolicy("strict3"),
    );
    const engineHigh = stableV5Result.issues.filter(
      (issue) => issue.level === "高",
    ).length;
    const engineMid = stableV5Result.issues.filter(
      (issue) => issue.level === "中",
    ).length;
    stableV5Metrics.engineHigh = engineHigh;
    stableV5Metrics.engineMid = engineMid;
    stableV5Metrics.elapsedMs = Date.now() - startedAt;
  }

  const experimentalCalls = [];
  const experimentalFile = path.join(
    outDir,
    `${item.key}-experimental.md`,
  );
  let experimental = null;
  if (!runExperimental) {
    console.log(`[A/B] ${item.key} 跳过实验引擎`);
  } else if (resume && existsSync(experimentalFile)) {
    console.log(`[A/B] ${item.label} ${item.key} · experimental`);
    for (const artifact of matchingArtifacts(
      `三场AB 实验 ${item.key} ${item.label}`,
    )) {
      experimentalCalls.push({
        label: artifact.label,
        usage: artifact.usage,
        elapsedMs: artifact.ms,
      });
    }
    experimental = {
      text: readFileSync(experimentalFile, "utf8"),
      issues: previousReport.get(item.key)?.experimental?.engineIssues || [],
      engineIssuesAvailable:
        previousReport.get(item.key)?.experimental?.engineIssuesAvailable || false,
      resumed: true,
    };
    console.log(`[A/B] ${item.key} experimental 复用已有结果`);
  } else {
    console.log(`[A/B] ${item.label} ${item.key} · experimental`);
    experimental = await runExperimentalScript({
      text: sceneSource,
      briefInstructions,
      sceneInstructions,
      policyName: "flexible6",
      chunkSeconds,
      effort,
      labelPrefix: `三场AB 实验 ${item.key} ${item.label}`,
      callModel: async (args) => {
        const startedAt = Date.now();
        const result = await requestModel(args);
        experimentalCalls.push({
          label: args.label,
          usage: result.usage,
          elapsedMs: Date.now() - startedAt,
        });
        return result;
      },
    });
  }
  if (experimental) {
    writeFileSync(
      path.join(outDir, `${item.key}-experimental.md`),
      experimental.text,
    );
  }

  const experimentalMetrics = experimental
    ? outputMetrics(
        experimental.text,
        sceneSource,
        getScenePlanPolicy("flexible6"),
      )
    : null;
  report.push({
    key: item.key,
    label: item.label,
    scene: found.scene.place,
    blocks: found.scene.blocks.length,
    stable: stableMetrics
      ? {
          usage: stableRun.usage,
          elapsedMs: stableElapsedMs,
          metrics: stableMetrics,
          text: `${item.key}-stable.md`,
        }
      : null,
    stableV5: stableV5Metrics
      ? {
          calls: summarizeModelCalls(stableV5Calls),
          metrics: stableV5Metrics,
          issues: stableV5Result.issues,
          text: `${item.key}-stable-v5.md`,
        }
      : null,
    experimental: experimentalMetrics
      ? {
          calls: summarizeModelCalls(experimentalCalls),
          engineIssues: experimental.issues,
          engineIssuesAvailable:
            experimental.engineIssuesAvailable ?? !experimental.resumed,
          metrics: experimentalMetrics,
          text: `${item.key}-experimental.md`,
        }
      : null,
  });
  const stableLine = stableMetrics
    ? `稳定 ${stableMetrics.shots}/${stableMetrics.clips}/${stableMetrics.duration}s`
    : "稳定 跳过";
  const experimentalLine = experimentalMetrics
    ? `实验 ${experimentalMetrics.shots}/${experimentalMetrics.clips}/${experimentalMetrics.duration}s`
    : "实验 跳过";
  const stableV5Line = stableV5Metrics
    ? `稳定v5 ${stableV5Metrics.shots}/${stableV5Metrics.clips}/${stableV5Metrics.duration}s`
    : "稳定v5 跳过";
  console.log(
    `[A/B] ${item.key} 完成 · ${stableLine} · ${stableV5Line} · ${experimentalLine}`,
  );
}

writeFileSync(reportFile, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ outputDir: path.relative(ROOT, outDir), report }, null, 2));
