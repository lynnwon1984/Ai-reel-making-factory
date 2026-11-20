import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import {
  guardSourceFacts,
  parseFactLedger,
  restoreProtectedQuotes,
} from "./stage-prompt-guard.mjs";
import { validateStoryBible } from "./stage-bible-guard.mjs";
import { validateScenePlan } from "./stage-scene-plan-guard.mjs";
import { validateSceneDraft } from "./stage-scene-guard.mjs";

const root = process.cwd();
const promptDir = path.join(root, "docs", "stage-adaptation-prompts");
const runDir = path.join(root, "runs", "stage-pipeline-smoke");
const sourceMapDir = path.join(root, "runs", "stage-prompt-smoke");
const apiBase =
  process.env.LOCAL_API_BASE || "http://127.0.0.1:1235/v1/chat/completions";
const model =
  process.env.LOCAL_MODEL || "qwen2.5-14b-instruct-abliterated";
const stage = process.argv[2] || "bible";
const targetSceneId = process.argv[3] || "S01";

mkdirSync(runDir, { recursive: true });

function read(relativePath) {
  const file = path.join(promptDir, relativePath);
  if (!existsSync(file)) throw new Error(`缺少文件：${relativePath}`);
  return readFileSync(file, "utf8").trim();
}

function configBody() {
  return read("examples/smoke-test-config.md")
    .match(/```yaml\n([\s\S]*?)```/)?.[1]
    ?.trim();
}

function sourceStory() {
  return read("examples/smoke-test-story.md")
    .split("\n## 这段样本")[0]
    .replace(/^# .+\n+/, "")
    .replace(/^-{3,}\s*$/gm, "")
    .trim();
}

function latestFileIn(directory, fragment, extension) {
  if (!existsSync(directory)) return "";
  const files = readdirSync(directory)
    .filter((file) => file.includes(fragment) && file.endsWith(extension))
    .map((file) => ({
      file,
      mtime: statSync(path.join(directory, file)).mtimeMs,
    }))
    .sort((left, right) => left.mtime - right.mtime);
  if (!files.length) return "";
  return path.join(directory, files.at(-1).file);
}

function latestFile(fragment, extension = ".md") {
  return latestFileIn(runDir, fragment, extension);
}

function readContent(fragment) {
  const file = latestFile(fragment);
  if (!file) throw new Error(`找不到 ${fragment} 的已生成内容`);
  return { file, content: readFileSync(file, "utf8").trim() };
}

function field(block, name) {
  return block.match(new RegExp(`^${name}:\\s*(.+)$`, "m"))?.[1]?.trim() || "";
}

function ensureNormalizedSourceMap() {
  const approvedPath = path.join(runDir, "source-map-normalized.json");
  if (existsSync(approvedPath)) {
    const normalized = JSON.parse(readFileSync(approvedPath, "utf8"));
    const guarded = guardSourceFacts(normalized.facts, sourceStory());
    return {
      ...normalized,
      corrections: [...(normalized.corrections ?? []), ...guarded.corrections],
      issues: guarded.issues,
      facts: guarded.facts,
    };
  }

  const existing = latestFileIn(sourceMapDir, "source-map", ".normalized.json");
  if (existing) {
    const normalized = JSON.parse(readFileSync(existing, "utf8"));
    const guarded = guardSourceFacts(normalized.facts, sourceStory());
    return {
      ...normalized,
      corrections: [...(normalized.corrections ?? []), ...guarded.corrections],
      issues: guarded.issues,
      facts: guarded.facts,
    };
  }

  const artifact = latestFileIn(sourceMapDir, "source-map", ".json");
  if (!artifact) {
    throw new Error("找不到 source-map 原始响应，请先运行 stage-prompt-smoke.mjs");
  }
  const raw = JSON.parse(readFileSync(artifact, "utf8"));
  const parsedEnvelope = JSON.parse(raw.rawResponse);
  const content = parsedEnvelope?.choices?.[0]?.message?.content;
  const parsed = parseFactLedger(content);
  const guarded = guardSourceFacts(parsed.facts, sourceStory());
  const normalized = {
    source: path.relative(root, artifact),
    corrections: guarded.corrections,
    issues: [...parsed.issues, ...guarded.issues],
    facts: guarded.facts,
  };
  const output = path.join(runDir, "source-map-normalized.json");
  writeFileSync(output, JSON.stringify(normalized, null, 2));
  return normalized;
}

async function callModel({ stageName, input, temperature, maxTokens = 4096 }) {
  const base = read("01-base-prompt.md");
  const body = {
    model,
    messages: [
      { role: "system", content: base },
      { role: "user", content: input },
    ],
    temperature,
    top_p: 0.9,
    max_tokens: maxTokens,
    stream: false,
  };
  const startedAt = new Date();
  const response = await fetch(apiBase, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(600_000),
  });
  const rawResponse = await response.text();
  const stamp = startedAt.toISOString().replace(/[:.]/g, "-");
  const artifact = path.join(runDir, `${stamp}-${stageName}.json`);

  // 原始响应先落盘，再从响应中提取便于下一步阅读的正文。
  writeFileSync(
    artifact,
    JSON.stringify(
      {
        at: startedAt.toISOString(),
        stage: stageName,
        promptVersion: "v1",
        model,
        request: body,
        httpStatus: response.status,
        rawResponse,
        ms: Date.now() - startedAt.getTime(),
      },
      null,
      2,
    ),
  );

  if (!response.ok) {
    throw new Error(`LM Studio 返回 HTTP ${response.status}；原始响应已保存：${artifact}`);
  }
  let envelope;
  try {
    envelope = JSON.parse(rawResponse);
  } catch {
    throw new Error(`响应不是合法 JSON；原始响应已保存：${artifact}`);
  }
  const content = envelope?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error(`响应缺少正文；原始响应已保存：${artifact}`);
  }

  const contentFile = path.join(runDir, `${stamp}-${stageName}.md`);
  writeFileSync(contentFile, content);
  appendFileSync(
    path.join(runDir, "index.jsonl"),
    `${JSON.stringify({
      at: startedAt.toISOString(),
      stage: stageName,
      model,
      httpStatus: response.status,
      usage: envelope.usage ?? null,
      artifact: path.relative(root, artifact),
      content: path.relative(root, contentFile),
    })}\n`,
  );
  console.log(`artifact: ${path.relative(root, artifact)}`);
  console.log(`content: ${path.relative(root, contentFile)}`);
  console.log(`usage: ${JSON.stringify(envelope.usage ?? null)}`);
  console.log("\n--- MODEL OUTPUT ---\n");
  console.log(content);
  return { artifact, contentFile, content };
}

function factsText(normalized) {
  return normalized.facts.map((fact) => JSON.stringify(fact)).join("\n");
}

if (stage === "bible") {
  const normalized = ensureNormalizedSourceMap();
  if (normalized.issues.length) {
    throw new Error(`事实账本仍有 ${normalized.issues.length} 个阻断项，不能进入故事圣经`);
  }
  console.log(`normalized: ${normalized.facts.length} facts, ${normalized.corrections.length} quote corrections`);
  const input = [
    "[PROJECT]",
    configBody(),
    "",
    "[FACTS]",
    factsText(normalized),
    "",
    "[PREVIOUS NOTES]",
    "无",
    "",
    "[CURRENT TASK]",
    read("03-story-bible.md"),
  ].join("\n");
  const result = await callModel({
    stageName: "story-bible",
    input,
    temperature: 0.2,
    maxTokens: 4096,
  });
  const castMax = Number(
    configBody()?.match(/^CAST_MAX:\s*(\d+)/m)?.[1] ?? Number.POSITIVE_INFINITY,
  );
  const issues = validateStoryBible(result.content, {
    castMax,
    source: sourceStory(),
  });
  writeFileSync(
    result.contentFile.replace(/\.md$/, ".guard.json"),
    JSON.stringify({ castMax, issues }, null, 2),
  );
  console.log(`bible guard: ${issues.length ? "FAIL" : "PASS"} (${issues.length} issues)`);
  for (const issue of issues) {
    console.log(`- [${issue.code}] ${issue.detail}`);
  }
  if (issues.length) process.exitCode = 2;
} else if (stage === "scene-plan") {
  const normalized = ensureNormalizedSourceMap();
  const bible = readContent("story-bible");
  const input = [
    "[PROJECT]",
    configBody(),
    "",
    "[STORY BIBLE]",
    bible.content,
    "",
    "[FACTS]",
    factsText(normalized),
    "",
    "[CURRENT ACT]",
    "ACT: 全部",
    "",
    "[CURRENT TASK]",
    read("04-scene-plan.md"),
  ].join("\n");
  const result = await callModel({
    stageName: "scene-plan",
    input,
    temperature: 0.2,
    maxTokens: 4096,
  });
  const targetMinutes = Number(
    configBody()?.match(/^TARGET_MINUTES:\s*(\d+)/m)?.[1] ?? Number.POSITIVE_INFINITY,
  );
  const checked = validateScenePlan(result.content, { targetMinutes });
  writeFileSync(
    result.contentFile.replace(/\.md$/, ".guard.json"),
    JSON.stringify(checked, null, 2),
  );
  console.log(
    `scene-plan guard: ${checked.issues.length ? "FAIL" : "PASS"} (${checked.issues.length} issues; ${checked.totalMinutes} min)`,
  );
  for (const issue of checked.issues) {
    console.log(`- [${issue.code}] ${issue.sceneId || "全剧"} ${issue.detail}`);
  }
  if (checked.issues.length) process.exitCode = 2;
} else if (stage === "scene-draft") {
  const normalized = ensureNormalizedSourceMap();
  if (normalized.issues.length) {
    throw new Error(`事实账本仍有 ${normalized.issues.length} 个阻断项，不能写场`);
  }
  const bible = readContent("story-bible");
  const plan = readContent("scene-plan");
  const cards = [...plan.content.matchAll(/^### (S\d+)\n([\s\S]*?)(?=^### S\d+\n|^## ACT CLOSE)/gm)];
  const currentIndex = cards.findIndex((card) => card[1] === targetSceneId);
  if (currentIndex < 0) throw new Error(`场景卡中没有找到 ${targetSceneId}`);
  const current = cards[currentIndex];
  const next = cards[currentIndex + 1];
  const previous = cards[currentIndex - 1];
  const card = `### ${current[1]}\n${current[2].trim()}`;
  const sourceRange = field(current[2], "SOURCE");
  const ids = [
    ...sourceRange.matchAll(/S(\d{3})/g),
  ];
  const from = ids.length ? Number(ids[0][1]) : 1;
  const to = ids.length > 1 ? Number(ids.at(-1)[1]) : from;
  const sourceFacts = normalized.facts
    .filter((fact) => {
      const id = Number(fact.source_id.slice(1));
      return id >= from && id <= to;
    })
    .map((fact) => JSON.stringify(fact))
    .join("\n");
  const nextEvent = next ? field(next[2], "EVENT") : "无，本场为最后一场";
  const nextSourceRange = next ? field(next[2], "SOURCE") : "";
  const nextIds = [...nextSourceRange.matchAll(/S(\d{3})/g)].map((match) => Number(match[1]));
  const nextFrom = nextIds.length ? Math.min(...nextIds) : Number.POSITIVE_INFINITY;
  const nextTo = nextIds.length ? Math.max(...nextIds) : Number.NEGATIVE_INFINITY;
  const forbiddenSnippets = normalized.facts
    .filter((fact) => {
      const id = Number(fact.source_id.slice(1));
      return id >= nextFrom && id <= nextTo;
    })
    .flatMap((fact) => [
      ...(fact.quotes ?? []).map((quote) => quote.text),
      ...(fact.motifs ?? []),
    ])
    .map((text) => String(text ?? "").replace(/[。！？，、；：\s]/g, ""))
    .filter((text) => text.length >= 2);
  const minutes = field(current[2], "EST_MINUTES");
  const minuteNums = minutes.match(/\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  const minuteMidpoint = minuteNums.length
    ? (minuteNums[0] + (minuteNums[1] ?? minuteNums[0])) / 2
    : 2;
  const minHanChars = Math.max(350, Math.round(minuteMidpoint * 180));
  const input = [
    "[PROJECT]",
    configBody(),
    "",
    "[STORY BIBLE]",
    bible.content,
    "",
    "[PREVIOUS]",
    `PREVIOUS_EVENTS: ${previous ? field(previous[2], "CHANGE") : "无，本场为开场"}`,
    `PREVIOUS_PROPS: ${previous ? field(previous[2], "PROPS") : "无"}`,
    `ENTRY_STATE: ${field(current[2], "ON_STAGE_OPEN")}`,
    "",
    "[CURRENT SCENE CARD]",
    card,
    "",
    "[SOURCE]",
    sourceFacts || "无对应事实",
    "",
    "[NEXT BOUNDARY]",
    `本场必须留下的状态：${field(current[2], "CHANGE")}`,
    `不得提前发生：${nextEvent}`,
    "",
    "[FORBIDDEN]",
    forbiddenSnippets.join("\n") || "无",
    "",
    "[DRAFT BUDGET]",
    `最低汉字数：${minHanChars}`,
    "",
    "[CURRENT TASK]",
    read("05-scene-draft.md"),
  ].join("\n");
  const result = await callModel({
    stageName: `scene-draft-${targetSceneId}`,
    input,
    temperature: 0.4,
    maxTokens: 4096,
  });
  const sourceQuotes = normalized.facts
    .filter((fact) => {
      const id = Number(fact.source_id.slice(1));
      return id >= from && id <= to;
    })
    .flatMap((fact) => fact.quotes ?? [])
    .map((quote) => quote.text);
  const restored = restoreProtectedQuotes(result.content, sourceQuotes);
  const normalizedScenePath = result.contentFile.replace(/\.md$/, ".normalized.md");
  writeFileSync(normalizedScenePath, `${restored.text.trim()}\n`);
  const checked = validateSceneDraft(restored.text, {
    minHanChars,
    sourceQuotes,
    forbiddenSnippets,
  });
  writeFileSync(
    result.contentFile.replace(/\.md$/, ".guard.json"),
    JSON.stringify({
      minHanChars,
      sourceQuotes,
      forbiddenSnippets,
      quoteCorrections: restored.corrections,
      issues: checked.issues,
    }, null, 2),
  );
  console.log(
    `scene guard: ${checked.issues.length ? "FAIL" : "PASS"} (${checked.hanChars}/${minHanChars} Han chars)`,
  );
  for (const issue of checked.issues) {
    console.log(`- [${issue.code}] ${issue.detail}`);
  }
  if (checked.issues.length) process.exitCode = 2;
} else if (stage === "scene-repair") {
  const normalized = ensureNormalizedSourceMap();
  if (normalized.issues.length) {
    throw new Error(`事实账本仍有 ${normalized.issues.length} 个阻断项，不能返修`);
  }
  const bible = readContent("story-bible");
  const plan = readContent("scene-plan");
  const draft = readContent(`scene-draft-${targetSceneId}`);
  const guardFile = latestFile(`scene-draft-${targetSceneId}`, ".guard.json");
  if (!guardFile) {
    throw new Error(`找不到 ${targetSceneId} 的 guard.json，请先运行 scene-draft`);
  }
  const guard = JSON.parse(readFileSync(guardFile, "utf8"));
  if (!guard.issues?.length) {
    console.log(`${targetSceneId} 已通过验收，无需返修`);
    process.exit(0);
  }
  const cards = [...plan.content.matchAll(/^### (S\d+)\n([\s\S]*?)(?=^### S\d+\n|^## ACT CLOSE)/gm)];
  const currentIndex = cards.findIndex((card) => card[1] === targetSceneId);
  if (currentIndex < 0) throw new Error(`场景卡中没有找到 ${targetSceneId}`);
  const current = cards[currentIndex];
  const next = cards[currentIndex + 1];
  const card = `### ${current[1]}\n${current[2].trim()}`;
  const sourceRange = field(current[2], "SOURCE");
  const sourceIds = [...sourceRange.matchAll(/S(\d{3})/g)].map((match) => Number(match[1]));
  const sourceFrom = sourceIds.length ? Math.min(...sourceIds) : Number.POSITIVE_INFINITY;
  const sourceTo = sourceIds.length ? Math.max(...sourceIds) : Number.NEGATIVE_INFINITY;
  const sourceFacts = normalized.facts
    .filter((fact) => {
      const id = Number(fact.source_id.slice(1));
      return id >= sourceFrom && id <= sourceTo;
    })
    .map((fact) => JSON.stringify(fact))
    .join("\n");
  const issueRows = guard.issues
    .map(
      (issue, index) =>
        `${targetSceneId}-Q${String(index + 1).padStart(2, "0")} | ${issue.severity || "P0"} | ${issue.code} | ${issue.detail} | 保持既有事件和受保护台词；按问题修复，并达到至少 ${guard.minHanChars} 个汉字`,
    )
    .join("\n");
  const protectedLines = (guard.sourceQuotes ?? []).join("\n");
  const nextSourceRange = next ? field(next[2], "SOURCE") : "";
  const nextIds = [...nextSourceRange.matchAll(/S(\d{3})/g)].map((match) => Number(match[1]));
  const nextFrom = nextIds.length ? Math.min(...nextIds) : Number.POSITIVE_INFINITY;
  const nextTo = nextIds.length ? Math.max(...nextIds) : Number.NEGATIVE_INFINITY;
  const forbiddenSnippets = normalized.facts
    .filter((fact) => {
      const id = Number(fact.source_id.slice(1));
      return id >= nextFrom && id <= nextTo;
    })
    .flatMap((fact) => [
      ...(fact.quotes ?? []).map((quote) => quote.text),
      ...(fact.motifs ?? []),
    ])
    .map((text) => String(text ?? "").replace(/[。！？，、；：\s]/g, ""))
    .filter((text) => text.length >= 2);
  const input = [
    "[PROJECT]",
    configBody(),
    "",
    "[STORY BIBLE]",
    bible.content,
    "",
    "[SCENE CARD]",
    card,
    "",
    "[FINAL SCENE]",
    draft.content,
    "",
    "[SOURCE FACTS]",
    sourceFacts,
    "",
    "[ISSUES]",
    issueRows,
    "",
    "[PROTECTED LINES]",
    protectedLines || "无",
    "",
    "[FORBIDDEN]",
    forbiddenSnippets.join("\n") || "无",
    "",
    "[DRAFT BUDGET]",
    `最低汉字数：${guard.minHanChars}`,
    "",
    "[CURRENT TASK]",
    read("05b-scene-expand.md"),
  ].join("\n");
  const result = await callModel({
    stageName: `scene-repair-${targetSceneId}`,
    input,
    temperature: 0.25,
    maxTokens: 4096,
  });
  const revisedScene =
    result.content.split(/^REVISED_SCENE\s*$/m)[1]?.trim() || result.content.trim();
  const restored = restoreProtectedQuotes(revisedScene, guard.sourceQuotes);
  const checked = validateSceneDraft(restored.text, {
    minHanChars: guard.minHanChars,
    sourceQuotes: guard.sourceQuotes,
    forbiddenSnippets,
  });
  writeFileSync(
    result.contentFile.replace(/\.md$/, ".guard.json"),
    JSON.stringify({
      minHanChars: guard.minHanChars,
      sourceQuotes: guard.sourceQuotes,
      forbiddenSnippets,
      quoteCorrections: restored.corrections,
      issues: checked.issues,
    }, null, 2),
  );
  if (restored.text.trim()) {
    writeFileSync(
      path.join(runDir, `scene-${targetSceneId}-revised.md`),
      `${restored.text.trim()}\n`,
    );
  }
  console.log(
    `scene repair guard: ${checked.issues.length ? "FAIL" : "PASS"} (${checked.hanChars}/${guard.minHanChars} Han chars)`,
  );
  for (const issue of checked.issues) {
    console.log(`- [${issue.code}] ${issue.detail}`);
  }
  if (checked.issues.length) process.exitCode = 2;
} else {
  throw new Error(`未知阶段：${stage}。可用：bible / scene-plan / scene-draft / scene-repair`);
}
