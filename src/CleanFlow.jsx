import { useEffect, useMemo, useRef, useState } from "react";
import {
  UploadSimple,
  DownloadSimple,
  ArrowRight,
  CheckCircle,
  ArrowsClockwise,
  WarningCircle,
} from "@phosphor-icons/react";
import { PromptSlot } from "./PromptSlot.jsx";
import { SOURCE_SAMPLE } from "./mock.js";
import { runStream } from "./api.js";
import {
  canReviewPerItem,
  buildDecisionText,
  parseChecklist,
  splitDiagnosticReports,
} from "./checklist.js";
import { validateScript } from "./validate.js";
import { cleanActionCostume } from "./costume-cleanup.js";
import { buildStep1Brief, extractDeferredItems } from "./deferred.js";
import { handOffToSplit } from "./handoff.js";
import { runChunked, MAX_ROUNDS } from "./chunked.js";
import { analyzeFormatScript } from "./clean-engine.js";
import defaultOrganize from "./prompts/default-organize.md?raw";
import defaultLogic from "./prompts/default-logic.md?raw";

const STORAGE_KEY = "pd-clean-script-v1";

const INITIAL = {
  stage: "input", // input | checklist | result1 | diagnose | result2
  mode: "paste",
  text: "",
  fileName: "",
  customOrg: "",
  customLogic: "",
  checkMode: "local", // local | model
  effortMode: "low", // low | high | auto（auto = 分析步骤 high、长输出 low）
  checklist: "",
  organized: "",
  diagnose: "",
  final: "",
  error: "",
  failedAt: null, // organize | confirm1 | logic | confirm2
  run: null, // 中断恢复：{ kind, startedAt }
  decChecklist: {},
  decDiagnose: {},
  noteChecklist: "",
  noteDiagnose: "",
  acceptedDeferred: {},
};

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...INITIAL, ...JSON.parse(raw) };
  } catch (err) {
    /* 忽略损坏的本地状态 */
  }
  return INITIAL;
}

/* ---------- 渲染小块 ---------- */

function Line({ text }) {
  const clean = text.replace(/\*\*/g, "").replace(/\s+$/, "");
  if (!clean.trim()) return <div className="line blank" />;
  if (/^第\d+集/.test(clean)) return <div className="line ep">{clean}</div>;
  if (/^\d+-\d+\s/.test(clean)) return <div className="line scene">{clean}</div>;
  if (clean.startsWith("人物：")) return <div className="line cast">{clean}</div>;
  if (clean.startsWith("△")) return <div className="line act">{clean}</div>;
  const cut = clean.indexOf("：");
  if (cut > 0 && cut < 26) {
    return (
      <div className="line dlg">
        <span className="who">{clean.slice(0, cut)}</span>
        {clean.slice(cut)}
      </div>
    );
  }
  return <div className="line">{clean}</div>;
}

function ScriptPreview({ text }) {
  const lines = useMemo(() => text.split("\n"), [text]);
  return (
    <div className="preview">
      {lines.map((line, i) => (
        <Line key={i} text={line} />
      ))}
    </div>
  );
}

function Doc({ text }) {
  return <pre className="doc">{text}</pre>;
}

function ChecklistReview({
  items,
  isChecked,
  onToggle,
  onAll,
  note,
  onNote,
  showNote = true,
}) {
  const okCount = items.filter(isChecked).length;
  return (
    <div className="review">
      <div className="review-head">
        <span className="hint">
          共 {items.length} 项 · 已勾选 {okCount} 项
        </span>
        <div className="spacer" />
        <button className="btn ghost sm" type="button" onClick={() => onAll(true)}>
          全选
        </button>
        <button className="btn ghost sm" type="button" onClick={() => onAll(false)}>
          全不选
        </button>
      </div>
      <div className="review-list">
        {items.map((item) => (
          <label className={`review-item${item.risk ? " risk" : ""}`} key={item.no}>
            <input type="checkbox" checked={isChecked(item)} onChange={() => onToggle(item.no)} />
            <span className="rv-no">{item.no}</span>
            <span className="rv-main">
              <span className="rv-title">
                {item.title}
                {item.risk ? <span className="pill l3">L3 · 需单独授权</span> : null}
              </span>
              {item.body.length ? (
                <span className="rv-body">{item.body.join(" ").slice(0, 160)}</span>
              ) : null}
            </span>
          </label>
        ))}
      </div>
      {showNote ? (
        <textarea
          className="script prompt-input rv-note"
          placeholder="补充修改要求（可选）：例如「第 10 项瓦鲁斯着装改为深色长袍」"
          value={note}
          onChange={(event) => onNote(event.target.value)}
        />
      ) : null}
    </div>
  );
}

function ValidationPanel({ text }) {
  const [open, setOpen] = useState(false);
  const report = useMemo(() => validateScript(text), [text]);
  const warns = report.checks.filter((one) => one.level === "warn");

  return (
    <div className={`valid${warns.length ? " has-warn" : ""}`}>
      <div className="valid-head">
        <span className="valid-pill">{warns.length ? `${warns.length} 项提示` : "校验通过"}</span>
        <span className="hint">{report.stats} · 只做检查，不修改内容</span>
        <div className="spacer" />
        <button className="btn ghost sm" type="button" onClick={() => setOpen((v) => !v)}>
          {open ? "收起" : "查看"}
        </button>
      </div>
      {open ? (
        <ul className="valid-list">
          {report.checks.map((one, i) => (
            <li key={i} className={one.level}>
              <span className="valid-mark">{one.level === "warn" ? "!" : "✓"}</span>
              <span>
                {one.title}
                {one.detail ? <span className="valid-detail">　{one.detail}</span> : null}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function StreamStatus({ phase, reason, chars, round }) {
  return (
    <div className="progress">
      <div className="pmeta">
        <span>
          <span className="spin" />
          {phase === "reason" ? "思考中……" : "正在输出……"}
          {round > 1 ? ` · 第 ${round} 轮连续输出` : ""}
        </span>
        <span>
          {phase === "reason"
            ? `已思考 ${reason.toLocaleString()} 字`
            : `已输出 ${chars.toLocaleString()} 字`}
        </span>
      </div>
      <div className="bar">
        <span className="indeterminate" />
      </div>
    </div>
  );
}

/* ---------- 流式文本缓冲（节流刷新，避免每个字都重渲染） ---------- */

function useLiveText() {
  const ref = useRef("");
  const [text, setText] = useState("");

  useEffect(() => {
    const id = setInterval(() => {
      setText((prev) => (prev === ref.current ? prev : ref.current));
    }, 120);
    return () => clearInterval(id);
  }, []);

  return {
    text,
    append: (delta) => {
      ref.current += delta;
      return ref.current;
    },
    current: () => ref.current,
    reset: () => {
      ref.current = "";
      setText("");
    },
  };
}

function downloadFile(filename, content) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ---------- 主流程 ---------- */

export function CleanFlow() {
  const [state, setState] = useState(load);
  const stateRef = useRef(state);
  const [busy, setBusy] = useState(null); // organize | confirm1 | logic | confirm2
  const [reason, setReason] = useState(0);
  const [round, setRound] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const live = useLiveText();
  const fileRef = useRef(null);
  const ctrlRef = useRef(null);
  const runIdRef = useRef("");

  useEffect(
    () => () => {
      ctrlRef.current?.abort();
    },
    [],
  );

  const {
    stage,
    mode,
    text,
    fileName,
    customOrg,
    customLogic,
    checkMode,
    effortMode,
    checklist,
    organized,
    diagnose,
    final: finalText,
    error,
    failedAt,
    run,
    decChecklist,
    decDiagnose,
    noteChecklist,
    noteDiagnose,
    acceptedDeferred = {},
  } = state;

  const patch = (next) => {
    const base = stateRef.current;
    const delta = typeof next === "function" ? next(base) : next;
    const merged = { ...base, ...delta };
    stateRef.current = merged;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    } catch (err) {
      /* 存储不可用时忽略 */
    }
    setState(merged);
  };

  const canOrganize = mode === "upload" ? Boolean(fileName) : text.trim().length > 0;
  const promptOrg = customOrg.trim() ? customOrg : defaultOrganize;
  const promptLogic = customLogic.trim() ? customLogic : defaultLogic;
  const phase = live.text.length > 0 ? "text" : "reason";
  // 档位分级：auto = 分析类步骤 high、长输出步骤 low；也可手动统一档位
  const effortFor = (kind) =>
    effortMode === "auto" ? (kind === "analyze" ? "high" : "low") : effortMode;

  const checklistItems = useMemo(() => parseChecklist(checklist), [checklist]);
  const diagnosticSections = useMemo(
    () => splitDiagnosticReports(diagnose),
    [diagnose],
  );
  const diagnoseItems = useMemo(
    () =>
      diagnosticSections.length
        ? diagnosticSections.flatMap((section) =>
            section.reviewable ? section.items : [],
          )
        : parseChecklist(diagnose),
    [diagnose, diagnosticSections],
  );
  const reviewChecklist = canReviewPerItem(checklistItems);
  const reviewDiagnose = diagnosticSections.length
    ? diagnoseItems.length > 0
    : canReviewPerItem(diagnoseItems);
  const deferredItems = useMemo(
    () => extractDeferredItems(`${diagnose}\n${finalText}`),
    [diagnose, finalText],
  );
  const outstandingDeferredItems = useMemo(
    () => deferredItems.filter((one) => !acceptedDeferred[one]),
    [deferredItems, acceptedDeferred],
  );
  const cleanedFinal = useMemo(() => cleanActionCostume(finalText), [finalText]);

  const decMap = (kind) => (kind === "checklist" ? decChecklist : decDiagnose) || {};
  const isChecked = (kind, item) => decMap(kind)[item.no] ?? !item.risk;
  const toggleDec = (kind, no, items) => {
    const key = kind === "checklist" ? "decChecklist" : "decDiagnose";
    const map = decMap(kind);
    const item = items.find((one) => one.no === no);
    const now = map[no] ?? !item?.risk;
    patch({ [key]: { ...map, [no]: !now } });
  };
  const setAllDec = (kind, value, items) => {
    const key = kind === "checklist" ? "decChecklist" : "decDiagnose";
    const next = {};
    for (const item of items) next[item.no] = value;
    patch({ [key]: next });
  };

  const onFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => patch({ fileName: file.name, text: String(reader.result || "") });
    reader.readAsText(file);
  };

  // 每次开跑前中断上一轮请求，避免旧流回来后把已重置的界面又写脏
  const newRun = () => {
    ctrlRef.current?.abort();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    return ctrl.signal;
  };

  const newRunId = () => {
    runIdRef.current = `${new Date().toISOString().slice(0, 19)}-${Math.random()
      .toString(36)
      .slice(2, 6)}`;
    return runIdRef.current;
  };

  const fail = (err, step) => {
    if (err?.name === "AbortError") return;
    patch({
      error: String(err?.message || err),
      failedAt: step,
      run: null,
    });
  };

  const organize = async () => {
    if (!canOrganize || busy) return;
    if (checkMode === "local") {
      try {
        const result = analyzeFormatScript(text);
        patch({
          checklist: result.checklist,
          stage: "checklist",
          error: "",
          failedAt: null,
          run: null,
          decChecklist: {},
          noteChecklist: "",
          acceptedDeferred: {},
        });
      } catch (err) {
        fail(err, "organize");
      }
      return;
    }
    patch({
      error: "",
      failedAt: "organize",
      run: { kind: "organize", startedAt: new Date().toISOString() },
      checklist: "",
      stage: "checklist",
    });
    setReason(0);
    live.reset();
    setBusy("organize");
    const signal = newRun();
    const runId = newRunId();
    try {
      let lastPersist = 0;
      const res = await runStream({
        instructions: promptOrg,
        input: `【原始剧本】\n${text}\n\n请先输出《统一确认清单》。`,
        effort: effortFor("analyze"),
        label: "① 统一确认清单",
        runId,
        onText: (delta) => {
          const full = live.append(delta);
          const now = Date.now();
          if (now - lastPersist > 500) {
            lastPersist = now;
            patch({ checklist: full });
          }
        },
        onReason: setReason,
        signal,
      });
      patch({
        checklist: res.text || "（模型没有返回内容）",
        stage: "checklist",
        decChecklist: {},
        noteChecklist: "",
        acceptedDeferred: {},
        run: null,
      });
      live.reset();
      patch({ failedAt: null });
    } catch (err) {
      fail(err, "organize");
    } finally {
      setBusy(null);
    }
  };

  // 输出循环：一轮被截断（incomplete）时自动接续，最多 MAX_ROUNDS 轮
  // 循环本体已抽到 src/chunked.js（纯函数、可测），这里只负责接到 UI 的状态上
  const runOutput = async ({
    field,
    instructions,
    prefix,
    seed,
    next,
    signal,
    effort,
    label,
    runId,
    existing = "",
  }) => {
    const { text } = await runChunked({
      prefix,
      seed,
      next,
      existing,
      maxRounds: MAX_ROUNDS,
      onRound: setRound,
      onProgress: (full) => patch({ [field]: full }),
      callModel: async ({ input, round, full }) => {
        live.reset();
        let roundText = "";
        let lastPersist = 0;
        return runStream({
          instructions,
          input,
          effort,
          label: `${label} 第${round}轮`,
          runId,
          onText: (delta) => {
            live.append(delta);
            roundText += delta;
            const now = Date.now();
            if (now - lastPersist > 500) {
              lastPersist = now;
              patch({ [field]: `${full}${roundText}` });
            }
          },
          onReason: setReason,
          signal,
        });
      },
    });
    live.reset();
    return text;
  };

  const confirm1 = async ({ resume = false } = {}) => {
    if (busy) return;
    patch({
      error: "",
      failedAt: "confirm1",
      run: { kind: "confirm1", startedAt: new Date().toISOString() },
      stage: "result1",
      ...(resume ? {} : { organized: "" }),
    });
    setReason(0);
    setRound(0);
    setBusy("confirm1");
    const signal = newRun();
    try {
      await runOutput({
        field: "organized",
        instructions: promptOrg,
        prefix: `【原始剧本】\n${text}`,
        seed: `【已确认的《统一确认清单》】\n${checklist}\n\n${
          reviewChecklist
            ? buildDecisionText(
                checklistItems,
                (item) => isChecked("checklist", item),
                noteChecklist,
              )
            : "用户已确认上述全部处理项。"
        }\n\n请输出整理后的完整剧本。`,
        next: "请继续输出整理后的剧本的剩余部分。",
        signal,
        effort: effortFor("generate"),
        label: "① 整理输出",
        runId: runIdRef.current,
        existing: resume ? organized : "",
      });
      patch({ failedAt: null, run: null });
    } catch (err) {
      fail(err, "confirm1");
    } finally {
      setBusy(null);
    }
  };

  const startLogic = async () => {
    if (busy) return;
    patch({
      error: "",
      failedAt: "logic",
      run: { kind: "logic", startedAt: new Date().toISOString() },
      diagnose: "",
      stage: "diagnose",
    });
    setReason(0);
    live.reset();
    setBusy("logic");
    const signal = newRun();
    try {
      let lastPersist = 0;
      const res = await runStream({
        instructions: promptLogic,
        input: `【待处理的剧本】\n${organized}\n\n请先输出《逻辑诊断清单》《道具连续性台账》《人物动线表》《高风险剧情修复清单（L3，若有）》《台词翻译确认清单》。`,
        effort: effortFor("analyze"),
        label: "② 逻辑诊断清单",
        runId: runIdRef.current || newRunId(),
        onText: (delta) => {
          const full = live.append(delta);
          const now = Date.now();
          if (now - lastPersist > 500) {
            lastPersist = now;
            patch({ diagnose: full });
          }
        },
        onReason: setReason,
        signal,
      });
      patch({
        diagnose: res.text || "（模型没有返回内容）",
        stage: "diagnose",
        decDiagnose: {},
        noteDiagnose: "",
        run: null,
      });
      live.reset();
      patch({ failedAt: null });
    } catch (err) {
      fail(err, "logic");
    } finally {
      setBusy(null);
    }
  };

  const confirm2 = async ({ resume = false } = {}) => {
    if (busy) return;
    patch({
      error: "",
      failedAt: "confirm2",
      run: { kind: "confirm2", startedAt: new Date().toISOString() },
      stage: "result2",
      acceptedDeferred: {},
      ...(resume ? {} : { final: "" }),
    });
    setReason(0);
    setRound(0);
    setBusy("confirm2");
    const signal = newRun();
    try {
      const output = await runOutput({
        field: "final",
        instructions: promptLogic,
        prefix: `【待处理的剧本】\n${organized}`,
        seed: `【已确认的诊断清单】\n${diagnose}\n\n${
          reviewDiagnose
            ? buildDecisionText(
                diagnoseItems,
                (item) => isChecked("diagnose", item),
                noteDiagnose,
              )
            : "用户已确认上述全部处理项。"
        }\n\n请输出标准化后的完整剧本。`,
        next: "请继续输出标准化剧本的剩余部分。",
        signal,
        effort: effortFor("generate"),
        label: "② 标准化输出",
        runId: runIdRef.current,
        existing: resume ? finalText : "",
      });
      const cleaned = cleanActionCostume(output);
      patch({ final: cleaned.text, failedAt: null, run: null });
    } catch (err) {
      fail(err, "confirm2");
    } finally {
      setBusy(null);
    }
  };

  const reset = ({ keepScript = true } = {}) => {
    ctrlRef.current?.abort();
    setConfirmOpen(false);
    setBusy(null);
    setReason(0);
    setRound(0);
    live.reset();
    patch({
      stage: "input",
      error: "",
      failedAt: null,
      run: null,
      checklist: "",
      organized: "",
      diagnose: "",
      final: "",
      decChecklist: {},
      decDiagnose: {},
      noteChecklist: "",
      noteDiagnose: "",
      acceptedDeferred: {},
      ...(keepScript ? {} : { text: "", fileName: "" }),
    });
  };

  // 失败后按出错的那一步重试：输出类从已产出的内容接着跑，不从头再来
  const retry = () => {
    if (busy) return;
    if (failedAt === "organize") return organize();
    if (failedAt === "confirm1") return confirm1({ resume: true });
    if (failedAt === "logic") return startLogic();
    if (failedAt === "confirm2") return confirm2({ resume: true });
  };

  // 格式类遗留项交回第①步：把「待处理剧本 + 事项」填回输入框，回到步骤①
  const sendBackToStep1 = () => {
    if (!outstandingDeferredItems.length || !finalText) return;
    ctrlRef.current?.abort();
    setBusy(null);
    setConfirmOpen(false);
    setReason(0);
    setRound(0);
    live.reset();
    patch({
      text: buildStep1Brief(outstandingDeferredItems, cleanedFinal.text),
      mode: "paste",
      stage: "input",
      error: "",
      failedAt: null,
      run: null,
      checklist: "",
      organized: "",
      diagnose: "",
      final: "",
      decChecklist: {},
      decDiagnose: {},
      noteChecklist: "",
      noteDiagnose: "",
      acceptedDeferred: {},
    });
  };

  const acceptDeferred = (one) => {
    patch({ acceptedDeferred: { ...acceptedDeferred, [one]: true } });
  };

  const stageStep = {
    input: 1,
    checklist: 2,
    result1: 3,
    diagnose: 4,
    result2: 5,
  }[stage] || 1;
  const flowSteps = [
    "输入剧本",
    "格式检查",
    "执行格式整理",
    "逻辑检查",
    "执行逻辑修复",
  ];
  const stepClass = (index) =>
    index < stageStep ? "done" : index === stageStep ? "active" : "";
  const interrupted = Boolean(run) && !busy;

  const checklistShown = busy === "organize" ? live.text : checklist;
  const organizeShown = busy === "confirm1" ? organized + live.text : organized;
  const diagnoseShown = busy === "logic" ? live.text : diagnose;
  const finalShown =
    busy === "confirm2" ? finalText + live.text : cleanedFinal.text;

  return (
    <>
      <div className="flow-head">
        <div className="steps">
          {flowSteps.map((label, index) => (
            <div className={`step ${stepClass(index + 1)}`} key={label}>
              <span className="num">{index + 1}</span> {label}
            </div>
          ))}
        </div>
        <div className="flow-actions">
          {busy ? <span className="hint">运行中……</span> : null}
          {stage !== "input" || busy ? (
            <button
              className="btn ghost sm"
              type="button"
              onClick={() => setConfirmOpen((v) => !v)}
            >
              <ArrowsClockwise size={14} /> 重新开始
            </button>
          ) : null}
        </div>
      </div>

      {confirmOpen ? (
        <div className="confirm-bar">
          <div>
            重新开始会清空当前生成的结果{busy ? "，并中断正在运行的请求" : ""}。已输入的剧本要保留吗？
          </div>
          <div className="row">
            <button className="btn sm" type="button" onClick={() => reset({ keepScript: true })}>
              保留剧本，重跑
            </button>
            <button className="btn sm" type="button" onClick={() => reset({ keepScript: false })}>
              全部清空
            </button>
            <div className="spacer" />
            <button
              className="btn ghost sm"
              type="button"
              onClick={() => setConfirmOpen(false)}
            >
              取消
            </button>
          </div>
        </div>
      ) : null}

      {error || interrupted ? (
        <div className="error-bar">
          <WarningCircle size={16} weight="fill" />
          <div>
            {error ||
              "上次运行在生成中途离开或刷新，已保留最后一段输出。可以从当前进度继续。"}
          </div>
          <div className="spacer" />
          {failedAt ? (
            <button className="btn sm" type="button" disabled={Boolean(busy)} onClick={retry}>
              <ArrowsClockwise size={14} /> 重试这一步
            </button>
          ) : null}
        </div>
      ) : null}

      {/* 输入 */}
      <section className={`card ${stage === "input" ? "hi" : ""}`}>
        <div className="card-head">
          <div>
            <div className="card-kicker">步骤 01 · 输入</div>
            <div className="card-title">输入剧本</div>
          </div>
          <div className="spacer" />
          <div className="tabs">
            <button
              type="button"
              className={`tab ${mode === "upload" ? "active" : ""}`}
              onClick={() => patch({ mode: "upload" })}
            >
              上传文件
            </button>
            <button
              type="button"
              className={`tab ${mode === "paste" ? "active" : ""}`}
              onClick={() => patch({ mode: "paste" })}
            >
              粘贴文字
            </button>
          </div>
        </div>

        <PromptSlot
          defaultText={defaultOrganize}
          value={customOrg}
          onChange={(v) => patch({ customOrg: v })}
          label="格式整理执行提示词"
        />

        {mode === "paste" ? (
          <textarea
            className="script"
            placeholder="在此粘贴原始剧本……"
            value={text}
            onChange={(e) => patch({ text: e.target.value })}
          />
        ) : (
          <div className="drop">
            <UploadSimple size={26} />
            <div className="big">{fileName || "把剧本文件拖到这里，或点击选择"}</div>
            <div className="hint">原型阶段支持 .txt / .md</div>
            <input ref={fileRef} type="file" accept=".txt,.md,text/plain" hidden onChange={onFile} />
            <button className="btn" type="button" onClick={() => fileRef.current?.click()}>
              选择文件
            </button>
          </div>
        )}

        <div className="row">
          <button
            className="btn ghost"
            type="button"
            onClick={() => patch({ text: SOURCE_SAMPLE, mode: "paste" })}
          >
            填入示例剧本
          </button>
          <label className="effort">
            <span className="hint">格式检查</span>
            <select
              value={checkMode}
              disabled={Boolean(busy)}
              onChange={(e) => patch({ checkMode: e.target.value })}
            >
              <option value="local">本地规则 · 0 token</option>
              <option value="model">模型辅助</option>
            </select>
          </label>
          <label className="effort">
            <span className="hint">推理档位</span>
            <select
              value={effortMode}
              disabled={Boolean(busy)}
              onChange={(e) => patch({ effortMode: e.target.value })}
            >
              <option value="low">低（默认 · 快）</option>
              <option value="high">高（慢 · 更稳）</option>
              <option value="auto">自动（分析高 · 输出低）</option>
            </select>
          </label>
          <span className="hint">deepseek-flash · 流式</span>
          <div className="spacer" />
          <button
            className="btn primary"
            type="button"
            disabled={!canOrganize || Boolean(busy)}
            onClick={organize}
          >
            检查格式 <ArrowRight size={15} weight="bold" />
          </button>
        </div>
      </section>

      {/* 统一确认清单 */}
      {stage !== "input" || busy === "organize" ? (
        <section className={`card ${stage === "checklist" || busy === "organize" ? "hi" : ""}`}>
          <div className="card-head">
            <div>
              <div className="card-kicker">步骤 01 · 第一轮</div>
              <div className="card-title">统一确认清单</div>
            </div>
            <div className="spacer" />
            <span className="pill">
              {busy === "organize" ? "生成中" : stage === "checklist" ? "待确认" : "已确认"}
            </span>
          </div>
          <p className="sub">
            {checkMode === "local"
              ? "本地规则先扫描全部结构问题；语义不确定项会标为待判断，不会直接修改原稿。"
              : "模型先给出全部待处理项，你逐项确认之后才会执行。"}
          </p>
          {stage === "checklist" && reviewChecklist ? (
            <ChecklistReview
              items={checklistItems}
              isChecked={(item) => isChecked("checklist", item)}
              onToggle={(no) => toggleDec("checklist", no, checklistItems)}
              onAll={(value) => setAllDec("checklist", value, checklistItems)}
              note={noteChecklist}
              onNote={(value) => patch({ noteChecklist: value })}
            />
          ) : (
            <Doc text={checklistShown} />
          )}
          {busy === "organize" ? (
            <StreamStatus phase={phase} reason={reason} chars={live.text.length} round={1} />
          ) : null}
          {stage === "checklist" ? (
            <div className="row">
              <span className="hint">
                {reviewChecklist
                  ? "取消勾选的项不会执行；L3 高风险项默认不勾选，需你显式授权。"
                  : "未能识别出清单条目，改为整体确认。"}
              </span>
              <div className="spacer" />
              <button
                className="btn primary"
                type="button"
                disabled={Boolean(busy) || Boolean(run)}
                onClick={confirm1}
              >
                {reviewChecklist
                  ? `确认 ${checklistItems.filter((item) => isChecked("checklist", item)).length} 项`
                  : "确认"}
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* 整理后的剧本 */}
      {["result1", "diagnose", "result2"].includes(stage) ? (
        <section className="card">
          <div className="card-head">
            <div>
              <div className="card-kicker">步骤 01 · 第二轮</div>
              <div className="card-title">整理后的剧本</div>
            </div>
            <div className="spacer" />
            {busy === "confirm1" ? (
              <span className="pill">生成中</span>
            ) : (
              <span className="pill" style={{ color: "#8ee0aa" }}>
                已保存
              </span>
            )}
          </div>
          <ScriptPreview text={organizeShown} />
          {busy === "confirm1" ? (
            <StreamStatus phase={phase} reason={reason} chars={live.text.length} round={round} />
          ) : null}
          {busy !== "confirm1" && organized ? <ValidationPanel text={organized} /> : null}
          {stage === "result1" || ["diagnose", "result2"].includes(stage) ? (
            <PromptSlot
              defaultText={defaultLogic}
              value={customLogic}
              onChange={(value) => patch({ customLogic: value })}
              label="第二步 · 逻辑修改提示词"
              readOnly={busy === "confirm1" || stage !== "result1"}
            />
          ) : null}
          {busy !== "confirm1" ? (
            <div className="row">
              <button
                className="btn"
                type="button"
                disabled={!organized}
                onClick={() => downloadFile("整理后的剧本.txt", organized)}
              >
                <DownloadSimple size={15} /> 下载
              </button>
              <div className="spacer" />
              {stage === "result1" ? (
                <button
                  className="btn primary"
                  type="button"
                  disabled={Boolean(busy) || Boolean(run)}
                  onClick={startLogic}
                >
                  开始第二步 · 修改逻辑 <ArrowRight size={15} weight="bold" />
                </button>
              ) : (
                <span className="hint">已进入第二步</span>
              )}
            </div>
          ) : null}
        </section>
      ) : null}

      {/* 逻辑诊断清单 */}
      {["diagnose", "result2"].includes(stage) || busy === "logic" ? (
        <section className={`card ${stage === "diagnose" || busy === "logic" ? "hi" : ""}`}>
          <div className="card-head">
            <div>
              <div className="card-kicker">步骤 02 · 第一轮</div>
              <div className="card-title">逻辑诊断清单</div>
            </div>
            <div className="spacer" />
            <span className="pill">
              {busy === "logic" ? "生成中" : stage === "diagnose" ? "待确认" : "已确认"}
            </span>
          </div>
          {stage === "diagnose" && diagnosticSections.length ? (
            <div className="diagnostic-stack">
              {diagnosticSections.map((section) => (
                <div className="diag-report" key={section.key}>
                  <div className="diag-report-head">
                    <strong>{section.title}</strong>
                    <span className="hint">
                      {section.reviewable && section.items.length
                        ? `${section.items.length} 个可确认项`
                        : section.reviewable
                          ? "无可逐项确认内容"
                          : "仅供核对"}
                    </span>
                  </div>
                  {section.reviewable && section.items.length ? (
                    <ChecklistReview
                      items={section.items}
                      isChecked={(item) => isChecked("diagnose", item)}
                      onToggle={(no) => toggleDec("diagnose", no, section.items)}
                      onAll={(value) => setAllDec("diagnose", value, section.items)}
                      showNote={false}
                    />
                  ) : section.raw ? (
                    <Doc text={section.raw} />
                  ) : (
                    <div className="hint">本项为空。</div>
                  )}
                </div>
              ))}
              <textarea
                className="script prompt-input rv-note"
                placeholder="补充修改要求（可选）：例如「台词翻译全部确认，但第 L3 项改为……」。"
                value={noteDiagnose}
                onChange={(event) => patch({ noteDiagnose: event.target.value })}
              />
            </div>
          ) : stage === "diagnose" && reviewDiagnose ? (
            <ChecklistReview
              items={diagnoseItems}
              isChecked={(item) => isChecked("diagnose", item)}
              onToggle={(no) => toggleDec("diagnose", no, diagnoseItems)}
              onAll={(value) => setAllDec("diagnose", value, diagnoseItems)}
              note={noteDiagnose}
              onNote={(value) => patch({ noteDiagnose: value })}
            />
          ) : (
            <Doc text={diagnoseShown} />
          )}
          {busy === "logic" ? (
            <StreamStatus phase={phase} reason={reason} chars={live.text.length} round={1} />
          ) : null}
          {stage === "diagnose" ? (
            <div className="row">
              <span className="hint">
                {reviewDiagnose
                  ? "取消勾选的项不会执行；L3 高风险项默认不勾选，需你显式授权。"
                  : "未能识别出诊断条目，改为整体确认。"}
              </span>
              <div className="spacer" />
              <button
                className="btn primary"
                type="button"
                disabled={Boolean(busy) || Boolean(run)}
                onClick={confirm2}
              >
                {reviewDiagnose
                  ? `确认 ${diagnoseItems.filter((item) => isChecked("diagnose", item)).length} 项`
                  : "确认"}
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* 标准化剧本 */}
      {stage === "result2" ? (
        <section className="card hi">
          <div className="card-head">
            <div>
              <div className="card-kicker">步骤 02 · 第二轮</div>
              <div className="card-title">标准化剧本</div>
            </div>
            <div className="spacer" />
            {busy === "confirm2" ? (
              <span className="pill">生成中</span>
            ) : (
              <span className="pill" style={{ color: "#8ee0aa" }}>
                <CheckCircle size={12} weight="fill" /> 完成
              </span>
            )}
          </div>
          <ScriptPreview text={finalShown} />
          {busy === "confirm2" ? (
            <StreamStatus phase={phase} reason={reason} chars={live.text.length} round={round} />
          ) : null}
          {busy !== "confirm2" && finalText ? <ValidationPanel text={cleanedFinal.text} /> : null}
          {busy !== "confirm2" && outstandingDeferredItems.length ? (
            <div className="deferred">
              <div className="deferred-head">
                <span className="pill l2">
                  格式类遗留 {outstandingDeferredItems.length} 项
                </span>
                <span className="hint">
                  第②步只标注不执行。确认当前结构合理时可保留，否则送回第一步。
                </span>
                <div className="spacer" />
                <button className="btn sm" type="button" onClick={sendBackToStep1}>
                  送回第一步处理
                </button>
              </div>
              <ul>
                {outstandingDeferredItems.map((one, i) => (
                  <li key={i}>
                    <span>{one}</span>
                    <button
                      className="btn ghost sm"
                      type="button"
                      onClick={() => acceptDeferred(one)}
                    >
                      保留此结构
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {busy !== "confirm2" ? (
            <div className="row">
              <button
                className="btn"
                type="button"
                disabled={!finalText || Boolean(run)}
                onClick={() => downloadFile("标准化剧本.txt", cleanedFinal.text)}
              >
                <DownloadSimple size={15} /> 下载完整剧本
              </button>
              <button
                className="btn primary"
                type="button"
                disabled={!finalText || Boolean(run)}
                onClick={() => {
                  handOffToSplit({ text: cleanedFinal.text, fileName });
                  window.location.hash = "#/episode";
                }}
              >
                拿去拆分集数 <ArrowRight size={15} weight="bold" />
              </button>
              <div className="spacer" />
              <button className="btn ghost" type="button" onClick={() => setConfirmOpen(true)}>
                <ArrowsClockwise size={15} /> 重新开始
              </button>
            </div>
          ) : null}
        </section>
      ) : null}
    </>
  );
}
