import { useState } from "react";
import { ArrowsClockwise, Code, CopySimple } from "@phosphor-icons/react";

/**
 * 提示词槽位：默认提示词可读、可复制，也可填入后改成自定义。
 * 留空 = 用默认；有内容 = 用自定义。
 */
export function PromptSlot({ defaultText, value, onChange, label = "提示词" }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("default");
  const [copied, setCopied] = useState(false);
  const usingCustom = value.trim().length > 0;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(defaultText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch (err) {
      /* 剪贴板不可用时忽略 */
    }
  };

  return (
    <div className="prompt-block">
      <div className="prompt-bar">
        <span className="prompt-ico">
          <Code size={15} />
        </span>
        <span className="prompt-label">{label}</span>
        <span className={`pill ${usingCustom ? "custom" : ""}`}>
          {usingCustom ? "使用自定义" : "使用默认"}
        </span>
        <div className="spacer" />
        <button className="btn ghost sm" type="button" onClick={() => setOpen((v) => !v)}>
          {open ? "收起" : "查看 / 替换"}
        </button>
      </div>

      {open ? (
        <div className="prompt-panel">
          <div className="tabs">
            <button
              type="button"
              className={`tab ${tab === "default" ? "active" : ""}`}
              onClick={() => setTab("default")}
            >
              默认提示词
            </button>
            <button
              type="button"
              className={`tab ${tab === "custom" ? "active" : ""}`}
              onClick={() => setTab("custom")}
            >
              自定义提示词{usingCustom ? " · 已填" : ""}
            </button>
          </div>

          {tab === "default" ? (
            <>
              <div className="prompt-doc">{defaultText}</div>
              <div className="row">
                <span className="hint">内置默认提示词，只读。</span>
                <div className="spacer" />
                <button className="btn sm" type="button" onClick={copy}>
                  <CopySimple size={14} /> {copied ? "已复制" : "复制"}
                </button>
                <button
                  className="btn sm"
                  type="button"
                  onClick={() => {
                    onChange(defaultText);
                    setTab("custom");
                  }}
                >
                  填入自定义（可改）
                </button>
              </div>
            </>
          ) : (
            <>
              <textarea
                className="script prompt-input"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder="留空 → 使用默认提示词；粘贴你自己的提示词 → 覆盖默认。"
              />
              <div className="row">
                <span className="hint">
                  {usingCustom
                    ? `已自定义（${value.trim().length} 字），本步将使用你的提示词。`
                    : "当前为空，本步使用默认提示词。"}
                </span>
                <div className="spacer" />
                <button
                  className="btn ghost sm"
                  type="button"
                  disabled={!usingCustom}
                  onClick={() => onChange("")}
                >
                  <ArrowsClockwise size={14} /> 清空，改回默认
                </button>
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
