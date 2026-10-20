# AI 短剧剧本清洗机

剧情短剧从「原生态剧本」到「分镜头剧本」的三段式流水线。每个流程只做一件事，每一步都要人看一眼再往下走。

| 流程 | 页面 | 做什么 | 引擎 |
| --- | --- | --- | --- |
| 一 · 剧本清洗 | `#/clean` | 整理格式 → 确认清单 → 修改逻辑（含中译英） | 调模型 |
| 二 · 集数拆分与重组 | `#/episode` | 按 75–105 秒重新切集，只改结构不改字 | 纯规则，零模型 |
| 三 · 生成分镜 | `#/storyboard` | 按 Seedance 规范编译分镜头剧本，分批输出 | 纯规则 + 模型按批生成 |

三个流程之间用 `src/handoff.js` 一键交接，不需要下载再粘贴。各流程状态分别存在 `pd-clean-script-v1` / `pd-split-v1` / `pd-storyboard-v1`，切换页面不丢进度。

## 本地运行

```bash
npm run dev        # http://localhost:4190
npm run test:unit  # 纯逻辑断言
npm run test:sites # Sites 打包契约
npm run build
```

真实模型走 `server/dev-api.mjs` 的本地代理，Key 放在 `.env`（已 gitignore，不会提交、也不下发到浏览器）。

## 目录

- `src/CleanFlow.jsx` / `SplitFlow.jsx` / `StoryboardFlow.jsx` —— 三个流程的界面与状态
- `src/storyboard.js` —— 流程三引擎（解析 / 校验 / L1 编译 / 分批，零模型）
- `src/split.js`、`src/checklist.js`、`src/validate.js` —— 流程二的估时与校验
- `src/prompts/` —— 默认提示词；用户可在页面上查看并替换
- `server/`、`worker/` —— 本地代理与 Sites 部署入口
- `tests/` —— 98 条单元测试 + 4 条打包契约
- `runs/` —— 每次模型调用的完整输入输出落盘（回归样本，不进 git）

## 历史

旧的十步版（Supabase + step1…step10）已封存在 `legacy/10step` 分支，只作参考，不再维护：

```bash
git checkout legacy/10step   # 看一眼
git checkout main            # 回来
```
