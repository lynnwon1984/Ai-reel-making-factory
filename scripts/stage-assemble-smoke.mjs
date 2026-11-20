import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  restoreProtectedQuotes,
} from "./stage-prompt-guard.mjs";
import { validateSceneDraft } from "./stage-scene-guard.mjs";

const root = process.cwd();
const runDir = path.join(root, "runs", "stage-pipeline-smoke");
const normalizedPath = path.join(runDir, "source-map-normalized.json");
const plan = readLatest("scene-plan");
const normalized = JSON.parse(readFileSync(normalizedPath, "utf8"));
const cards = [
  ...plan.matchAll(/^### (S\d+)\n([\s\S]*?)(?=^### S\d+\n|^## ACT CLOSE)/gm),
].map((match) => ({ id: match[1], block: match[2] }));

function readLatest(fragment) {
  if (!existsSync(runDir)) throw new Error("找不到流水线输出目录");
  const files = readdirSync(runDir)
    .filter((file) => file.includes(fragment) && file.endsWith(".md"))
    .map((file) => ({
      file,
      mtime: statSync(path.join(runDir, file)).mtimeMs,
    }))
    .sort((left, right) => left.mtime - right.mtime);
  if (!files.length) throw new Error(`找不到 ${fragment}`);
  return readFileSync(path.join(runDir, files.at(-1).file), "utf8");
}

function field(block, name) {
  return block.match(new RegExp(`^${name}:\\s*(.+)$`, "m"))?.[1]?.trim() || "";
}

function sourceFactsFor(block) {
  const ids = [...field(block, "SOURCE").matchAll(/S(\d{3})/g)].map((match) =>
    Number(match[1]),
  );
  const from = ids.length ? Math.min(...ids) : Number.POSITIVE_INFINITY;
  const to = ids.length ? Math.max(...ids) : Number.NEGATIVE_INFINITY;
  return normalized.facts.filter((fact) => {
    const id = Number(fact.source_id.slice(1));
    return id >= from && id <= to;
  });
}

function forbiddenFor(block) {
  if (!block) return [];
  const quotes = sourceFactsFor(block)
    .flatMap((fact) => fact.quotes ?? [])
    .map((quote) => quote.text.replace(/[。！？，、；：\s]/g, ""))
    .filter((text) => text.length >= 3);
  const motifs = sourceFactsFor(block)
    .flatMap((fact) => fact.motifs ?? [])
    .map((text) => text.replace(/[。！？，、；：\s]/g, ""))
    .filter((text) => text.length >= 2);
  return [...new Set([...quotes, ...motifs])];
}

function budgetFor(block) {
  const numbers = field(block, "EST_MINUTES").match(/\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  const midpoint = numbers.length
    ? (numbers[0] + (numbers[1] ?? numbers[0])) / 2
    : 2;
  return Math.max(350, Math.round(midpoint * 180));
}

const scenes = [];
const issues = [];
for (const [index, card] of cards.entries()) {
  const file = path.join(runDir, `scene-${card.id}-approved.md`);
  if (!existsSync(file)) {
    issues.push(`${card.id}: 缺少 ${path.basename(file)}`);
    continue;
  }
  const raw = readFileSync(file, "utf8");
  const facts = sourceFactsFor(card.block);
  const sourceQuotes = facts.flatMap((fact) => fact.quotes ?? []).map((quote) => quote.text);
  const restored = restoreProtectedQuotes(raw, sourceQuotes);
  const checked = validateSceneDraft(restored.text, {
    minHanChars: budgetFor(card.block),
    sourceQuotes,
    forbiddenSnippets: forbiddenFor(cards[index + 1]?.block),
  });
  for (const issue of checked.issues) {
    issues.push(`${card.id}: [${issue.code}] ${issue.detail}`);
  }
  scenes.push(restored.text.trim());
}

const output = [
  "借伞",
  "",
  "舞台剧围读稿 v1",
  "",
  "人物：周岚、周启明",
  "舞台：固定修表铺主景；门框、柜台和抽屉构成主要表演区。",
  "声音：雨声贯穿，柜台灯负责场段收束。",
  "",
  ...scenes.flatMap((scene) => [scene, ""]),
].join("\n");
const outputPath = path.join(runDir, "borrow-umbrella-rehearsal-draft-v1.md");
writeFileSync(outputPath, output);
writeFileSync(
  path.join(runDir, "assembly-report.json"),
  JSON.stringify(
    {
      output: path.relative(root, outputPath),
      scenes: cards.map((card) => card.id),
      issues,
    },
    null,
    2,
  ),
);

console.log(`output: ${path.relative(root, outputPath)}`);
console.log(`assembly: ${issues.length ? "FAIL" : "PASS"} (${scenes.length}/${cards.length} scenes)`);
for (const issue of issues) console.log(`- ${issue}`);
if (issues.length) process.exitCode = 1;
