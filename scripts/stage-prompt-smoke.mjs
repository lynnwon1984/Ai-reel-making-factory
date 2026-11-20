import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import {
  guardSourceFacts,
  parseFactLedger,
} from "./stage-prompt-guard.mjs";

const root = process.cwd();
const promptDir = path.join(root, "docs", "stage-adaptation-prompts");
const storyPath = path.join(promptDir, "examples", "smoke-test-story.md");
const basePath = path.join(promptDir, "01-base-prompt.md");
const taskPath = path.join(promptDir, "02-source-map.md");
const apiBase =
  process.env.LOCAL_API_BASE || "http://127.0.0.1:1235/v1/chat/completions";
const model =
  process.env.LOCAL_MODEL || "qwen2.5-14b-instruct-abliterated";

for (const required of [storyPath, basePath, taskPath]) {
  if (!existsSync(required)) {
    throw new Error(`缺少文件：${path.relative(root, required)}`);
  }
}

const base = readFileSync(basePath, "utf8").trim();
const task = readFileSync(taskPath, "utf8").trim();
const source = readFileSync(storyPath, "utf8")
  .split("\n## 这段样本")[0]
  .replace(/^# .+\n+/, "")
  .replace(/^-{3,}\s*$/gm, "")
  .trim();

const input = [
  "[SOURCE CHUNK]",
  "CHUNK_INDEX: 1",
  "START_ID: S001",
  "章节或段落范围：全文",
  "原文：",
  source,
].join("\n");

const messages = [
  { role: "system", content: base },
  { role: "user", content: `${input}\n\n[CURRENT TASK]\n${task}` },
];
const body = {
  model,
  messages,
  temperature: 0.2,
  top_p: 0.85,
  max_tokens: 4096,
  stream: false,
};

const startedAt = new Date();
const response = await fetch(apiBase, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
  signal: AbortSignal.timeout(180_000),
});
const raw = await response.text();
const at = startedAt.toISOString();
const suffix = at.replace(/[:.]/g, "-");
const outDir = path.join(root, "runs", "stage-prompt-smoke");
mkdirSync(outDir, { recursive: true });
const artifactPath = path.join(outDir, `${suffix}-source-map.json`);

// 项目约定：模型原始响应必须先落盘，再做任何解析。
writeFileSync(
  artifactPath,
  JSON.stringify(
    {
      at,
      apiBase,
      model,
      stage: "source-map",
      promptVersion: "v1",
      request: body,
      httpStatus: response.status,
      rawResponse: raw,
      ms: Date.now() - startedAt.getTime(),
    },
    null,
    2,
  ),
);

const indexLine = JSON.stringify({
  at,
  stage: "source-map",
  model,
  httpStatus: response.status,
  artifact: path.relative(root, artifactPath),
});
appendFileSync(path.join(outDir, "index.jsonl"), `${indexLine}\n`);

if (!response.ok) {
  throw new Error(`LM Studio 返回 HTTP ${response.status}；原始响应已保存`);
}

let data;
try {
  data = JSON.parse(raw);
} catch {
  throw new Error(`响应不是合法 JSON；原始响应已保存：${artifactPath}`);
}

const content = data?.choices?.[0]?.message?.content;
if (typeof content !== "string" || !content.trim()) {
  throw new Error(`响应缺少 choices[0].message.content；原始响应已保存：${artifactPath}`);
}

const parsed = parseFactLedger(content);
const guarded = guardSourceFacts(parsed.facts, source);
const facts = guarded.facts;
const checks = [
  ...parsed.issues.map((issue) => issue.detail),
  ...guarded.issues.map((issue) => issue.detail),
];

const sourceIndexText = content.split("SOURCE_INDEX")[1]?.split("COVERAGE")[0] ?? "";
const indexedRows = sourceIndexText
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => /^S\d{3}\s*\|/.test(line));
if (indexedRows.length !== facts.length) {
  checks.push(`SOURCE_INDEX 有 ${indexedRows.length} 行，FACTS_JSONL 有 ${facts.length} 行`);
}
if (content.includes("SOURCE_INDEX") && /^\s*\.\.\.\s*$/m.test(sourceIndexText)) {
  checks.push("SOURCE_INDEX 使用了省略号，必须逐条列出");
}

const lastId = content.match(/last_source_id:\s*(S\d{3})/)?.[1];
if (facts.length && lastId !== facts.at(-1)?.source_id) {
  checks.push(`last_source_id=${lastId || "无"}，实际最后一条=${facts.at(-1)?.source_id}`);
}

const normalizedPath = artifactPath.replace(/\.json$/, ".normalized.json");
writeFileSync(
  normalizedPath,
  JSON.stringify(
    {
      at,
      model,
      stage: "source-map",
      promptVersion: "v1",
      source: path.relative(root, artifactPath),
      corrections: guarded.corrections,
      issues: [...parsed.issues, ...guarded.issues],
      facts,
    },
    null,
    2,
  ),
);

console.log(`artifact: ${path.relative(root, artifactPath)}`);
console.log(`normalized: ${path.relative(root, normalizedPath)}`);
console.log(`quote corrections: ${guarded.corrections.length}`);
for (const correction of guarded.corrections) {
  console.log(`- ${correction.sourceId}: ${correction.from} -> ${correction.to}`);
}
console.log(`usage: ${JSON.stringify(data.usage ?? null)}`);
console.log(`validation: ${checks.length ? "FAIL" : "PASS"} (${facts.length} facts)`);
for (const issue of checks) console.log(`- ${issue}`);
console.log("\n--- MODEL OUTPUT ---\n");
console.log(content);
