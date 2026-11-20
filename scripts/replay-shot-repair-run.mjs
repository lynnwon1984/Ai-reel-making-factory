import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { parseScript } from "../src/split.js";
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
  repairScenePlan,
  splitSceneInput,
  validateScenePlan,
} from "../src/scene-engine.js";
import { applyShotRepairPlan } from "../src/shot-repair.js";

const ROOT = process.cwd();
const sceneKey = process.argv[2] || "4-2";
const artifactSceneKey = process.env.SCENE_REPLAY_ID || sceneKey;
const since = process.argv[3] || "1970-01-01T00:00:00.000Z";
const labelPrefix = process.argv[4] || `三场AB 实验 ${sceneKey} 动作场`;
const outputFile = process.argv[5] || "";
const sourceFile = process.argv[6] || "tests/fixtures/final-script.txt";
const policy = getScenePlanPolicy("flexible6");

function latestArtifact(fragment) {
  const artifacts = readdirSync(path.join(ROOT, "runs", "artifacts"))
    .map((file) => {
      const entry = JSON.parse(
        readFileSync(path.join(ROOT, "runs", "artifacts", file), "utf8"),
      );
      return { ...entry, file };
    })
    .filter(
      (entry) =>
        Date.parse(entry.at) >= Date.parse(since) &&
        String(entry.label || "").includes(fragment),
    )
    .sort((left, right) => Date.parse(left.at) - Date.parse(right.at));
  if (!artifacts.length) throw new Error(`找不到产物：${fragment}`);
  return artifacts.at(-1);
}

const parsed = parseScript(readFileSync(path.join(ROOT, sourceFile), "utf8"));
let found = null;
for (const episode of parsed.episodes) {
  for (const scene of episode.scenes) {
    if (scene.key === sceneKey) found = { episode, scene };
  }
}
if (!found) throw new Error(`找不到场景 ${sceneKey}`);

const briefArtifact = latestArtifact(`${labelPrefix} 导演提示单`);
const brief = parseScenePlan(briefArtifact.output);
const baseInput = buildSceneInput({
  episode: found.episode,
  scene: found.scene,
  policy,
});
const sceneInput = {
  ...baseInput,
  directorBrief: brief.directorBrief,
  sceneGeography: brief.sceneGeography,
};
const chunks = splitSceneInput(sceneInput, { targetSeconds: 20, policy });
const plans = [];

for (let index = 0; index < chunks.length; index += 1) {
  const chunkInput = chunks[index];
  const draft = latestArtifact(
    `${labelPrefix} 镜头计划 第${found.episode.no}集 ${artifactSceneKey} ${index + 1}/${chunks.length}`,
  );
  // 旧 trace 的 shot 序号来自当时尚未加入新本地拆镜的版本；
  // 必须先把旧修复按原序号合回，再套用当前本地修复规则。
  let plan = parseScenePlan(draft.output);
  for (let round = 1; round <= 3; round += 1) {
    let repair;
    try {
      repair = latestArtifact(
        `${labelPrefix} 定点修复 第${found.episode.no}集 ${artifactSceneKey} ${index + 1}/${chunks.length} r${round}`,
      );
    } catch {
      break;
    }
    plan = applyShotRepairPlan(plan, parseScenePlan(repair.output)).plan;
  }
  plan = repairScenePlan(plan, chunkInput, policy).plan;
  plans.push(plan);
}

const merged = mergeScenePlans(plans, sceneKey, {
  schemaVersion: ACTION_UNIT_SCHEMA_VERSION,
  directorBrief: brief.directorBrief,
  sceneGeography: brief.sceneGeography,
});
const repaired = repairScenePlan(merged, sceneInput, policy);
const validation = validateScenePlan(repaired.plan, sceneInput, policy);
const actionAudit = auditShotActionDensity(repaired.plan, sceneInput);
const continuityAudit = auditShotContinuity(repaired.plan, sceneInput);
const responsibilityAudit = auditShotResponsibilities(repaired.plan);
const issues = [
  ...validation.issues,
  ...actionAudit.issues,
  ...continuityAudit.issues,
  ...responsibilityAudit.issues,
];
const output = compileScenePlan(repaired.plan, sceneInput);

if (outputFile) writeFileSync(path.resolve(ROOT, outputFile), output);
console.log(
  JSON.stringify(
    {
      sceneKey,
      since,
      chunks: chunks.length,
      shots: repaired.plan.shots.length,
      clips: repaired.plan.shots.reduce(
        (sum, shot) => sum + (shot.clips?.length || 0),
        0,
      ),
      duration: repaired.plan.shots.reduce(
        (sum, shot) => sum + Number(shot.duration || 0),
        0,
      ),
      high: issues.filter((issue) => issue.level === "高").length,
      mid: issues.filter((issue) => issue.level === "中").length,
      issues,
      repairs: repaired.repairs,
      outputFile: outputFile ? path.resolve(ROOT, outputFile) : "",
    },
    null,
    2,
  ),
);
