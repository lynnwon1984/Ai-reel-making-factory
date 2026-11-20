/**
 * 流程之间的交接。
 *
 * 流程一产出「标准化剧本」，流程二需要「干净剧本」。
 * 过去要用户自己下载再粘贴一遍，这里把两个流程的存储打通，直接搬过去。
 */

export const CLEAN_KEY = "pd-clean-script-v1";
export const SPLIT_KEY = "pd-split-v1";
export const STORYBOARD_KEY = "pd-storyboard-v1";

export function readStore(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null");
  } catch (err) {
    return null;
  }
}

export function writeStore(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    /* 存储失败不影响使用 */
  }
}

/** 流程一 → 流程二：把标准化剧本塞进流程二的输入。 */
export function handOffToSplit({ text, fileName }) {
  const prev = readStore(SPLIT_KEY) ?? {};
  writeStore(SPLIT_KEY, {
    ...prev,
    stage: "done",
    mode: "paste",
    text,
    fileName: (fileName || "标准化剧本").replace(/\.[^.]+$/, ""),
    splits: {},
    cuts: null,
    cutMode: "auto",
    autoSplitVersion: 0,
    overrides: {},
    error: "",
  });
}

/** 流程一当前是否已有可交接的结果（优先标准化剧本，其次整理后的剧本）。 */
export function readCleanResult() {
  const s = readStore(CLEAN_KEY);
  if (!s) return null;
  const text = (s.final || s.organized || "").trim();
  if (!text) return null;
  return { text, fileName: s.fileName || "标准化剧本" };
}

/** 流程二 → 流程三：把当前确认版的完整分集稿塞进生成分镜输入。 */
export function handOffToStoryboard({ text, fileName }) {
  const prev = readStore(STORYBOARD_KEY) ?? {};
  writeStore(STORYBOARD_KEY, {
    ...prev,
    stage: "input",
    mode: "paste",
    text,
    fileName: (fileName || "分集剧本").replace(/\.[^.]+$/, ""),
    batches: [],
    cursor: 0,
    pausedAt: 0,
    pauseReason: "",
    error: "",
  });
}
