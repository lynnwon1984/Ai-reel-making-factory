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
  Code,
} from "@phosphor-icons/react";
import { runStream } from "./api.js";
import { runChunked } from "./chunked.js";
import {
  parseStoryboard,
  validateStoryboard,
  compileToL1,
  renderL1,
  splitEpisodes,
} from "./storyboard.js";
import defaultStoryboard from "./prompts/default-storyboard.md?raw";

const STORAGE_KEY = "pd-storyboard-v1";

/** 提示词文件前面有助手写的元信息，只取正文 */
const defaultPromptBody = (() => {
  const i = defaultStoryboard.indexOf("# 海外竖屏短剧 AI 分镜提示词");
  return i >= 0 ? defaultStoryboard.slice(i) : defaultStoryboard;
})();

const INITIAL = {
  stage: "input", // input | running | done
  mode: "paste",
  text: "",
  fileName: "",
  customPrompt: "",
  batchSize: 3,
  output: "",
  doneBatches: 0,
  error: "",
  showPrompt: false,
};

/** 示例分镜：用来在不调模型的情况下看校验与 L1 编译效果 */
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
    if (raw) return { ...INITIAL, ...JSON.parse(raw) };
  } catch (err) {
    /* ignore */
  }
  return INITIAL;
}

function download(filename, content) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function batchUp(eps, size) {
  const out = [];
  for (let i = 0; i < eps.length; i += size) {
    out.push(eps.slice(i, i + size));
  }
  return out;
}

export function StoryboardFlow() {
  const [state, setState] = useState(load);
  const [live, setLive] = useState("");
  const [reason, setReason] = useState(0);
  const [batchInfo, setBatchInfo] = useState({ index: 0, total: 0, round: 0 });
  const ctrlRef = useRef(null);

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
  const episodes = useMemo(() => splitEpisodes(state.text), [state.text]);
  const batches = useMemo(
    () => batchUp(episodes, Math.max(1, Number(state.batchSize) || 3)),
    [episodes, state.batchSize],
  );

  const parsed = useMemo(() => parseStoryboard(state.output), [state.output]);
  const check = useMemo(() => validateStoryboard(parsed), [parsed]);
  const units = useMemo(() => compileToL1(parsed), [parsed]);
  const l1 = useMemo(() => renderL1(units), [units]);

  const run = async () => {
    if (!state.text.trim()) return patch({ error: "请先粘贴或上传剧本。" });
    if (!batches.length) return patch({ error: "没有识别到可处理的集。" });

    ctrlRef.current = new AbortController();
    patch({ stage: "running", error: "", output: "", doneBatches: 0 });
    setLive("");
    setReason(0);
    setBatchInfo({ index: 0, total: batches.length, round: 0 });

    let acc = "";
    try {
      for (let bi = 0; bi < batches.length; bi += 1) {
        const batch = batches[bi];
        const from = batch[0].no;
        const to = batch[batch.length - 1].no;
        setBatchInfo({ index: bi + 1, total: batches.length, round: 0 });
        setLive("");

        const body = batch.map((e) => e.text).join("\n\n");
        const { text } = await runChunked({
          seed: `【本批】第${from}–${to}集\n\n${body}\n\n请按协议把以上内容转成分镜头剧本。`,
          next: "请继续输出剩余部分。",
          maxRounds: 6,
          onRound: (n) => setBatchInfo({ index: bi + 1, total: batches.length, round: n }),
          onProgress: (full) => {
            patch({ output: acc + full, doneBatches: bi });
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

        acc += (acc ? "\n\n" : "") + text.trim();
        patch({ output: acc, doneBatches: bi + 1 });
        setLive("");
      }
      patch({ stage: "done" });
    } catch (err) {
      patch({
        stage: "input",
        error: String(err?.message || err),
      });
    } finally {
      ctrlRef.current = null;
    }
  };

  const stop = () => {
    ctrlRef.current?.abort();
    ctrlRef.current = null;
    patch({ stage: state.output ? "done" : "input" });
  };

  const reset = () => {
    stop();
    patch({ ...INITIAL, text: state.text, fileName: state.fileName, mode: state.mode });
    setLive("");
  };

  const onFile = async (file) => {
    if (!file) return;
    const content = await file.text();
    patch({ text: content, fileName: file.name.replace(/\.[^.]+$/, "") });
  };

  const shown = state.stage === "running" ? state.output + live : state.output;

  return (
    <>
      <div className="flow-head">
        <div className="steps">
          <div className={`step ${state.stage === "input" ? "active" : "done"}`}>
            <span className="num">1</span> 输入 · 分集剧本
          </div>
          <div className={`step ${state.stage === "input" ? "" : "done"}`}>
            <span className="num">2</span> 提示词 · 可替换
          </div>
          <div className={`step ${state.stage === "running" ? "active" : ""}`}>
            <span className="num">3</span> 生成 · 每批 N 集
          </div>
          <div className={`step ${state.stage === "done" ? "active" : ""}`}>
            <span className="num">4</span> 校验 · 只报告
          </div>
          <div className={`step ${state.stage === "done" ? "active" : ""}`}>
            <span className="num">5</span> 可选 · 机读层
          </div>
        </div>
        <div className="flow-actions">
          {state.stage === "running" ? (
            <button className="btn ghost sm" type="button" onClick={stop}>
              <Stop size={14} /> 停止
            </button>
          ) : null}
          {state.stage !== "input" || state.output ? (
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

      {state.stage === "done" ? (
        <div className="howto">
          <div className="howto-title">这一步就三件事</div>
          <ol>
            <li>
              <b>看校验</b> —— 高优先级问题必须处理；中优先级看一眼。
            </li>
            <li>
              <b>看分镜</b> —— 这就是交付物；不满意就改进提示词重跑。
            </li>
            <li>
              <b>（可选）机读层</b> —— 需要的话再导出，给下游制作工具用。
            </li>
          </ol>
        </div>
      ) : null}

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
          每集 4–15 秒 × N 个 Clip，一次生成一批。
        </p>

        {state.mode === "paste" ? (
          <textarea
            className="script"
            placeholder="在此粘贴分集剧本……带「第X集：集名」就能自动按集分批。"
            value={state.text}
            onChange={(e) => patch({ text: e.target.value })}
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
            onClick={() => patch({ output: SAMPLE_STORYBOARD, stage: "done", doneBatches: 1 })}
          >
            载入示例分镜
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
          <button
            className="btn primary"
            type="button"
            disabled={!state.text.trim() || state.stage === "running"}
            onClick={run}
          >
            <Play size={15} /> 开始生成
          </button>
        </div>
      </section>

      {state.stage !== "input" || state.output ? (
        <>
          <section className="card">
            <div className="card-head">
              <div>
                <div className="card-kicker">步骤 02 · 提示词</div>
                <div className="card-title">
                  默认提示词 · {defaultPromptBody.length} 字
                </div>
              </div>
              <div className="spacer" />
              <span className={`pill ${state.customPrompt.trim() ? "custom" : ""}`}>
                {state.customPrompt.trim() ? "使用自定义" : "使用默认"}
              </span>
              <button
                className="btn ghost sm"
                type="button"
                onClick={() => patch({ showPrompt: !state.showPrompt })}
              >
                <Code size={14} /> {state.showPrompt ? "收起" : "查看 / 替换"}
              </button>
            </div>
            {state.showPrompt ? (
              <>
                <textarea
                  className="script prompt-input"
                  value={state.customPrompt}
                  onChange={(e) => patch({ customPrompt: e.target.value })}
                  placeholder="留空 → 使用默认提示词；粘贴你自己的 → 覆盖默认。"
                />
                <div className="row">
                  <span className="hint">
                    {state.customPrompt.trim()
                      ? `已自定义（${state.customPrompt.trim().length} 字）`
                      : "当前为空，使用默认提示词。"}
                  </span>
                  <div className="spacer" />
                  <button
                    className="btn ghost sm"
                    type="button"
                    disabled={!state.customPrompt.trim()}
                    onClick={() => patch({ customPrompt: "" })}
                  >
                    清空，改回默认
                  </button>
                </div>
              </>
            ) : null}
          </section>

          {state.stage === "running" || state.output ? (
            <section className="card hi">
              <div className="card-head">
                <div>
                  <div className="card-kicker">步骤 03 · 生成</div>
                  <div className="card-title">
                    {state.stage === "running"
                      ? `第 ${batchInfo.index}/${batchInfo.total} 批 · 第 ${batchInfo.round} 轮`
                      : `已完成 ${state.doneBatches}/${batches.length} 批`}
                  </div>
                </div>
                <div className="spacer" />
                {state.stage === "running" ? (
                  <span className="hint">思考 {reason} 字 · 本轮输出 {live.length} 字</span>
                ) : null}
                <button
                  className="btn sm"
                  type="button"
                  disabled={!state.output}
                  onClick={() =>
                    download(`${state.fileName || "剧本"}-分镜.md`, state.output)
                  }
                >
                  <DownloadSimple size={14} /> 下载分镜
                </button>
              </div>
              <div className="progress">
                <div
                  className="bar"
                  style={{
                    width: `${batches.length ? (state.doneBatches / batches.length) * 100 : 0}%`,
                  }}
                />
              </div>
              <div className="preview script-preview">
                <pre>{shown || "（还没有输出）"}</pre>
              </div>
            </section>
          ) : null}
        </>
      ) : null}

      {state.output ? (
        <>
          <section className="card">
            <div className="card-head">
              <div>
                <div className="card-kicker">步骤 04 · 校验（只报告，不改稿）</div>
                <div className="card-title">
                  {check.stats.episodes} 集 · {check.stats.shots} shot · {check.stats.clips} Clip
                </div>
              </div>
              <div className="spacer" />
              <span className={`pill ${check.stats.high ? "l3" : ""}`}>
                高 {check.stats.high}
              </span>
              <span className={`pill ${check.stats.mid ? "l2" : ""}`}>中 {check.stats.mid}</span>
            </div>
            {!check.issues.length ? (
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
          </section>

          <section className="card">
            <div className="card-head">
              <div>
                <div className="card-kicker">步骤 05 · 机读层 L1（可选导出）</div>
                <div className="card-title">{units.length} 条生成单位（一个 Clip 一条）</div>
              </div>
              <div className="spacer" />
              <button
                className="btn primary sm"
                type="button"
                disabled={!units.length}
                onClick={() => download(`${state.fileName || "剧本"}-L1.md`, l1)}
              >
                <DownloadSimple size={14} /> 下载 L1
              </button>
            </div>
            <p className="hint">
              标签占位（<code>&lt;C01-角色·妆造&gt;</code>），不含秒数，不写 <code>@图片N</code> ——
              素材绑定由下游完成。duration 只出现在参数行。
            </p>
            <div className="preview script-preview">
              <pre>{l1 || "（无）"}</pre>
            </div>
          </section>
        </>
      ) : null}
    </>
  );
}
