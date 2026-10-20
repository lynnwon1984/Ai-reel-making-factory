import { useMemo, useState } from "react";
import {
  ArrowsClockwise,
  UploadSimple,
  DownloadSimple,
  WarningCircle,
  Scissors,
  SlidersHorizontal,
  ArrowLeft,
  ArrowRight,
  MagnifyingGlass,
  Eye,
} from "@phosphor-icons/react";
import {
  DEFAULT_OPTIONS,
  OPTION_ROWS,
  parseScript,
  estimateAll,
  autoCuts,
  renumber,
  rebuildCast,
  renderScript,
  summarize,
  shiftCutLeft,
  shiftCutRight,
  normalizeSplits,
  suggestSplitPoint,
} from "./split.js";
import { SPLIT_SAMPLE } from "./mock-split.js";
import { readCleanResult } from "./handoff.js";

const STORAGE_KEY = "pd-split-v1";
/** 复核名单只列动作最重的这么多场 —— 全部标出来就没信息量了 */
const REVIEW_LIMIT = 20;

const INITIAL = {
  stage: "input", // input | done
  mode: "paste",
  text: "",
  fileName: "",
  options: DEFAULT_OPTIONS,
  overrides: {},
  splits: {}, // { 场次key: [切点块索引] } —— 场内下刀
  waived: {}, // { 集首场key: true } —— 这一集就这样，不改了
  cuts: null,
  cutMode: "auto", // auto | manual
  reviewOnly: false,
  showKnobs: false,
  error: "",
};

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      return {
        ...INITIAL,
        ...saved,
        // 旋钮新增项向后兼容
        options: { ...DEFAULT_OPTIONS, ...(saved.options ?? {}) },
      };
    }
  } catch (err) {
    /* 忽略损坏的本地状态 */
  }
  return INITIAL;
}

function downloadFile(filename, content, type = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const fmt = (s) => `${Math.round(s)}s`;
const mmss = (s) =>
  `${Math.floor(s / 60)} 分 ${String(Math.round(s % 60)).padStart(2, "0")} 秒`;

/** 集卡片：一场一行，边界两侧可把场景挪来挪去 */
function EpisodeCard({ ep, opt, totalEps, onMoveIn, onMoveOut, onToggleWaive }) {
  const first = ep.scenes[0];
  const last = ep.scenes[ep.scenes.length - 1];
  const status = ep.waived ? "waived" : ep.status;
  return (
    <div className={`ep-card ${status}`}>
      <div className="ep-head">
        <span className="ep-no">第 {ep.no} 集</span>
        <span className="ep-sec">{fmt(ep.sec)}</span>
        <span className={`wpill ${status}`}>
          {ep.waived
            ? "已接受"
            : ep.status === "ok"
            ? "窗口内"
            : ep.status === "over"
              ? `超上限 +${Math.round(ep.sec - opt.windowHi)}s`
              : `低于下限 −${Math.round(opt.windowLo - ep.sec)}s`}
        </span>
        <div className="spacer" />
        <span className="ep-meta">
          {first.key} → {last.key}｜{ep.scenes.length} 场
          {first.epTitle ? `｜原集：${ep.titles.join(" / ")}` : ""}
        </span>
        {ep.status !== "ok" ? (
          <button
            className="mini"
            type="button"
            title="这一集就保持现状，不再提示"
            onClick={() => onToggleWaive(first.key)}
          >
            {ep.waived ? "取消接受" : "接受这一集"}
          </button>
        ) : null}
      </div>

      {ep.tail ? (
        <div className="ep-tail">
          <span className="ep-tail-tag">集尾</span>
          <span>{ep.tail}</span>
        </div>
      ) : null}

      <div className="ep-scenes">
        {ep.scenes.map((s, i) => (
          <div className="ep-scene" key={s.key}>
            <span className="es-id">{s.key}</span>
            <span className="es-place">{s.place}</span>
            <span className="es-sec">{fmt(s.sec)}</span>
            {s.overridden ? <span className="es-tag">手改</span> : null}
            {s.capped ? <span className="es-tag warn">动作封顶</span> : null}
            <div className="spacer" />
            {i === 0 && ep.no > 1 ? (
              <button
                className="mini"
                type="button"
                title="把这一场挪到上一集"
                onClick={() => onMoveIn(ep.no - 2)}
              >
                <ArrowLeft size={13} /> 并入上一集
              </button>
            ) : null}
            {i === ep.scenes.length - 1 && ep.no < totalEps ? (
              <button
                className="mini"
                type="button"
                title="把这一场挪到下一集"
                onClick={() => onMoveOut(ep.no - 1)}
              >
                并入下一集 <ArrowRight size={13} />
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SplitFlow() {
  const [state, setState] = useState(load);

  // 所有状态变更都落盘 —— 切页/刷新/关掉重开都不丢进度
  const patch = (next) =>
    setState((s) => {
      const merged = { ...s, ...next };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      } catch (err) {
        /* 存储失败不影响使用 */
      }
      return merged;
    });

  const {
    stage,
    mode,
    text,
    fileName,
    options,
    overrides,
    splits,
    waived,
    cutMode,
    reviewOnly,
    showKnobs,
  } = state;

  const parsed = useMemo(() => parseScript(text), [text]);
  const scenes = useMemo(
    () => estimateAll(parsed, options, overrides, splits),
    [parsed, options, overrides, splits],
  );
  const cuts = state.cuts ?? autoCuts(scenes, options);

  const { list: eps, added } = useMemo(() => {
    const list = renumber(scenes, cuts, options);
    for (const ep of list) ep.waived = Boolean(waived[ep.scenes[0].key]);
    const addedCast = rebuildCast(list);
    return { list, added: addedCast };
  }, [scenes, cuts, options, waived]);

  const stats = useMemo(() => summarize(eps, options), [eps, options]);
  const output = useMemo(() => renderScript(eps), [eps]);
  // 「动作封顶」的场实测占一半以上，全标出来等于没标 —— 只挑动作最重的前 N 场
  const reviewKeys = useMemo(() => {
    const capped = scenes.filter((s) => s.capped);
    return new Set(
      [...capped]
        .sort((a, b) => b.actionLines - a.actionLines)
        .slice(0, REVIEW_LIMIT)
        .map((s) => s.key),
    );
  }, [scenes]);

  const setOption = (key, value) =>
    patch({
      options: { ...options, [key]: value },
      cuts: null,
      cutMode: "auto",
    });

  const setOverride = (key, value) => {
    const next = { ...overrides };
    if (value === "" || Number.isNaN(Number(value))) delete next[key];
    else next[key] = Math.max(0, Math.round(Number(value)));
    patch({ overrides: next, cuts: null, cutMode: "auto" });
  };

  // 用函数式更新：连点两次也不会拿旧的 cuts 算，避免状态互相覆盖
  const move = (fn, bi) => {
    setState((s) => {
      const base = s.cuts ?? autoCuts(scenes, s.options);
      const merged = {
        ...s,
        cuts: fn(base, bi, scenes.length),
        cutMode: "manual",
      };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      } catch (err) {
        /* ignore */
      }
      return merged;
    });
  };

  /* ---------- 场内下刀 ---------- */

  const sceneBlocks = (key) =>
    parsed.episodes.flatMap((e) => e.scenes).find((s) => s.key === key)?.blocks ?? [];

  const setSplit = (key, points) => {
    const clean = normalizeSplits(points, sceneBlocks(key).length);
    const next = { ...splits };
    if (clean.length) next[key] = clean;
    else delete next[key];
    patch({ splits: next, cuts: null, cutMode: "auto" });
  };

  const longScenes = scenes.filter((s) => s.parts === 1 && s.auto > options.windowHi);

  const splitOne = (key) => setSplit(key, [suggestSplitPoint(sceneBlocks(key), options)]);

  const nudgeSplit = (key, delta) => {
    const points = splits[key] ?? [];
    if (points.length !== 1) return; // 多个切点的微调留给以后
    setSplit(key, [points[0] + delta]);
  };

  const splitAll = () => {
    const next = { ...splits };
    for (const s of longScenes) {
      const blocks = sceneBlocks(s.key);
      if (blocks.length > 1) next[s.key] = [suggestSplitPoint(blocks, options)];
    }
    patch({ splits: next, cuts: null, cutMode: "auto" });
  };

  const toggleWaive = (key) => {
    const next = { ...waived };
    if (next[key]) delete next[key];
    else next[key] = true;
    patch({ waived: next });
  };

  const analyze = () => {
    if (!text.trim()) {
      patch({ error: "请先粘贴或上传剧本。" });
      return;
    }
    if (!parsed.sceneCount) {
      patch({
        error:
          "没有识别到任何场次。需要剧本带「第X集」与「X-Y 场景名」或「N. 场景名」标记。",
      });
      return;
    }
    patch({ stage: "done", cuts: null, cutMode: "auto", error: "" });
  };

  const reset = ({ keepScript }) => {
    const next = { ...INITIAL, options };
    if (keepScript) {
      next.text = text;
      next.fileName = fileName;
      next.mode = mode;
      next.stage = "done";
    }
    patch(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (err) {
      /* ignore */
    }
  };

  const onFile = async (file) => {
    if (!file) return;
    const content = await file.text();
    patch({ text: content, fileName: file.name.replace(/\.[^.]+$/, "") });
  };

  const exportCsv = () => {
    const head = "场次,场景名,台词秒,动作秒,建立秒,预估秒,手改\n";
    const rows = scenes
      .map(
        (s) =>
          `${s.key},"${s.place.replace(/"/g, "'")}",${s.dlg},${s.act},${s.est},${s.sec},${s.overridden ? "是" : ""}`,
      )
      .join("\n");
    downloadFile(`${fileName || "剧本"}-估时表.csv`, head + rows, "text/csv;charset=utf-8");
  };

  const step1 = stage === "input" ? "active" : "done";
  const step2 = stage === "done" ? "active" : "";

  const reviewScenes = scenes.filter((s) => reviewKeys.has(s.key));
  const shownScenes = reviewOnly ? reviewScenes : scenes;
  const cleanResult = readCleanResult();

  return (
    <>
      <div className="flow-head">
        <div className="steps">
          <div className={`step ${step1}`}>
            <span className="num">1</span> 输入 · 干净剧本
          </div>
          <div className={`step ${step2}`}>
            <span className="num">2</span> 估时 · 纯规则
          </div>
          <div className={`step ${step2}`}>
            <span className="num">3</span> 切分 · 场景边界
          </div>
          <div className={`step ${step2}`}>
            <span className="num">4</span> 输出 · 可预览下载
          </div>
        </div>
        <div className="flow-actions">
          <span className="hint zero-cost">0 token · 不调用模型</span>
          {stage === "done" ? (
            <button
              className="btn ghost sm"
              type="button"
              onClick={() => reset({ keepScript: true })}
            >
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

      {stage === "done" ? (
        <div className="howto">
          <div className="howto-title">这一步就三件事</div>
          <ol>
            <li>
              <b>看一眼估时表</b> —— 只有标黄那几场需要你核一下（动作多的武戏/群戏）；
              想改哪一格的秒数，直接点进去改。<b>参数不用动。</b>
            </li>
            <li>
              <b>看一眼集列表</b> —— 边界不满意，点那一场右边的「并入上一集 / 并入下一集」。
              觉得没问题就跳过。
            </li>
            <li>
              <b>下载剧本</b> —— 拉到底，点「下载剧本」。这就是流程二的全部产出。
            </li>
          </ol>
        </div>
      ) : null}

      {/* ---------- 输入 ---------- */}
      <section className={`card ${stage === "input" ? "hi" : ""}`}>
        <div className="card-head">
          <div>
            <div className="card-kicker">步骤 01 · 输入</div>
            <div className="card-title">干净剧本</div>
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

        <p className="hint">
          输入应满足：已切分到场景、每场有标题、文本已规范（流程一「剧本清洗」的产出，或外部同标准剧本）。
          本页<b>只改结构，不改一个字</b>。
        </p>

        {mode === "paste" ? (
          <textarea
            className="script"
            placeholder="在此粘贴干净剧本……角色名（语气）：台词 / △动作 的格式都能识别。"
            value={text}
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
                accept=".txt,.md,.docx"
                hidden
                onChange={(e) => onFile(e.target.files?.[0])}
              />
            </label>
            {fileName ? <div className="hint">已载入：{fileName}</div> : null}
          </div>
        )}

        <div className="row">
          {cleanResult ? (
            <button
              className="btn sm"
              type="button"
              onClick={() =>
                patch({
                  text: cleanResult.text,
                  fileName: cleanResult.fileName,
                  stage: "input",
                  cuts: null,
                  cutMode: "auto",
                  overrides: {},
                  error: "",
                })
              }
            >
              <ArrowLeft size={14} /> 带入「剧本清洗」的结果
            </button>
          ) : null}
          <button
            className="btn ghost sm"
            type="button"
            onClick={() => patch({ text: SPLIT_SAMPLE })}
          >
            <Eye size={14} /> 填入示例剧本
          </button>
          {!text.trim() ? (
            <span className="hint">第一次用？先点左边这个，拿示例跑一遍看看。</span>
          ) : null}
          <div className="spacer" />
          {text ? (
            <span className="hint">
              {text.length} 字｜识别到 {parsed.episodes.length} 集 / {parsed.sceneCount} 场
            </span>
          ) : null}
          <button className="btn primary" type="button" disabled={!text.trim()} onClick={analyze}>
            <Scissors size={15} /> 分析并切分
          </button>
        </div>

        {parsed.warnings.length ? (
          <div className="warn-list">
            {parsed.warnings.map((w) => (
              <div key={w}>
                <WarningCircle size={13} weight="fill" /> {w}
              </div>
            ))}
          </div>
        ) : null}
      </section>

      {stage !== "done" ? null : (
        <>
          {/* ---------- 估时（参数 + 表，同一张卡） ---------- */}
          <section className="card">
            <div className="card-head">
              <div>
                <div className="card-kicker">步骤 02 · 估时</div>
                <div className="card-title">
                  全剧 {scenes.length} 场 ｜ 合计 {mmss(stats.total)}
                </div>
              </div>
              <div className="spacer" />
              <button
                className="btn ghost sm"
                type="button"
                onClick={() => patch({ showKnobs: !showKnobs })}
              >
                <SlidersHorizontal size={14} /> {showKnobs ? "收起参数" : "调参数"}
              </button>
              <button
                className="btn ghost sm"
                type="button"
                onClick={() => patch({ reviewOnly: !reviewOnly })}
              >
                <MagnifyingGlass size={14} />
                {reviewOnly ? `显示全部 ${scenes.length} 场` : `只看动作最重的 ${reviewScenes.length} 场`}
              </button>
              <button className="btn sm" type="button" onClick={exportCsv}>
                <DownloadSimple size={14} /> 导出 CSV
              </button>
              {longScenes.length ? (
                <button className="btn sm" type="button" onClick={splitAll}>
                  <Scissors size={14} /> 给全部 {longScenes.length} 个超长场下刀
                </button>
              ) : null}
            </div>
            <p className="hint">
              估时是<b>纯规则、不调用模型</b>，同一个输入永远得到同一个结果。
              规则在动作多的场（武戏 / 群戏）上会偏低，所以挑出<b>动作最重的前 {reviewScenes.length} 场</b>标黄，
              建议核一眼；其余场不用看。
              <b>任何一格的秒数都可以直接改。参数不用动也能跑。</b>
            </p>
            {longScenes.length ? (
              <p className="hint">
                有 <b>{longScenes.length}</b> 场自己就超过了上限（{options.windowHi} 秒），
                靠挪边界解决不了 —— 用最右边的 <b>✂ 场内下刀</b>，在动作之间切一刀。
              </p>
            ) : null}
            {showKnobs ? (
              <div className="knobs">
                {OPTION_ROWS.map((row) => (
                  <label className="knob" key={row.key}>
                    <span className="knob-label">{row.label}</span>
                    <input
                      type="number"
                      step={row.step}
                      min="0"
                      value={options[row.key]}
                      onChange={(e) => setOption(row.key, Number(e.target.value))}
                    />
                    <span className="knob-unit">{row.unit}</span>
                  </label>
                ))}
                <label className="knob">
                  <span className="knob-label">窗口下限</span>
                  <input
                    type="number"
                    step="5"
                    min="0"
                    value={options.windowLo}
                    onChange={(e) => setOption("windowLo", Number(e.target.value))}
                  />
                  <span className="knob-unit">秒</span>
                </label>
                <label className="knob">
                  <span className="knob-label">窗口上限</span>
                  <input
                    type="number"
                    step="5"
                    min="0"
                    value={options.windowHi}
                    onChange={(e) => setOption("windowHi", Number(e.target.value))}
                  />
                  <span className="knob-unit">秒</span>
                </label>
              </div>
            ) : null}
            <div className="table-wrap est-wrap">
              <table className="table est-table">
                <thead>
                  <tr>
                    <th>场次</th>
                    <th>场景名</th>
                    <th>台词秒</th>
                    <th>动作秒</th>
                    <th>建立秒</th>
                    <th>预估秒</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {shownScenes.map((s) => (
                    <tr
                      key={s.key}
                      className={`${reviewKeys.has(s.key) ? "capped" : ""}${s.parts > 1 ? " split" : ""}`}
                    >
                      <td className="mono">
                        {s.origin}
                        {s.parts > 1 ? (
                          <span className="es-tag">
                            #{s.part}/{s.parts}
                          </span>
                        ) : null}
                      </td>
                      <td>{s.place}</td>
                      <td className="num">{s.dlg}</td>
                      <td className="num">{s.act}</td>
                      <td className="num">{s.est}</td>
                      <td className="num">
                        <input
                          className={`sec-input ${s.overridden ? "on" : ""}`}
                          type="number"
                          min="0"
                          value={s.sec}
                          onChange={(e) => setOverride(s.key, e.target.value)}
                        />
                        {reviewKeys.has(s.key) ? <span className="es-tag warn">建议复核</span> : null}
                      </td>
                      <td className="act">
                        {s.parts > 1 ? (
                          s.part === 1 ? (
                            <>
                              <button
                                className="mini"
                                type="button"
                                title="把切点往前挪一块"
                                onClick={() => nudgeSplit(s.origin, -1)}
                              >
                                ◀
                              </button>
                              <button
                                className="mini"
                                type="button"
                                title="把切点往后挪一块"
                                onClick={() => nudgeSplit(s.origin, 1)}
                              >
                                ▶
                              </button>
                              <button
                                className="mini"
                                type="button"
                                onClick={() => setSplit(s.origin, [])}
                              >
                                撤销
                              </button>
                            </>
                          ) : null
                        ) : s.auto > options.windowHi ? (
                          <button
                            className="mini"
                            type="button"
                            title={`这一场 ${Math.round(s.auto)} 秒，超过上限`}
                            onClick={() => splitOne(s.key)}
                          >
                            <Scissors size={12} /> 场内下刀
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {Object.keys(overrides).length ? (
              <div className="row">
                <span className="hint">已手改 {Object.keys(overrides).length} 个场次。</span>
                <div className="spacer" />
                <button
                  className="btn ghost sm"
                  type="button"
                  onClick={() => patch({ overrides: {}, cuts: null, cutMode: "auto" })}
                >
                  <ArrowsClockwise size={14} /> 清空手改，回到规则值
                </button>
              </div>
            ) : null}
          </section>

          {/* ---------- 切分结果 ---------- */}
          <section className="card hi">
            <div className="card-head">
              <div>
                <div className="card-kicker">步骤 03 · 切分结果</div>
                <div className="card-title">
                  切出 {stats.episodes} 集 ｜ 窗口 {stats.window[0]}–{stats.window[1]} 秒
                </div>
              </div>
              <div className="spacer" />
              <span className="pill">{cutMode === "manual" ? "手动调整过" : "自动切分"}</span>
              <button
                className="btn sm"
                type="button"
                disabled={cutMode === "auto"}
                onClick={() => patch({ cuts: null, cutMode: "auto" })}
              >
                <ArrowsClockwise size={14} /> 回到自动切分
              </button>
            </div>

            <div className="stat-row">
              <div className="stat ok">
                <b>{stats.ok}</b>
                <span>窗口内</span>
              </div>
              <div className="stat over">
                <b>{stats.over}</b>
                <span>超上限</span>
              </div>
              <div className="stat under">
                <b>{stats.under}</b>
                <span>低于下限</span>
              </div>
              <div className="stat">
                <b>{stats.forced}</b>
                <span>单场超长集</span>
              </div>
              <div className="stat waived">
                <b>{stats.waived}</b>
                <span>已接受</span>
              </div>
              <div className="stat">
                <b>{added}</b>
                <span>补回的着装标注</span>
              </div>
            </div>

            <p className="hint">
              落刀点只在<b>场景边界</b>。想把某一场挪到隔壁集，点该场最右侧的按钮；觉得没问题就跳过这一步。
              超长场（一场就超过上限）只能场内再下刀，已单独标出。
            </p>

            <div className="ep-list">
              {eps.map((ep) => (
                <EpisodeCard
                  key={ep.no}
                  ep={ep}
                  opt={options}
                  totalEps={eps.length}
                  onMoveIn={(bi) => move(shiftCutLeft, bi)}
                  onMoveOut={(bi) => move(shiftCutRight, bi)}
                  onToggleWaive={toggleWaive}
                />
              ))}
            </div>
          </section>

          {/* ---------- 输出 ---------- */}
          <section className="card">
            <div className="card-head">
              <div>
                <div className="card-kicker">步骤 04 · 输出</div>
                <div className="card-title">符合流程三入口标准的剧本</div>
              </div>
              <div className="spacer" />
              <button
                className="btn primary sm"
                type="button"
                onClick={() =>
                  downloadFile(`${fileName || "剧本"}-初稿${eps.length}集.md`, output)
                }
              >
                <DownloadSimple size={14} /> 下载剧本
              </button>
            </div>
            <p className="hint">
              集号与场次号已按新分集<b>整体重编</b>；着装标注按新集重算；正文与台词一字未改。
            </p>
            <div className="preview script-preview">
              <pre>{output}</pre>
            </div>
            <div className="cta-row">
              <div>
                <b>流程二到这就结束了。</b>
                <span className="hint">
                  这份剧本已经可以直接喂给下一步「生成分镜」。
                </span>
              </div>
              <div className="spacer" />
              <button
                className="btn"
                type="button"
                onClick={() => {
                  window.location.hash = "#/storyboard";
                }}
              >
                下一步：生成分镜 (待建)
              </button>
            </div>
          </section>
        </>
      )}
    </>
  );
}
