import { useMemo, useRef, useState } from "react";
import {
  ArrowsClockwise,
  UploadSimple,
  DownloadSimple,
  WarningCircle,
  SquaresFour,
  Play,
  Stop,
  CheckCircle,
  CopySimple,
} from "@phosphor-icons/react";
import { runStream } from "./api.js";
import { PromptSlot } from "./PromptSlot.jsx";
import { buildLedger, ledgerSeed, shouldPause, segmentStart } from "./relay.js";
import { runChunked } from "./chunked.js";
import {
  parseStoryboard,
  validateStoryboard,
  splitEpisodes,
} from "./storyboard.js";
import defaultStoryboard from "./prompts/default-storyboard.md?raw";
import qcPrompt from "./prompts/qc-storyboard.md?raw";
import { parseQc, countByLevel, collectBatchIssues, topIssues, hasHigh, sortIssues } from "./qc.js";
import { runEngineQc } from "./qc-engine.js";
import { auditStateChain } from "./state-chain.js";
import { auditBlocking } from "./blocking.js";
import { auditBeatClaims, numberStoryboardBeats } from "./beat-claim.js";
import { normalizeStoryboard } from "./normalize.js";
import { verifyModelIssues } from "./qc-verify.js";
import { buildDeliveryPackage } from "./delivery-package.js";
import { runExperimentalScript } from "./experimental-engine.js";
import { runStableV5Script } from "./stable-v5-engine.js";
import { getScenePlanPolicy, renderScenePlanPrompt } from "./scene-engine.js";
import experimentalBriefPrompt from "./prompts/director-brief.md?raw";
import experimentalScenePrompt from "./prompts/scene-plan.md?raw";
import stableV5Prompt from "./prompts/stable-v5-plan.md?raw";

const STORAGE_KEY = "pd-storyboard-v1";

/** 提示词文件前面有助手写的元信息，只取正文 */
const defaultPromptBody = (() => {
  const i = defaultStoryboard.indexOf("# 海外竖屏短剧 AI 分镜提示词");
  return i >= 0 ? defaultStoryboard.slice(i) : defaultStoryboard;
})();

const INITIAL = {
  stage: "input", // input | running | paused | done
  mode: "paste",
  text: "",
  fileName: "",
  customPrompt: "",
  customDirectorPrompt: "",
  customScenePlanPrompt: "",
  customStableV5Prompt: "",
  engineMode: "stable-v5",
  engineEffort: "low",
  engineChunkSeconds: 20,
  experimentDraft: null,
  stableV5Draft: null,
  batchSize: 3,
  /** 每批单独存，重跑才有粒度可谈 */
  batches: [],
  /** 下一批要跑的索引 */
  cursor: 0,
  /** 每 N 批停一次；0 = 不停 */
  checkpoint: 2,
  /** 停在检查点时已完成多少批 */
  pausedAt: 0,
  /** 这次停下的原因：checkpoint | qc */
  pauseReason: "",
  /** 生成后是否跑内容质检 */
  qcEnabled: true,
  acceptEngineMid: false,
  /** 调用前是否重申一次的格式硬约束 */
  strictFormat: true,
  error: "",
};

const BEAT_FORMAT_REMINDER = `【源拍认领硬约束·优先于其它说明】
每个 shot 表头必须写 \`拍：起-止\`，按本集从 1 连续认领输入中的 \`[拍NN]\`。
一个 shot 最多认领 3 拍，且最多包含 1 个动作源拍；不得漏拍、重复或倒序。
硬性判废：一个 \`拍\` 范围内如果出现两行以 \`△\` 开头的源拍，必须拆成两个 shot；不得合并。

`;

/** 编译层：不改用户提示词，只把协议里的时长硬约束在每次调用前重申一次 */
const FORMAT_REMINDER = `【格式硬约束·优先于其它说明】
每个 shot 的标注时长必须在 5–15 秒之间，且严格等于其 Clip 时长之和。
只有 1 个 Clip 的 shot，这个 Clip 至少 5 秒。
时长低于 5 秒的 shot 视为不合格。
每集 shot 编号从 01 连续编号，中途不得重新从 01 开始。

`;

const STEPS = [
  { n: 1, label: "输入" },
  { n: 2, label: "提示词" },
  { n: 3, label: "生成" },
  { n: 4, label: "校验与交付" },
];

/** 步骤条状态：任何时刻只有一步是 active */
function stepState(stage, n, hasText) {
  if (stage === "input") {
    if (!hasText) return n === 1 ? "active" : "";
    return n < 2 ? "done" : n === 2 ? "active" : "";
  }
  if (stage === "running" || stage === "paused") {
    return n < 3 ? "done" : n === 3 ? "active" : "";
  }
  // done：1–4 已完成，5 是还剩的那件可选事
  return n <= 4 ? "done" : "active";
}

/** 示例分镜：用来在不调模型的情况下看解析与校验效果 */
const SAMPLE_STORYBOARD = `第1集：测试
【分镜01】
[shot01 | 时长：12秒 | 场景：Village 外 雪天 | 人物：村长（Village Chief，着装：粗布冬装）、男弟子（Male Disciple，着装：弟子法袍） | 道具：法杖]
人物空间位置：
村长倒在雪地上，男弟子站在旁边。
Clip A | 时长：6秒 | 景别：CU
CAMERA: 固定机位 / CU. 村长撑起上半身，嘴角带血。
EN: 村长: "Run!"
Clip B | 时长：6秒 | 景别：MS
CAMERA: 固定机位 / MS. 男弟子跑过来扶住村长。

【分镜02】
[shot02 | 时长：6秒 | 场景：Village 外 雪天 | 人物：村长 | 道具：无]
人物空间位置：
村长被扶起。
Clip A | 时长：6秒 | 景别：CU
CAMERA: 固定机位 / CU. 村长抬头看向前方。
`;

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL;
    const saved = { ...INITIAL, ...JSON.parse(raw) };
    // 旧存档只有一个 output 字符串，迁移成一批，避免进度丢失
    if (!Array.isArray(saved.batches)) {
      saved.batches = saved.output
        ? [{ from: 1, to: 0, text: saved.output, legacy: true }]
        : [];
    }
    if (!saved.batches.length) saved.stage = "input";
    else if (saved.stage === "running") saved.stage = "paused";
    if (saved.engineMode === "classic") saved.engineMode = "stable";
    if (!saved.batches.length && saved.engineMode === "stable") {
      saved.engineMode = "stable-v5";
    }
    saved.cursor = saved.batches.length;
    saved.pausedAt = saved.stage === "paused" ? saved.batches.length : saved.pausedAt || 0;
    return saved;
  } catch (err) {
    /* ignore */
  }
  return INITIAL;
}

function download(filename, content, type = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function episodeLabel(ep) {
  return `第${ep.no}集${ep.title ? `：${ep.title}` : ""}`;
}

function episodeFileBase(ep) {
  const title = String(ep.title || "未命名")
    .replace(/[\\/:*?"<>|]/g, "-")
    .trim();
  return `${String(ep.no).padStart(3, "0")}集-${title || "未命名"}`;
}

function formatDuration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return hours
    ? `${hours}小时${minutes % 60}分${String(secs).padStart(2, "0")}秒`
    : `${minutes}分${String(secs).padStart(2, "0")}秒`;
}

function batchUp(eps, size) {
  const out = [];
  for (let i = 0; i < eps.length; i += size) {
    out.push(eps.slice(i, i + size));
  }
  return out;
}

/** 把一段已有的分镜文本按「第N集」切开，用于导入历史结果 */
function splitOutputByEpisode(text) {
  const parts = String(text || "")
    .split(/\n(?=第\s*\d+\s*集)/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (!parts.length) return [];
  return parts.map((p) => {
    const m = p.match(/第\s*(\d+)\s*集/);
    const no = m ? Number(m[1]) : 0;
    return { from: no, to: no, text: p };
  });
}

function ShotRow({ shot }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`shot-row ${open ? "open" : ""}`}>
      <button type="button" className="shot-row-head" onClick={() => setOpen((v) => !v)}>
        <span className="shot-no">分镜{String(shot.no).padStart(2, "0")}</span>
        <span className="shot-meta">{shot.duration ? `${shot.duration} 秒` : "—"}</span>
        <span className="shot-scene">{shot.scene || "（未标场景）"}</span>
        <span className="shot-count">{shot.clips.length} Clip</span>
        <span className="shot-caret">{open ? "收起" : "展开"}</span>
      </button>
      {open ? (
        <div className="shot-row-body">
          {shot.position ? <p className="shot-pos">人物空间位置：{shot.position}</p> : null}
          {shot.clips.map((c) => (
            <div className="clip-line" key={c.letter}>
              <span className="clip-tag">Clip {c.letter}</span>
              <span className="clip-meta">
                {c.duration ? `${c.duration} 秒` : ""} {c.size}
              </span>
              <span className="clip-cam">{c.camera}</span>
              {c.dialogue.map((d, i) => (
                <span className="clip-dlg" key={i}>
                  {d.speaker}
                  {d.mode ? `（${d.mode}）` : ""}: “{d.text}”
                </span>
              ))}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function StoryboardFlow() {
  const [state, setState] = useState(load);
  const [live, setLive] = useState("");
  const [reason, setReason] = useState(0);
  const [batchInfo, setBatchInfo] = useState({ index: 0, total: 0, round: 0 });
  const ctrlRef = useRef(null);
  const importRef = useRef(null);

  const patch = (next) =>
    setState((s) => {
      const merged = { ...s, ...next };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      } catch (err) {
        /* ignore */
      }
      return merged;
    });

  const prompt = state.customPrompt.trim() ? state.customPrompt : defaultPromptBody;
  const experimentalBriefInstructions =
    state.customDirectorPrompt.trim() || experimentalBriefPrompt;
  const experimentalSceneInstructions = renderScenePlanPrompt(
    state.customScenePlanPrompt.trim() || experimentalScenePrompt,
    getScenePlanPolicy("flexible6"),
  );
  const stableV5Instructions = renderScenePlanPrompt(
    state.customStableV5Prompt.trim() || stableV5Prompt,
    getScenePlanPolicy("strict3"),
  );
  const episodes = useMemo(() => splitEpisodes(state.text), [state.text]);
  const batches = useMemo(
    () => batchUp(episodes, Math.max(1, Number(state.batchSize) || 3)),
    [episodes, state.batchSize],
  );

  const output = useMemo(
    () =>
      state.batches
        .map((b) => b.text)
        .filter(Boolean)
        .join("\n\n"),
    [state.batches],
  );
  /** 导入的历史结果不一定和当前批数对得上，取大值避免出现「3/1 批」 */
  const totalBatches = Math.max(batches.length, state.batches.length);
  const parsed = useMemo(() => parseStoryboard(output), [output]);
  const check = useMemo(
    () =>
      validateStoryboard(
        parsed,
        state.engineMode === "experimental"
          ? getScenePlanPolicy("flexible6")
          : state.engineMode === "stable-v5"
            ? getScenePlanPolicy("strict3")
            : undefined,
      ),
    [parsed, state.engineMode],
  );
  const totalDuration = useMemo(
    () =>
      parsed.episodes.reduce(
        (sum, ep) =>
          sum + ep.shots.reduce((shotSum, shot) => shotSum + (Number(shot.duration) || 0), 0),
        0,
      ),
    [parsed],
  );
  const ledger = useMemo(() => buildLedger(parsed), [parsed]);
  const modelQcIssues = useMemo(() => collectBatchIssues(state.batches), [state.batches]);
  const engineIssues = useMemo(
    () => [
      ...runEngineQc(state.text, output),
      ...auditStateChain(output),
      ...auditBlocking(output),
      ...state.batches.flatMap((batch) =>
        batch.beatClaims ? auditBeatClaims(batch.text, state.text) : [],
      ),
    ],
    [state.text, state.batches, output],
  );
  const experimentalIssues = useMemo(
    () => state.batches.flatMap((batch) => batch.experimentalIssues || []),
    [state.batches],
  );
  const experimentalHigh = experimentalIssues.filter(
    (issue) => issue.level === "高",
  ).length;
  const engineMid = experimentalIssues.filter(
    (issue) => issue.level === "中",
  ).length;
  const engineMidUnconfirmed =
    ["experimental", "stable-v5"].includes(state.engineMode) &&
    engineMid > 0 &&
    !state.acceptEngineMid;
  const qcIssues = useMemo(
    () => sortIssues([...engineIssues, ...modelQcIssues]),
    [engineIssues, modelQcIssues],
  );
  const qcCounts = useMemo(() => countByLevel(qcIssues), [qcIssues]);
  const [qcBusy, setQcBusy] = useState(false);
  const [qcRunning, setQcRunning] = useState(false);
  const [normalizeTip, setNormalizeTip] = useState("");
  const [showRaw, setShowRaw] = useState(false);
  const [copyTip, setCopyTip] = useState("");

  const runExperimentalFrom = async (start) => {
    if (!state.text.trim()) return patch({ error: "请先粘贴或上传剧本。" });
    if (!batches.length) return patch({ error: "没有识别到可处理的集。" });

    ctrlRef.current = new AbortController();
    const every = Number(state.checkpoint) || 0;
    let acc = state.batches.slice(0, start);
    let draftStarted = Boolean(
      state.experimentDraft?.batchIndex === start &&
        (state.experimentDraft.completedEpisodes ||
          state.experimentDraft.completedScenes),
    );
    patch({ stage: "running", error: "", batches: acc, cursor: start });
    setLive("");
    setReason(0);

    try {
      for (let bi = start; bi < batches.length; bi += 1) {
        const batch = batches[bi];
        const from = batch[0].no;
        const to = batch[batch.length - 1].no;
        const savedDraft =
          state.experimentDraft?.batchIndex === bi
            ? state.experimentDraft
            : {
                batchIndex: bi,
                completedEpisodes: {},
                completedScenes: {},
              };
        const draft = {
          ...savedDraft,
          completedEpisodes: { ...(savedDraft.completedEpisodes || {}) },
          completedScenes: { ...(savedDraft.completedScenes || {}) },
        };
        draftStarted = true;
        patch({ experimentDraft: draft });
        setBatchInfo({ index: bi + 1, total: batches.length, round: 0 });
        setLive("");
        const body = batch.map((episode) => episode.text).join("\n\n");
        const result = await runExperimentalScript({
          text: body,
          briefInstructions: experimentalBriefInstructions,
          sceneInstructions: experimentalSceneInstructions,
          policyName: "flexible6",
          chunkSeconds: Number(state.engineChunkSeconds) || 20,
          effort: state.engineEffort || "low",
          signal: ctrlRef.current.signal,
          labelPrefix: `实验引擎 第${from}-${to}集`,
          completedEpisodes: draft.completedEpisodes,
          completedScenes: draft.completedScenes,
          onProgress: ({ episode, scene, finished, total, stage }) => {
            setBatchInfo({
              index: bi + 1,
              total: batches.length,
              round: finished,
              stage,
              episode,
              scene,
              sceneTotal: total,
            });
          },
          onSceneComplete: ({ episode, scene, result: sceneResult }) => {
            draft.completedScenes[`${episode}:${scene}`] = {
              sceneText: sceneResult.sceneText,
              stats: {
                scene: sceneResult.stats.scene,
                repairCount: sceneResult.stats.repairCount,
                validation: sceneResult.stats.validation,
              },
            };
            patch({ experimentDraft: draft });
          },
          onEpisodeComplete: (episodeResult) => {
            draft.completedEpisodes[episodeResult.episode] = {
              text: episodeResult.text,
              issues: episodeResult.issues,
            };
            patch({ experimentDraft: draft });
          },
          callModel: (args) =>
            runStream({
              ...args,
              signal: ctrlRef.current.signal,
              onText: (delta) => setLive((value) => value + delta),
              onReason: setReason,
            }),
        });
        acc = [
          ...acc,
          {
            from,
            to,
            text: result.text,
            at: Date.now(),
            engine: "experimental",
            experimentalIssues: result.issues,
            engineStats: result.stats,
          },
        ];
        patch({
          batches: acc,
          cursor: bi + 1,
          experimentDraft: null,
          acceptEngineMid: false,
        });
        setLive("");

        if (result.issues.some((issue) => issue.level === "高")) {
          patch({
            stage: "paused",
            pausedAt: acc.length,
            pauseReason: "engine",
          });
          return;
        }
        if (shouldPause({ done: acc.length, total: batches.length, every })) {
          patch({
            stage: "paused",
            pausedAt: acc.length,
            pauseReason: "checkpoint",
          });
          return;
        }
      }
      patch({ stage: "done", pausedAt: 0, experimentDraft: null });
    } catch (err) {
      patch({
        stage: acc.length || draftStarted ? "paused" : "input",
        pausedAt: acc.length,
        error: String(err?.message || err),
      });
    } finally {
      ctrlRef.current = null;
    }
  };

  const runStableV5From = async (start) => {
    if (!state.text.trim()) return patch({ error: "请先粘贴或上传剧本。" });
    if (!batches.length) return patch({ error: "没有识别到可处理的集。" });

    ctrlRef.current = new AbortController();
    const every = Number(state.checkpoint) || 0;
    let acc = state.batches.slice(0, start);
    let draftStarted = Boolean(
      state.stableV5Draft?.batchIndex === start &&
        state.stableV5Draft.completedEpisodes,
    );
    patch({ stage: "running", error: "", batches: acc, cursor: start });
    setLive("");
    setReason(0);

    try {
      for (let bi = start; bi < batches.length; bi += 1) {
        const batch = batches[bi];
        const from = batch[0].no;
        const to = batch[batch.length - 1].no;
        const savedDraft =
          state.stableV5Draft?.batchIndex === bi
            ? state.stableV5Draft
            : {
                batchIndex: bi,
                completedEpisodes: {},
                completedScenes: {},
              };
        const draft = {
          ...savedDraft,
          completedEpisodes: { ...(savedDraft.completedEpisodes || {}) },
          completedScenes: { ...(savedDraft.completedScenes || {}) },
        };
        draftStarted = true;
        patch({ stableV5Draft: draft });
        setBatchInfo({ index: bi + 1, total: batches.length, round: 0 });
        setLive("");
        const body = batch.map((episode) => episode.text).join("\n\n");
        const result = await runStableV5Script({
          text: body,
          planInstructions: stableV5Instructions,
          policyName: "strict3",
          chunkSeconds: 180,
          effort: state.engineEffort || "low",
          signal: ctrlRef.current.signal,
          labelPrefix: `稳定v5 第${from}-${to}集`,
          completedScenes: draft.completedScenes,
          onProgress: ({ episode, scene, finished, total, stage }) => {
            setBatchInfo({
              index: bi + 1,
              total: batches.length,
              round: finished,
              stage,
              episode,
              scene,
              sceneTotal: total,
            });
          },
          onSceneComplete: ({ episode, scene, result: sceneResult }) => {
            draft.completedScenes[`${episode}:${scene}`] = sceneResult;
            patch({ stableV5Draft: draft });
          },
          onEpisodeComplete: (episodeResult) => {
            draft.completedEpisodes[episodeResult.episode] = {
              text: episodeResult.text,
              issues: episodeResult.issues,
            };
            patch({ stableV5Draft: draft });
          },
          callModel: (args) =>
            runStream({
              ...args,
              signal: ctrlRef.current.signal,
              onText: (delta) => setLive((value) => value + delta),
              onReason: setReason,
            }),
        });
        const postIssues = [
          ...runEngineQc(body, result.text),
          ...auditStateChain(result.text),
          ...auditBlocking(result.text),
        ];
        const issues = [...result.issues, ...postIssues];
        acc = [
          ...acc,
          {
            from,
            to,
            text: result.text,
            at: Date.now(),
            engine: "stable-v5",
            beatClaims: false,
            experimentalIssues: issues,
            engineStats: result.stats,
          },
        ];
        patch({
          batches: acc,
          cursor: bi + 1,
          stableV5Draft: null,
          acceptEngineMid: false,
        });
        setLive("");

        if (issues.some((issue) => issue.level === "高")) {
          patch({
            stage: "paused",
            pausedAt: acc.length,
            pauseReason: "engine",
          });
          return;
        }
        if (shouldPause({ done: acc.length, total: batches.length, every })) {
          patch({
            stage: "paused",
            pausedAt: acc.length,
            pauseReason: "checkpoint",
          });
          return;
        }
      }
      patch({ stage: "done", pausedAt: 0, stableV5Draft: null });
    } catch (err) {
      patch({
        stage: acc.length || draftStarted ? "paused" : "input",
        pausedAt: acc.length,
        error: String(err?.message || err),
      });
    } finally {
      ctrlRef.current = null;
    }
  };

  /** 从第 start 批开始跑；每到检查点就停下等确认 */
  const runFrom = async (start) => {
    if (state.engineMode === "experimental") {
      return runExperimentalFrom(start);
    }
    if (state.engineMode === "stable-v5") {
      return runStableV5From(start);
    }
    if (!state.text.trim()) return patch({ error: "请先粘贴或上传剧本。" });
    if (!batches.length) return patch({ error: "没有识别到可处理的集。" });

    ctrlRef.current = new AbortController();
    const every = Number(state.checkpoint) || 0;
    let acc = state.batches.slice(0, start);
    patch({ stage: "running", error: "", batches: acc, cursor: start });
    setLive("");
    setReason(0);
    setBatchInfo({ index: start + 1, total: batches.length, round: 0 });

    try {
      for (let bi = start; bi < batches.length; bi += 1) {
        const batch = batches[bi];
        const from = batch[0].no;
        const to = batch[batch.length - 1].no;
        setBatchInfo({ index: bi + 1, total: batches.length, round: 0 });
        setLive("");

        // 接力包：只用已产出的批次建表，绝不预支后面的
        const seedLedger = ledgerSeed(
          buildLedger(parseStoryboard(acc.map((b) => b.text).filter(Boolean).join("\n\n"))),
        );
        const body = batch.map((e) => e.text).join("\n\n");
        const beatProtocolEnabled = prompt.includes("[拍NN]");
        const numbered = beatProtocolEnabled
          ? numberStoryboardBeats(body)
          : { text: body };
        const ledgerPart = seedLedger ? `${seedLedger}\n\n` : "";
        const formatPart = state.strictFormat
          ? `${beatProtocolEnabled ? BEAT_FORMAT_REMINDER : ""}${FORMAT_REMINDER}`
          : "";

        const { text } = await runChunked({
          seed: `${ledgerPart}${formatPart}【本批】第${from}–${to}集\n\n${numbered.text}\n\n请按协议把以上内容转成分镜头剧本。`,
          next: "请继续输出剩余部分。",
          maxRounds: 6,
          onRound: (n) => setBatchInfo({ index: bi + 1, total: batches.length, round: n }),
          onProgress: (full) => {
            patch({
              batches: [...acc, { from, to, text: full, streaming: true }],
            });
          },
          callModel: ({ input, round: r }) =>
            runStream({
              instructions: prompt,
              input,
              effort: "low",
              label: `分镜 第${from}-${to}集 第${r}轮`,
              signal: ctrlRef.current.signal,
              onText: (d) => setLive((v) => v + d),
              onReason: setReason,
            }),
        });

        acc = [
          ...acc,
          {
            from,
            to,
            text: text.trim(),
            at: Date.now(),
            beatClaims: beatProtocolEnabled,
          },
        ];
        patch({ batches: acc, cursor: bi + 1 });
        setLive("");

        // 内容质检：只报告，不改稿；失败不影响主流程
        let issues = [];
        let droppedCount = 0;
        let qcError = "";
        if (state.qcEnabled) {
          setQcBusy(true);
          try {
            const review = await runStream({
              instructions: qcPrompt,
              input: `【本集原始剧本】\n${body}\n\n【生成的分镜头剧本】\n${text}`,
              effort: "low",
              label: `质检 第${from}-${to}集`,
              signal: ctrlRef.current.signal,
            });
            const rawIssues = parseQc(review && review.text ? review.text : review);
            const verified = verifyModelIssues(rawIssues, {
              parsed: parseStoryboard(text),
              outputText: text,
            });
            issues = verified.kept;
            droppedCount = verified.dropped.length;
          } catch (err) {
            issues = [];
            qcError = String(err?.message || err);
          } finally {
            setQcBusy(false);
          }
          acc = acc.map((b, i) =>
            i === acc.length - 1
              ? { ...b, qc: issues, qcDropped: droppedCount, qcError }
              : b,
          );
          patch({ batches: acc });
        }

        // 引擎能判的高危（台词篡改）同样立刻停，不等检查点
        const engIssues = [
          ...runEngineQc(body, text),
          ...auditStateChain(text),
          ...auditBlocking(text),
          ...(beatProtocolEnabled ? auditBeatClaims(text, body) : []),
        ];
        if (hasHigh([...engIssues, ...issues])) {
          patch({ stage: "paused", pausedAt: acc.length, pauseReason: "qc" });
          return;
        }
        if (shouldPause({ done: acc.length, total: batches.length, every })) {
          patch({ stage: "paused", pausedAt: acc.length, pauseReason: "checkpoint" });
          return;
        }
      }
      patch({ stage: "done", pausedAt: 0 });
    } catch (err) {
      patch({
        stage: acc.length ? "paused" : "input",
        pausedAt: acc.length,
        error: String(err?.message || err),
      });
    } finally {
      ctrlRef.current = null;
    }
  };

  const run = () => runFrom(0);
  const resume = () => runFrom(state.cursor);

  /** 对已有结果补跑质检（导入的历史分镜也能用） */
  const runQcOnAll = async () => {
    if (!state.batches.length || qcRunning) return;
    setQcRunning(true);
    try {
      let next = state.batches;
      for (let i = 0; i < next.length; i += 1) {
        const b = next[i];
        const src =
          episodes
            .filter((e) => e.no >= b.from && e.no <= b.to)
            .map((e) => e.text)
            .join("\n\n") || state.text;
        const review = await runStream({
          instructions: qcPrompt,
          input: `【本集原始剧本】\n${src}\n\n【生成的分镜头剧本】\n${b.text}`,
          effort: "low",
          label: `质检 ${b.from}-${b.to}集`,
        });
        const rawIssues = parseQc(review && review.text ? review.text : review);
        const verified = verifyModelIssues(rawIssues, {
          parsed: parseStoryboard(b.text),
          outputText: b.text,
        });
        next = next.map((x, j) =>
          j === i
            ? { ...x, qc: verified.kept, qcDropped: verified.dropped.length }
            : x,
        );
        patch({ batches: next });
      }
    } catch (err) {
      patch({ error: String(err?.message || err) });
    } finally {
      setQcRunning(false);
    }
  };

  /** 按协议规范化：重排 shot 编号 + 拆开合并的台词（纯代码，不动内容） */
  const normalizeAll = () => {
    if (!state.batches.length) return;
    let renumbered = 0;
    let split = 0;
    let deduped = 0;
    let relabeled = 0;
    let bumped = 0;
    let durationFixed = 0;
    let aliased = 0;
    let headsMerged = 0;
    let dialogueRestored = 0;
    let dialogueDeduped = 0;
    const next = state.batches.map((b) => {
      const r = normalizeStoryboard(b.text, state.text);
      renumbered += r.renumbered;
      split += r.split;
      deduped += r.deduped;
      relabeled += r.relabeled;
      bumped += r.bumped;
      durationFixed += r.durationFixed;
      aliased += r.aliased;
      headsMerged += r.headsMerged;
      dialogueRestored += r.dialogueRestored;
      dialogueDeduped += r.dialogueDeduped;
      // 编号变了以后，旧的模型质检位置全部失效，一并清掉，避免指错行
      return { ...b, text: r.text, qc: [], qcDropped: 0 };
    });
    patch({ batches: next });
    patch({ error: "" });
    window.setTimeout(() => {
      // 让结果先渲染，再提示
      // eslint-disable-next-line no-alert
      window.__lastNormalize = {
        renumbered,
        split,
        deduped,
        relabeled,
        bumped,
        durationFixed,
        aliased,
        headsMerged,
        dialogueRestored,
        dialogueDeduped,
      };
    }, 0);
    return {
      renumbered,
      split,
      deduped,
      relabeled,
      bumped,
      durationFixed,
      aliased,
      headsMerged,
      dialogueRestored,
      dialogueDeduped,
    };
  };

  /** 重跑这一段：回到本段起点，级联跑到下一个检查点 */
  const rerunSegment = () =>
    runFrom(
      segmentStart({ done: state.pausedAt || state.batches.length, every: Number(state.checkpoint) || 0 }),
    );

  /** 只重跑最后一批：后续批次的前缀会过期，界面上要说明 */
  const rerunLastBatch = () => runFrom(Math.max(0, state.batches.length - 1));

  const stop = () => {
    ctrlRef.current?.abort();
    ctrlRef.current = null;
    patch({
      stage: state.batches.length ? "paused" : "input",
      pausedAt: state.batches.length,
      pauseReason: "",
    });
  };

  const reset = () => {
    stop();
    patch({
      ...INITIAL,
      checkpoint: state.checkpoint,
      text: state.text,
      fileName: state.fileName,
      mode: state.mode,
      engineMode: state.engineMode,
      engineEffort: state.engineEffort,
      engineChunkSeconds: state.engineChunkSeconds,
      customPrompt: state.customPrompt,
      customDirectorPrompt: state.customDirectorPrompt,
      customScenePlanPrompt: state.customScenePlanPrompt,
      customStableV5Prompt: state.customStableV5Prompt,
      stableV5Draft: null,
    });
    setLive("");
  };

  const onFile = async (file) => {
    if (!file) return;
    const content = await file.text();
    patch({
      text: content,
      fileName: file.name.replace(/\.[^.]+$/, ""),
      experimentDraft: null,
      stableV5Draft: null,
    });
  };

  /** 导入已经生成好的分镜，直接进入校验与交付 */
  const onImportStoryboard = async (file) => {
    if (!file) return;
    const content = await file.text();
    const parts = splitOutputByEpisode(content);
    const nextBatches = parts.length ? parts : [{ from: 0, to: 0, text: content }];
    patch({
      batches: nextBatches,
      cursor: nextBatches.length,
      pausedAt: 0,
      stage: "done",
      engineMode: "stable",
      experimentDraft: null,
      error: "",
    });
  };

  const deliveryPackage = () =>
    buildDeliveryPackage({
      parsed,
      projectName: state.fileName || "短剧项目",
      fullMarkdown: output,
      generatedAt: new Date(),
    });

  const downloadDelivery = () => {
    const pkg = deliveryPackage();
    download(pkg.fileName, pkg.zip, "application/zip");
  };

  const downloadEpisode = (ep) => {
    const text =
      splitEpisodes(output).find((item) => item.no === ep.no)?.text ||
      `${episodeLabel(ep)}\n`;
    download(`${episodeFileBase(ep)}.md`, text, "text/markdown;charset=utf-8");
  };

  const copyEpisode = async (ep) => {
    const text =
      splitEpisodes(output).find((item) => item.no === ep.no)?.text ||
      `${episodeLabel(ep)}\n`;
    try {
      await navigator.clipboard.writeText(text);
      setCopyTip(`已复制 ${episodeLabel(ep)}`);
    } catch (err) {
      setCopyTip(`复制失败：${String(err?.message || err)}`);
    }
  };

  const shown =
    state.stage === "running"
      ? state.engineMode === "experimental"
        ? output
        : output + live
      : output;
  const deliveryBlocked =
    check.issues.length > 0 ||
    qcCounts.高 > 0 ||
    experimentalHigh > 0 ||
    engineMidUnconfirmed;

  return (
    <>
      <div className="flow-head">
        <div className="steps">
          {STEPS.map((s) => (
            <div
              key={s.n}
              className={`step ${stepState(state.stage, s.n, Boolean(state.text.trim()))}`}
            >
              <span className="num">{s.n}</span> {s.label}
            </div>
          ))}
        </div>
        <div className="flow-actions">
          {state.stage === "running" ? (
            <button className="btn ghost sm" type="button" onClick={stop}>
              <Stop size={14} /> 停止
            </button>
          ) : null}
          {output ? (
            <button className="btn ghost sm" type="button" onClick={reset}>
              <ArrowsClockwise size={14} /> 重新开始
            </button>
          ) : null}
        </div>
      </div>

      {state.error ? (
        <div className="error-bar">
          <WarningCircle size={16} weight="fill" />
          <div>{state.error}</div>
        </div>
      ) : null}

      <div className="flow-hint">
        {state.stage === "input"
          ? "载入分集剧本 → 需要的话替换提示词 → 点「开始生成」。"
          : state.stage === "running"
            ? qcBusy
              ? `第 ${batchInfo.index}/${batchInfo.total} 批已产出，正在质检…`
              : `正在生成第 ${batchInfo.index}/${batchInfo.total} 批…`
            : "先看校验，再看分镜；不满意就回步骤 02 改提示词重跑。"}
      </div>

      <section className={`card ${state.stage === "input" ? "hi" : ""}`}>
        <div className="card-head">
          <div>
            <div className="card-kicker">步骤 01 · 输入</div>
            <div className="card-title">分集剧本</div>
          </div>
          <div className="spacer" />
          <div className="tabs">
            <button
              type="button"
              className={`tab ${state.mode === "upload" ? "active" : ""}`}
              onClick={() => patch({ mode: "upload" })}
            >
              上传文件
            </button>
            <button
              type="button"
              className={`tab ${state.mode === "paste" ? "active" : ""}`}
              onClick={() => patch({ mode: "paste" })}
            >
              粘贴文字
            </button>
          </div>
        </div>

        <p className="hint">
          输入应已经是<b>分好集</b>的干净剧本（流程二「集数拆分与重组」的产出）。
          {state.engineMode === "experimental"
            ? " 实验引擎会按场生成导演提示单，再用动作微单元排镜头；调用次数会更多。"
            : state.engineMode === "stable-v5"
              ? " 稳定 v5 按场生成动作微单元计划，再由本地编译器和连续性闸门生成分镜。"
              : " 每集 4–15 秒 × N 个 Clip，一次生成一批。"}
        </p>
        {state.engineMode === "experimental" ? (
          <p className="hint engine-warn">
            <b>实验通道，不建议作为默认交付路径。</b>
            <br />
            实测（三场 A/B）：token 约为稳定链路的 <b>6.0 倍</b>，修复调用占 43%–54%；台词覆盖与稳定链路持平（均为
            100%）。
            <br />
            它买到的是更细的镜头结构，不是更少的缺陷——稳定链路在当前 QC 下三场问题数为 0 / 1 / 0。
          </p>
        ) : null}

        {state.mode === "paste" ? (
          <textarea
            className="script"
            placeholder="在此粘贴分集剧本……带「第X集：集名」就能自动按集分批。"
            value={state.text}
            onChange={(e) =>
              patch({
                text: e.target.value,
                experimentDraft: null,
                stableV5Draft: null,
              })
            }
          />
        ) : (
          <div className="drop">
            <UploadSimple size={26} />
            <div>把剧本文件拖进来，或</div>
            <label className="btn sm">
              选择文件
              <input
                type="file"
                accept=".txt,.md"
                hidden
                onChange={(e) => onFile(e.target.files?.[0])}
              />
            </label>
            {state.fileName ? <div className="hint">已载入：{state.fileName}</div> : null}
          </div>
        )}

        <div className="row">
          <span className="hint">
            {state.text ? `识别到 ${episodes.length} 集 → ${batches.length} 批` : "还没有输入"}
          </span>
          <div className="spacer" />
          <button
            className="btn ghost sm"
            type="button"
            onClick={() =>
              patch({
                batches: [{ from: 1, to: 0, text: SAMPLE_STORYBOARD }],
                cursor: 1,
                pausedAt: 0,
                stage: "done",
                engineMode: "stable",
                experimentDraft: null,
              })
            }
          >
            载入示例分镜
          </button>
          <input
            ref={importRef}
            type="file"
            accept=".md,.txt"
            style={{ display: "none" }}
            onChange={(e) => {
              onImportStoryboard(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <button
            className="btn ghost sm"
            type="button"
            onClick={() => importRef.current?.click()}
          >
            导入已有分镜
          </button>
          <label className="hint">
            每批{" "}
            <input
              className="sec-input"
              type="number"
              min="1"
              max="10"
              value={state.batchSize}
              onChange={(e) => patch({ batchSize: Number(e.target.value) })}
            />{" "}
            集
          </label>
          <label className="hint">
            每{" "}
            <select
              className="sec-input"
              value={state.checkpoint}
              onChange={(e) => patch({ checkpoint: Number(e.target.value) })}
            >
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
              <option value={0}>不限</option>
            </select>{" "}
            批停一次
          </label>
          <label className="hint">
            引擎{" "}
            <select
              className="sec-input"
              value={state.engineMode}
              disabled={state.stage === "running" || state.batches.length > 0}
              onChange={(e) =>
                patch({
                  engineMode: e.target.value,
                  experimentDraft: null,
                  stableV5Draft: null,
                })
              }
            >
              <option value="stable-v5">稳定链路 v5（动作微单元 · 推荐）</option>
              <option value="stable">稳定链路 v4（轻量兼容）</option>
              <option value="experimental">实验引擎（约 6 倍成本）</option>
            </select>
          </label>
          {state.engineMode === "experimental" ? (
            <>
              <label className="hint">
                推理{" "}
                <select
                  className="sec-input"
                  value={state.engineEffort}
                  onChange={(e) => patch({ engineEffort: e.target.value })}
                >
                  <option value="low">low</option>
                  <option value="minimal">minimal</option>
                </select>
              </label>
              <label className="hint">
                分块{" "}
                <input
                  className="sec-input"
                  type="number"
                  min="15"
                  max="30"
                  step="5"
                  value={state.engineChunkSeconds}
                  onChange={(e) =>
                    patch({ engineChunkSeconds: Number(e.target.value) })
                  }
                />{" "}
                秒
              </label>
            </>
          ) : null}
          {state.engineMode === "stable-v5" ? (
            <label className="hint">
              推理{" "}
              <select
                className="sec-input"
                value={state.engineEffort}
                onChange={(e) => patch({ engineEffort: e.target.value })}
              >
                <option value="low">low</option>
                <option value="minimal">minimal</option>
              </select>
            </label>
          ) : null}
          {state.engineMode === "stable" ? (
            <label className="hint qc-toggle">
              <input
                type="checkbox"
                checked={state.strictFormat}
                onChange={(e) => patch({ strictFormat: e.target.checked })}
              />{" "}
              格式硬约束
            </label>
          ) : null}
          <label className="hint qc-toggle">
            <input
              type="checkbox"
              checked={state.qcEnabled}
              onChange={(e) => patch({ qcEnabled: e.target.checked })}
            />{" "}
            生成后质检
          </label>
          <button
            className="btn primary"
            type="button"
            disabled={!state.text.trim() || state.stage === "running"}
            onClick={run}
          >
            <Play size={15} />{" "}
            {state.engineMode === "experimental" ? "开始实验生成" : "开始生成"}
          </button>
        </div>
      </section>

      {state.text.trim() ? (
          <section className="card">
            <div className="card-kicker">步骤 02 · 提示词</div>
            {state.engineMode === "experimental" ? (
              <>
                <p className="hint">
                  实验引擎分两次调用：先写导演提示单，再生成 Schema v3 镜头计划。
                  留空即使用内置提示词。
                </p>
                <PromptSlot
                  label={`导演提示单 · ${experimentalBriefPrompt.length} 字`}
                  defaultText={experimentalBriefPrompt}
                  value={state.customDirectorPrompt}
                  onChange={(v) => patch({ customDirectorPrompt: v })}
                  readOnly={state.stage === "running"}
                />
                <PromptSlot
                  label={`镜头计划 v3 · ${experimentalScenePrompt.length} 字`}
                  defaultText={experimentalScenePrompt}
                  value={state.customScenePlanPrompt}
                  onChange={(v) => patch({ customScenePlanPrompt: v })}
                  readOnly={state.stage === "running"}
                />
              </>
            ) : state.engineMode === "stable-v5" ? (
              <>
                <p className="hint">
                  模型只输出动作微单元镜头计划；台词和最终 Markdown 由本地编译器生成。
                  结构、时长、动作密度、连续性和持物账本通过后才进入下一步。
                </p>
                <PromptSlot
                  label={`稳定 v5 镜头计划 · ${stableV5Prompt.length} 字`}
                  defaultText={stableV5Prompt}
                  value={state.customStableV5Prompt}
                  onChange={(v) => patch({ customStableV5Prompt: v })}
                  readOnly={state.stage === "running"}
                />
              </>
            ) : (
              <PromptSlot
                label={`默认提示词 · ${defaultPromptBody.length} 字`}
                defaultText={defaultPromptBody}
                value={state.customPrompt}
                onChange={(v) => patch({ customPrompt: v })}
              />
            )}
          </section>
      ) : null}

      {state.stage === "running" || output ? (
            <section className="card hi">
              <div className="card-head">
                <div>
                  <div className="card-kicker">步骤 03 · 生成</div>
                  <div className="card-title">
                    {state.stage === "running"
                      ? state.engineMode === "experimental"
                        ? `第 ${batchInfo.index}/${batchInfo.total} 批 · ${
                            batchInfo.stage === "brief"
                              ? `导演提示单 第${batchInfo.episode}集 ${batchInfo.scene}`
                              : `镜头计划 ${batchInfo.finished || 0}/${batchInfo.sceneTotal || 0}`
                          }`
                        : state.engineMode === "stable-v5"
                          ? `第 ${batchInfo.index}/${batchInfo.total} 批 · ${
                              batchInfo.scene
                                ? `${batchInfo.stage === "repair" ? "定点修复" : "镜头计划"} 第${batchInfo.episode}集 ${batchInfo.scene}`
                                : "准备镜头计划"
                            }`
                          : `第 ${batchInfo.index}/${batchInfo.total} 批 · 第 ${batchInfo.round} 轮`
                      : `已完成 ${state.batches.length}/${totalBatches} 批`}
                  </div>
                  {state.stage !== "running" && output ? (
                    <span className="hint">
                      {state.engineMode === "experimental"
                        ? "实验引擎 · "
                        : state.engineMode === "stable-v5"
                          ? "稳定 v5 · "
                          : ""}
                      {parsed.episodes.length} 集 · {check.stats.shots} 分镜 ·{" "}
                      {check.stats.clips} Clip
                    </span>
                  ) : null}
                </div>
                <div className="spacer" />
                {state.stage === "running" ? (
                  <span className="hint">思考 {reason} 字 · 本轮输出 {live.length} 字</span>
                ) : null}
                <button
                  className="btn sm"
                  type="button"
                  disabled={!output}
                  onClick={() =>
                    download(`${state.fileName || "剧本"}-分镜.md`, output)
                  }
                >
                  <DownloadSimple size={14} /> 下载分镜
                </button>
              </div>
              <div className="progress">
                <div
                  className="bar"
                  style={{
                    width: `${totalBatches ? (state.batches.length / totalBatches) * 100 : 0}%`,
                  }}
                />
              </div>
              {state.stage === "running" ? (
                <div className="preview script-preview">
                  <pre>{shown || "（还没有输出）"}</pre>
                </div>
              ) : (
                <>
                  <div className="shot-list">
                    {parsed.episodes.map((ep) => (
                      <div className="shot-ep" key={ep.no}>
                        <div className="shot-ep-head">
                          <span>
                            {episodeLabel(ep)} · {ep.shots.length} 分镜
                          </span>
                          <div className="shot-ep-actions">
                            <button
                              className="btn ghost sm"
                              type="button"
                              onClick={() => copyEpisode(ep)}
                            >
                              <CopySimple size={12} /> 复制本集
                            </button>
                            <button
                              className="btn ghost sm"
                              type="button"
                              onClick={() => downloadEpisode(ep)}
                            >
                              <DownloadSimple size={12} /> 下载本集
                            </button>
                          </div>
                        </div>
                        {ep.shots.map((s) => (
                          <ShotRow key={s.no} shot={s} />
                        ))}
                      </div>
                    ))}
                  </div>
                  {copyTip ? <p className="hint">{copyTip}</p> : null}
                  <div className="preview-toggle">
                    <button
                      className="btn ghost sm"
                      type="button"
                      onClick={() => setShowRaw((v) => !v)}
                    >
                      {showRaw ? "收起原始文本" : "查看原始文本"}
                    </button>
                    <span className="hint">
                      交付物原文，逐字未改；上面是同一份内容的结构化视图。
                    </span>
                  </div>
                  {showRaw ? (
                    <div className="preview script-preview">
                      <pre>{shown}</pre>
                    </div>
                  ) : null}
                </>
              )}
            </section>
      ) : null}

      {state.stage === "paused" ? (
        <section className="card hi checkpoint">
          <div className="card-head">
            <div>
              <div className="card-kicker">检查点 · 停在这里等你看一眼</div>
              <div className="card-title">
                已生成 {state.batches.length}/{batches.length} 批
              </div>
            </div>
            <div className="spacer" />
            <span className="pill">
              {Number(state.checkpoint) > 0 ? `每 ${state.checkpoint} 批一停` : "不停"}
            </span>
          </div>

          <div className="cp-body">
            <div className="cp-col">
              <div className="cp-label">已产出的集</div>
              <div className="cp-value">
                {state.batches.length
                  ? `第 ${state.batches[0].from}–${state.batches[state.batches.length - 1].to} 集`
                  : "—"}
              </div>
            </div>
            <div className="cp-col">
              <div className="cp-label">角色编号（下一批沿用）</div>
              <div className="cp-value mono">
                {ledger.characters.length
                  ? ledger.characters.map((c) => c.code).join(" · ")
                  : "—"}
              </div>
            </div>
            <div className="cp-col">
              <div className="cp-label">场景</div>
              <div className="cp-value">
                {ledger.scenes.length ? ledger.scenes.join(" · ") : "—"}
              </div>
            </div>
            <div className="cp-col">
              <div className="cp-label">内容质检</div>
              <div className="cp-value">
                {!state.qcEnabled ? (
                  "本次未开启"
                ) : qcIssues.length ? (
                  <>
                    高 {qcCounts.高} · 中 {qcCounts.中} · 低 {qcCounts.低}
                    <ul className="cp-issues">
                      {topIssues(qcIssues, 3).map((it, i) => (
                        <li key={i} className={`lv-${it.level}`}>
                          {it.where} · {it.rule}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  "未发现违规项"
                )}
              </div>
            </div>
          </div>

          {state.pauseReason === "qc" ? (
            <p className="hint warn-line">
              出现高危问题，不等检查点提前停了 —— 这类错误会被下一批当前提继承。
            </p>
          ) : null}
          {state.pauseReason === "engine" ? (
            <p className="hint warn-line">
              实验引擎发现高优先级问题。继续会保留这批结果，但不会把问题伪报为通过。
            </p>
          ) : null}

          <div className="row cp-actions">
            <button className="btn primary" type="button" onClick={resume}>
              <Play size={15} /> 继续下一段
            </button>
            <button className="btn ghost sm" type="button" onClick={rerunSegment}>
              <ArrowsClockwise size={14} /> 重跑这一段
            </button>
            <button className="btn ghost sm" type="button" onClick={rerunLastBatch}>
              只重跑最后一批
            </button>
          </div>
          <p className="hint">
            「只重跑最后一批」之后，后面的批次仍按旧接力包接续，可能出现编号或称呼不一致。
          </p>
        </section>
      ) : null}

      {output ? (
        <>
          <section className="card">
            <div className="card-head">
              <div>
                <div className="card-kicker">步骤 04 · 校验与交付</div>
                <div className="card-title">
                  {check.stats.episodes} 集 · {check.stats.shots} shot · {check.stats.clips} Clip ·{" "}
                  {formatDuration(totalDuration)}
                </div>
              </div>
              <div className="spacer" />
              <span className={`pill ${check.stats.high ? "l3" : ""}`}>
                高 {check.stats.high}
              </span>
              <span className={`pill ${check.stats.mid ? "l2" : ""}`}>中 {check.stats.mid}</span>
              {qcCounts.高 || qcCounts.中 || qcCounts.低 ? (
                <span className="pill">
                  质检 高{qcCounts.高} 中{qcCounts.中}
                </span>
              ) : null}
              {["experimental", "stable-v5"].includes(state.engineMode) ? (
                <span className={`pill ${experimentalHigh ? "l3" : ""}`}>
                  {state.engineMode === "stable-v5" ? "v5 审计" : "实验审计"} 高
                  {experimentalHigh} / 共{experimentalIssues.length}
                </span>
              ) : null}
            </div>
            {!deliveryBlocked ? (
              <div className="row">
                <CheckCircle size={18} weight="fill" color="#4ade80" />
                <span className="hint">全部通过。</span>
              </div>
            ) : (
              <div className="table-wrap est-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>级别</th>
                      <th>位置</th>
                      <th>问题</th>
                    </tr>
                  </thead>
                  <tbody>
                    {check.issues.slice(0, 200).map((it, i) => (
                      <tr key={i}>
                        <td>{it.level}</td>
                        <td className="mono">{it.where}</td>
                        <td>{it.msg}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {check.issues.length > 200 ? (
              <p className="hint">只显示前 200 条，共 {check.issues.length} 条。</p>
            ) : null}
            {["experimental", "stable-v5"].includes(state.engineMode) &&
            experimentalIssues.length ? (
              <div className="table-wrap est-wrap" style={{ marginTop: 12 }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>级别</th>
                      <th>位置</th>
                      <th>
                        {state.engineMode === "stable-v5"
                          ? "稳定 v5 计划审计"
                          : "实验引擎问题"}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {experimentalIssues.slice(0, 200).map((it, i) => (
                      <tr key={`engine-${i}`}>
                        <td>{it.level}</td>
                        <td className="mono">{it.where}</td>
                        <td>{it.msg}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            {["experimental", "stable-v5"].includes(state.engineMode) &&
            engineMid > 0 ? (
              <label className="hint qc-toggle" style={{ marginTop: 10 }}>
                <input
                  type="checkbox"
                  checked={state.acceptEngineMid}
                  onChange={(e) =>
                    patch({ acceptEngineMid: e.target.checked })
                  }
                />{" "}
                我已逐条核对以上中危，并确认可以进入制作
              </label>
            ) : null}
            <div className="row" style={{ marginTop: 12 }}>
              {!deliveryBlocked ? (
                <>
                  <button
                    className="btn primary sm"
                    type="button"
                    onClick={downloadDelivery}
                  >
                    <DownloadSimple size={14} /> 下载交付包
                  </button>
                  <button
                    className="btn ghost sm"
                    type="button"
                    onClick={() =>
                      download(`${state.fileName || "剧本"}-完整分镜.md`, output, "text/markdown;charset=utf-8")
                    }
                  >
                    <DownloadSimple size={14} /> 完整分镜
                  </button>
                  <span className="hint">
                    交付包含完整分镜、分集分镜、说明和清单。
                  </span>
                </>
              ) : (
                <span className="hint">
                  先处理高优先级问题；改完回步骤 02 更新提示词，再重跑一次。
                </span>
              )}
            </div>

            <div className="qc-block">
              <div className="qc-head">
                <div className="qc-title">内容质检 · 只报告，不改稿</div>
                <div className="spacer" />
                <button
                  className="btn ghost sm"
                  type="button"
                  disabled={!state.batches.length}
                  onClick={() => {
                    const r = normalizeAll();
                    if (r) {
                      setNormalizeTip(
                        `已重排编号 ${r.renumbered} 处、拆开合并台词 ${r.split} 条、` +
                          `去重重复 Clip ${r.deduped} 条、补足短 Clip ${r.bumped} 条、` +
                          `校正时长 ${r.durationFixed} 处、统一人物别名 ${r.aliased} 处；` +
                          `合并表头 ${r.headsMerged} 处、回填原文台词 ${r.dialogueRestored} 条；` +
                          `去重重复台词 ${r.dialogueDeduped} 条；` +
                          "模型质检已清空，建议重跑一次",
                      );
                    }
                  }}
                >
                  按协议规范化
                </button>
                <button
                  className="btn ghost sm"
                  type="button"
                  disabled={!state.batches.length || qcRunning}
                  onClick={runQcOnAll}
                >
                  {qcRunning ? "质检中…" : "对现有结果跑质检"}
                </button>
              </div>
              {!state.qcEnabled ? (
                <p className="hint">本次未开启内容质检（可在步骤 01 勾选）。</p>
              ) : qcIssues.length ? (
                <div className="table-wrap est-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>级别</th>
                        <th>来源</th>
                        <th>位置</th>
                        <th>规则</th>
                        <th>证据</th>
                      </tr>
                    </thead>
                    <tbody>
                      {qcIssues.slice(0, 200).map((it, i) => (
                        <tr key={i}>
                          <td>{it.level}</td>
                          <td>{it.source === "engine" ? "引擎" : "模型"}</td>
                          <td className="mono">{it.where}</td>
                          <td>{it.rule}</td>
                          <td>{it.evidence}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="hint">没发现违规项。</p>
              )}
              {normalizeTip ? <p className="hint">{normalizeTip}</p> : null}
              {state.batches.some((b) => b.qcError) ? (
                <p className="hint warn-line">
                  有 {state.batches.filter((b) => b.qcError).length} 批质检调用失败，
                  这些批次只做了引擎检查：{state.batches.find((b) => b.qcError)?.qcError}
                </p>
              ) : null}
              {state.batches.some((b) => b.qcDropped > 0) ? (
                <p className="hint">
                  模型另有{" "}
                  {state.batches.reduce((n, b) => n + (b.qcDropped || 0), 0)} 条未通过引用校验，
                  已丢弃（定位不在本批，或引用的原文搜不到）。
                </p>
              ) : null}
            </div>
          </section>

        </>
      ) : null}
    </>
  );
}
