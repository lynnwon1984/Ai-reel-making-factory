import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { parseScript } from "../src/split.js";
import {
  buildSceneInput,
  arbitrateShotTimeline,
  compileScenePlan,
  getScenePlanPolicy,
  mergeScenePlans,
  parseScenePlan,
  repairScenePlan,
  renderScenePlanPrompt,
  renderSceneInput,
  splitSceneInput,
  validateScenePlan,
} from "../src/scene-engine.js";
import { parseStoryboard, validateStoryboard } from "../src/storyboard.js";
import { runEngineQc } from "../src/qc-engine.js";

const ROOT = process.cwd();
const sourceFile = process.argv[2] || "tests/fixtures/final-script.txt";
const sceneKey = process.argv[3] || "1-1";
const policyName = process.argv[4] || process.env.SCENE_PLAN_PROFILE || "strict3";
const policy = getScenePlanPolicy(policyName);
const endpoint = process.env.SCENE_PLAN_ENDPOINT || "http://127.0.0.1:4190/api/chat";
const chunkSeconds = Number(process.argv[5] || process.env.SCENE_PLAN_CHUNK_SECONDS || 20);
const concurrency = Math.max(1, Number(process.env.SCENE_PLAN_CONCURRENCY || 3));

async function runModel({ instructions, input, label }) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      instructions,
      input,
      effort: "low",
      maxOutputTokens: 64000,
      label,
      runId: `scene-plan-${Date.now()}`,
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

const parsed = parseScript(readFileSync(path.join(ROOT, sourceFile), "utf8"));
const found = findScene(parsed);
const sceneInput = buildSceneInput({
  episode: found.episode,
  scene: found.scene,
  nextScene: nextSceneText(found),
  policy,
});
const instructions = renderScenePlanPrompt(
  readFileSync(path.join(ROOT, "src/prompts/scene-plan.md"), "utf8"),
  policy,
);
const chunks = splitSceneInput(sceneInput, { targetSeconds: chunkSeconds, policy });

console.log(
  `[scene-plan] ${sourceFile} · ${sceneKey} · ${policy.label} · ${sceneInput.blocks.length} blocks · ${chunks.length} chunks`,
);

function issuesText(issues) {
  return issues
    .map((issue) => `- [${issue.level}] ${issue.where}: ${issue.msg}`)
    .join("\n");
}

async function planChunk(chunkInput, ordinal) {
  const input = renderSceneInput(chunkInput);
  let attempt = 1;
  let result = await runModel({
    instructions,
    input,
    label: `场景规划 ${sceneKey} ${policyName} ${ordinal}/${chunks.length} r${attempt}`,
  });
  if (result.done?.status !== "completed") {
    throw new Error(`第 ${ordinal} 段模型调用未完整结束：${result.done?.status || "unknown"}`);
  }

  let plan = parseScenePlan(result.text);
  let validation = validateScenePlan(plan, chunkInput, policy);
  const high = validation.issues.filter((issue) => issue.level === "高");

  if (high.length) {
    attempt += 1;
    const repairInput = `【原始场景切片】\n${input}\n\n【上一版镜头计划】\n${result.text}\n\n【必须修复的问题】\n${issuesText(validation.issues)}\n\n请只修复上述问题，保持所有源块各出现一次，只输出完整合法 JSON。`;
    result = await runModel({
      instructions,
      input: repairInput,
      label: `场景规划修复 ${sceneKey} ${policyName} ${ordinal}/${chunks.length} r${attempt}`,
    });
    if (result.done?.status !== "completed") {
      throw new Error(`第 ${ordinal} 段修复调用未完整结束：${result.done?.status || "unknown"}`);
    }
    plan = parseScenePlan(result.text);
    validation = validateScenePlan(plan, chunkInput, policy);
  }

  return { plan, validation, result, attempts: attempt, inputChars: input.length };
}

const chunkPlans = Array(chunks.length);
const chunkResults = Array(chunks.length);
let nextChunk = 0;
async function worker() {
  for (;;) {
    const index = nextChunk;
    nextChunk += 1;
    if (index >= chunks.length) return;
    const chunkInput = chunks[index];
    const run = await planChunk(chunkInput, index + 1);
    chunkPlans[index] = run.plan;
    chunkResults[index] = {
      index: index + 1,
      blocks: chunkInput.blocks.length,
      estimatedSeconds: chunkInput.estimatedSeconds,
      attempts: run.attempts,
      stats: run.validation.stats,
      issues: run.validation.issues,
      usage: run.result.done?.usage || null,
    };
    console.log(
      `[scene-plan] chunk ${index + 1}/${chunks.length}: ${chunkInput.blocks.length} blocks, ${chunkInput.estimatedSeconds}s, ${run.validation.stats.shots} shots, ${run.validation.stats.overloadedClips} overloaded`,
    );
  }
}
await Promise.all(Array.from({ length: Math.min(concurrency, chunks.length) }, () => worker()));

const mergedPlan = mergeScenePlans(chunkPlans, sceneInput.sceneId);
const repaired = repairScenePlan(mergedPlan, sceneInput, policy);
const plan = repaired.plan;
const validation = validateScenePlan(plan, sceneInput, policy);
const storyboard = compileScenePlan(plan, sceneInput);
const arbitration = arbitrateShotTimeline(plan.shots);

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outDir = path.join(ROOT, "runs", "scene-plan");
mkdirSync(outDir, { recursive: true });
writeFileSync(
  path.join(outDir, `${stamp}-${sceneKey}-${policyName}.json`),
  JSON.stringify(
    {
      policy: policyName,
      chunkSeconds,
      concurrency,
      estimatedSeconds: sceneInput.estimatedSeconds,
      chunks: chunkResults,
      repairs: repaired.repairs,
      plan,
    },
    null,
    2,
  ),
);
writeFileSync(path.join(outDir, `${stamp}-${sceneKey}-${policyName}.md`), storyboard);

const parsedOutput = parseStoryboard(
  `第${found.episode.no}集${found.episode.title ? `：${found.episode.title}` : ""}\n${storyboard}`,
);
const finalCheck = validateStoryboard(parsedOutput, policy);
const sourceText = [
  `第${found.episode.no}集${found.episode.title ? `：${found.episode.title}` : ""}`,
  found.scene.place,
  found.scene.cast ? `人物：${found.scene.cast}` : "",
  ...found.scene.body,
]
  .filter(Boolean)
  .join("\n");
const finalQc = runEngineQc(
  sourceText,
  `第${found.episode.no}集${found.episode.title ? `：${found.episode.title}` : ""}\n${storyboard}`,
);

console.log(
  JSON.stringify(
    {
      policy: policyName,
      chunks: chunkResults,
      repairs: repaired.repairs,
      arbitration: { stats: arbitration.stats, groups: arbitration.groups.map((group) => ({ no: group.no, duration: group.duration, status: group.status, firstShotIndex: group.firstShotIndex, lastShotIndex: group.lastShotIndex })) },
      plan: validation.stats,
      planIssues: validation.issues,
      finalCheck: finalCheck.stats,
      finalIssues: finalCheck.issues,
      contentQc: finalQc,
      arbitrationIssues: arbitration.issues,
      outputDir: path.relative(ROOT, outDir),
    },
    null,
    2,
  ),
);
