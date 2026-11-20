import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
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
  splitSceneInput,
  validateScenePlan,
} from "../src/scene-engine.js";
import { runEngineQc } from "../src/qc-engine.js";
import { parseStoryboard, validateStoryboard } from "../src/storyboard.js";

const ROOT = process.cwd();
const sourceFile = process.argv[2] || "tests/fixtures/final-script.txt";
const runArg = process.argv[3];
const wanted = (process.argv[4] || "1,4,6")
  .split(",")
  .map(Number)
  .filter(Number.isInteger);
const policy = getScenePlanPolicy(process.argv[5] || "flexible6");
const chunkSeconds = Number(process.env.SCENE_PLAN_CHUNK_SECONDS || 20);

if (!runArg) {
  throw new Error(
    "用法：node scripts/replay-ab-engine.mjs <源剧本> <A/B 输出目录> [集号列表] [规则]",
  );
}

const runDir = path.resolve(ROOT, runArg);
const runStamp = path.basename(runDir);
const runStampMatch = runStamp.match(
  /^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/,
);
if (!runStampMatch) {
  throw new Error("A/B 输出目录名必须是 ISO 时间戳格式，才能只重放本次产物");
}
const startedAt = Date.parse(
  `${runStampMatch[1]}T${runStampMatch[2]}:${runStampMatch[3]}:${runStampMatch[4]}.${runStampMatch[5]}Z`,
);
const artifactNames = readdirSync(path.join(ROOT, "runs", "artifacts")).filter((file) =>
  file.endsWith(".json"),
);

function artifactMap(episodeNo) {
  const pattern = new RegExp(
    `^AB 新引擎(?:修复)? EP${episodeNo} (\\d+)/(\\d+) r(\\d+)(?: transport-r\\d+)?$`,
  );
  const map = new Map();
  for (const file of artifactNames) {
    const artifact = JSON.parse(
      readFileSync(path.join(ROOT, "runs", "artifacts", file), "utf8"),
    );
    if (Date.parse(artifact.at) < startedAt) continue;
    const match = String(artifact.label || "").match(pattern);
    if (!match) continue;
    const chunk = Number(match[1]);
    const attempt = Number(match[3]);
    const previous = map.get(chunk);
    if (
      !previous ||
      attempt > previous.attempt ||
      (attempt === previous.attempt &&
        Date.parse(artifact.at) > Date.parse(previous.artifact.at))
    ) {
      map.set(chunk, { attempt, artifact, file });
    }
  }
  return map;
}

const parsedSource = parseScript(readFileSync(path.join(ROOT, sourceFile), "utf8"));
const estimated = estimateAll(
  parsedSource,
  DEFAULT_OPTIONS,
  {},
  autoSplitScenes(parsedSource, DEFAULT_OPTIONS, {}),
);
const episodes = renumber(
  estimated,
  autoCuts(estimated, DEFAULT_OPTIONS),
  DEFAULT_OPTIONS,
);

mkdirSync(runDir, { recursive: true });
const summaries = [];

for (const episodeNo of wanted) {
  const episode = episodes.find((item) => item.no === episodeNo);
  if (!episode) throw new Error(`流程二没有第 ${episodeNo} 集`);
  rebuildCast([episode]);
  const sourceText = renderScript([episode]).replaceAll("**", "");
  const parsedEpisode = parseScript(sourceText).episodes[0];
  const artifacts = artifactMap(episodeNo);
  const sceneResults = [];
  const sceneInputs = [];

  for (const scene of parsedEpisode.scenes) {
    const sceneInput = buildSceneInput({ episode: parsedEpisode, scene, policy });
    const chunks = splitSceneInput(sceneInput, {
      targetSeconds: chunkSeconds,
      policy,
    });
    const plans = chunks.map((chunk) => {
      const hit = artifacts.get(chunk.chunkIndex);
      if (!hit) {
        throw new Error(
          `第${episodeNo}集 场 ${scene.key} 缺少第 ${chunk.chunkIndex}/${chunks.length} 段原始计划`,
        );
      }
      return {
        plan: parseScenePlan(hit.artifact.output),
        artifact: `runs/artifacts/${hit.file}`,
        attempt: hit.attempt,
      };
    });
    const merged = mergeScenePlans(
      plans.map((item) => item.plan),
      sceneInput.sceneId,
    );
    const before = validateScenePlan(merged, sceneInput, policy);
    const repaired = repairScenePlan(merged, sceneInput, policy);
    const validation = validateScenePlan(repaired.plan, sceneInput, policy);
    sceneInputs.push(sceneInput);
    sceneResults.push({
      sceneId: sceneInput.sceneId,
      plans,
      before,
      ...repaired,
      validation,
    });
  }

  let shotOffset = 1;
  const sceneTexts = sceneResults.map((result, index) => {
    const text = compileScenePlan(result.plan, sceneInputs[index], shotOffset);
    shotOffset += result.plan.shots.length;
    return text;
  });
  const output = `第${episodeNo}集：${episode.title}\n${sceneTexts.join("\n\n")}`;
  const parsedOutput = parseStoryboard(output);
  const outputValidation = validateStoryboard(parsedOutput, policy);
  const qc = runEngineQc(sourceText, output);
  const totalDuration = sceneResults.reduce(
    (sum, result) =>
      sum +
      result.plan.shots.reduce((sceneSum, shot) => sceneSum + Number(shot.duration || 0), 0),
    0,
  );
  const arbitration = arbitrateShotTimeline(
    sceneResults.flatMap((result) => result.plan.shots),
  );
  const summary = {
    episode: episodeNo,
    title: episode.title,
    flow2Estimate: episode.sec,
    noCastShots: (output.match(/人物：无/g) || []).length,
    totalDuration,
    planValidation: sceneResults.map((result) => result.validation),
    outputValidation,
    qc,
    arbitration: arbitration.stats,
    repairs: sceneResults.flatMap((result) => result.repairs),
    scenes: sceneResults.map((result) => ({
      sceneId: result.sceneId,
      before: result.before,
      plans: result.plans,
    })),
  };
  writeFileSync(path.join(runDir, `EP${episodeNo}-engine-replayed.md`), output);
  writeFileSync(
    path.join(runDir, `EP${episodeNo}-engine-replay-report.json`),
    JSON.stringify(summary, null, 2),
  );
  summaries.push(summary);

  const high =
    summary.noCastShots +
    summary.planValidation.reduce(
      (sum, item) => sum + item.issues.filter((issue) => issue.level === "高").length,
      0,
    ) +
    (outputValidation.stats.high || 0) +
    qc.filter((issue) => issue.level === "高").length;
  console.log(
    `[replay] EP${episodeNo} · ${outputValidation.stats.shots} shot / ${outputValidation.stats.clips} Clip / ${totalDuration}s · 高问题 ${high}`,
  );
}

writeFileSync(
  path.join(runDir, "replay-summary.json"),
  JSON.stringify(summaries, null, 2),
);
