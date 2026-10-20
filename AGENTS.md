# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## 验收：每做完一个流程就跑一遍

清单在 `验收清单.md`。**不要攒到最后一起验收** —— 设计层面的问题拖到最后，返工要覆盖整条链路。

```
npm run test:unit     # 两个流程的纯逻辑断言
npm run test:sites    # Sites 打包契约
npm run build         # 能构建
```

然后人工过一遍 `验收清单.md` 的 **B2「新手视角」**。那一节是自动化不了的，也是唯一抓到过真问题的一节：流程二曾经功能全对、测试全绿，但用户看完说"好像不太会用"。

新增引擎逻辑时要往对应的 `tests/*.test.mjs` 里补断言。这套测试**做过变异测试**：故意丢掉每场第一行正文，「一字未改」那条立刻失败。

## 模型输出要落盘

`server/dev-api.mjs` 的 `writeArtifact()` 会把**每次调用的完整输入 + 完整输出 + 模型名 + 推理档位**写进 `runs/artifacts/*.json`，索引记在 `runs/runs.jsonl`。

这不是留档，是**攒回归样本** —— 模型不是常量，它会自己漂；没有原始输出，你没法知道它什么时候变的。
要加回归样本，从 `runs/artifacts/` 挑一份复制到 `tests/fixtures/` 并改成有意义的名字。

**凡是"模型给的原始文本"，都要先落盘再解析。** 解析规则改了、模型漂了，都能拿同一份原始文本重放对照。没有原始文本，一切都只能靠记忆。

## 流程约定（长期有效）

### 页面与路由

- 侧边栏三项对应 `#/clean`、`#/episode`、`#/storyboard`；`App.jsx` 按 hash 切换，每个流程自己的状态存在自己的 localStorage key 下。
- 流程一 = `CleanFlow.jsx`（key `pd-clean-script-v1`）；流程二 = `SplitFlow.jsx`（key `pd-split-v1`）。
- 流程三 = `StoryboardFlow.jsx`（key `pd-storyboard-v1`）；引擎在 `src/storyboard.js`（解析 / 校验 / L1 编译 / 分批，**零模型**）。

### 流程三「生成分镜」的硬规则（见《Seedance编译规范-v0.7》）

1. **生成单位 = Clip**，Clip 时长 **4–15 秒**（Seedance 2.0 下限 4 秒）。
2. **单 shot ≤ 3 个 Clip** —— 15 秒上限 ÷ 4 秒下限推导而来。
3. **角色标签 = `编号-中文短名`**（`C01-艾略特`）；剧本没编号就按全剧首次出场顺序补。
4. **妆造按场标注**：同场首次带妆造、同场后续可省、换场重标。
5. **L1 只输出标签占位** `<C01-艾略特·旅行者装>`：不写秒数、不写 `@图片N`。
6. 素材映射与人物甄别纠错**不在本流水线范围**（制作工具 + 一线同事负责）。
- **流程之间必须能一键交接**，不要让用户下载再粘贴。共用 `src/handoff.js`：流程一出结果给 `handOffToSplit()`，流程二用 `readCleanResult()` 判断有没有可带入的结果。

### 页面可读性（用户反馈过"不会用"）

- **顶部步骤数必须与下方卡片数一一对应**。曾经顶部 4 步、下面 5 张卡，用户直接卡住。
- **每个流程点完主按钮之后，要有一句话告诉他现在该干什么**。流程二是顶部的「这一步就三件事」引导条。
- **可选的东西要看起来可选**：默认收起，按钮文案写明「不用动也能跑」。
- **流程结尾必须有出口**，指向下一步。

### 流程二「集数拆分与重组」的硬规则（来自设计文档 v0.3.1 §5）

1. **只改结构，不改一个字** —— 场内的正文与台词原样搬运，只重新分组与重新编号。
2. **零模型调用** —— 估时是纯规则。实测模型估时同一个提示词跑两次差 32%，不可重复。
3. **落刀点只在场景边界** —— 原集边界不能用（可能切在连续动作或长对话中间）。
4. **超长场开例外口** —— 单场就超过窗口上限时保留原场，但标为强制切点。
5. 集号、场次号 `X-Y`、着装标注（同集首次 / 跨集重标）都要按**新分集**重算。

### 两条工程经验（踩过）

1. 手动调整这类「基于当前状态再算一次」的操作，必须用**函数式** `setState(s => ...)`，否则连点两次会用旧的 `cuts` 互相覆盖。
2. 持久化挂在**统一的状态写入函数**上（流程二是 `patch`）。漏一处就等于整个流程不持久 —— 曾经 `analyze()` 用了一个不落盘的写入函数，刷新后进度全丢。

### 与模型相关的约定

- 估时、分块这类需要"重复可复现"的环节走纯规则；只有生成类环节才调模型。
- 调模型时把**提示词 + 全局设定**固定为调用前缀，以命中上下文缓存（实测复跑可省约 79% 输出 token）。
- 推理档位默认 `low`；`high` 在枚举核算类任务上会把输出预算烧光、返回空。
