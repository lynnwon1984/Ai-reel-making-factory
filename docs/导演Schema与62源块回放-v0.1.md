# 导演版 Schema 与 62 源块回放 v0.1

日期：2026-11-05

## 结论先行

导演字段本身可以稳定产出。

- 真实模型回放：19 个 shot，导演字段完整率 100%。
- 最终结构校验：0 高问题、0 中问题。
- 台词、人物、道具和空镜内容质检：0 问题。
- 同一份落盘原始输出离线重放：结果、token、累计模型耗时完全一致。

但这次还没有解决两件事：

1. **时长膨胀**：流程二估时 88 秒，分镜计划变成 147 秒，为估时的 1.67 倍。
2. **成本上升**：总 token 从旧分块实验的约 77,459 涨到 116,651，增加约 50.6%。

因此当前判断是：

> 导演版 Schema 可以进入下一轮试验，但还不能直接替换正式流程。

## 实现内容

### 1. Schema v2

旧版计划不带 `schemaVersion`，继续按原规则校验。

正式契约文件：

- `src/schemas/scene-plan-v2.schema.json`
- `src/schemas/director-brief-v1.schema.json`

新版计划显式输出：

```json
{
  "schemaVersion": 2,
  "sceneId": "1-1",
  "shots": []
}
```

每个 shot 在原有字段上增加：

- `purpose`：本镜唯一戏剧职责。
- `storyFunction`：故事功能枚举。
- `startState`：本镜起点状态。
- `stateChange`：本镜主要状态变化。
- `endState`：本镜终点状态。
- `cameraReason`：运镜为什么发生，或为什么固定。
- `continuityNote`：从上一镜继承什么，向下一镜交付什么。

`startState` 取代新计划里的 `startPosition`；编译器对旧计划仍兼容 `startPosition`。

允许的 `storyFunction`：

```text
establish / power / pressure / detail / reaction
/ shift / impact / aftermath / exit
```

### 2. 整场导演提示单

新增 `src/prompts/director-brief.md`。

字段：

- `dramaticQuestion`
- `desire`
- `obstacle`
- `powerBefore`
- `powerAfter`
- `informationReveal`
- `visualCore`
- `keyProp`
- `startHook`
- `endHook`

另带场景地理：

- `anchors`
- `powerPosition`
- `axis`
- `workingSide`

只有输入同时带有导演提示单和场景地理时，镜头规划提示词才启用 Schema v2。旧调用继续输出 Schema v1，避免破坏现有流程。

### 3. 本地确定性校验

新增：

- `validateDirectorBrief()`：检查提示单和场景地理字段完整性。
- `analyzeDirectorFields()`：统计镜头字段完整率、合法故事功能数和导演上下文状态。
- `validateScenePlan()`：Schema v2 下拦截缺职责、缺运镜理由、缺起止状态和非法 `storyFunction`。
- `mergeScenePlans()`：分块合并时保留导演提示单和场景地理。
- `compileScenePlan()`：优先使用 `startState`。

### 4. 独立回放器

命令：

```bash
SCENE_PLAN_ENDPOINT=http://127.0.0.1:4177/api/chat \
SCENE_PLAN_CONCURRENCY=2 \
npm run plan:director -- tests/fixtures/final-script.txt 1-1 flexible6
```

离线重放：

```bash
DIRECTOR_PILOT_REPLAY=runs/director-pilot/<run-id> \
npm run plan:director -- tests/fixtures/final-script.txt 1-1 flexible6
```

产物：

```text
runs/director-pilot/<run-id>/
├── trace.json       完整输入、原始输出、每次尝试、usage
├── plan.json        修复后的结构化镜头计划
├── storyboard.md    编译后的正文分镜稿
└── report.json      字段完整率、时长、质检、裁决和成本
```

## 真实样本结果

样本：

```text
tests/fixtures/final-script.txt
第1集 1-1 Village 外 未注明
62 个源块
流程二估时 88 秒
```

参数：

```text
模型：deepseek-flash
推理档位：low
规则：flexible6
分块预算：约 20 秒 / 段
并发：2
共 6 个规划段
```

第一次真实运行：

```text
runs/director-pilot/2026-11-05T08-04-39-682Z/
```

离线重放：

```text
runs/director-pilot/2026-11-05T08-09-23-220Z-replay/
```

## 结果

| 指标 | 结果 |
| --- | ---: |
| 源块覆盖 | 62 / 62 |
| 规划分块 | 6 |
| shot | 19 |
| Clip | 45 |
| 导演字段完整 shot | 19 / 19 |
| 字段完整率 | 100% |
| 合法 `storyFunction` | 19 / 19 |
| 最终结构高问题 | 0 |
| 最终结构中问题 | 0 |
| 台词 / 内容质检问题 | 0 |
| 分镜总时长 | 147 秒 |
| 时长 / 流程二估时 | 1.67× |

导演提示单样例：

```text
戏剧问题：黑龙袭击村庄时，村民能否活下来，谁有能力阻止黑龙。
开场权力：黑龙占据空中与火焰压制位，村民奔逃。
结尾权力：亚瑟击退黑龙后飞走，大魔导师留不住他，选择权转到亚瑟手中。
视觉核心：火与雪中的村庄广场上，亚瑟拿着咬过的苹果面对黑龙。
关键道具：咬过的苹果，先被吃、再被展示，最后掷出击中龙眼。
```

这说明模型能把“欲望、阻碍、权力变化、信息揭示、视觉核心和关键道具”稳定写成结构化数据，而不是只写气氛词。

## 第一次草稿的问题

6 个分块中有 4 个触发过一轮定点修复。

最终仍有 1 个分块留下一个短 shot 高问题；合并后由本地确定性修复从 4 秒补到 5 秒。

这轮本地修复共记录 49 处调整，主要是：

- Clip 低于规则下限时补足。
- shot 时长与 Clip 加总重新对齐。
- 从源块补回漏登记人物。
- 单个短 shot 补足到 5 秒。

导演字段没有在修复中丢失，修复前后都是 100%。

## 成本

| 指标 | 旧分块实验 v0.2 | 本次导演版 v0.1 | 变化 |
| --- | ---: | ---: | ---: |
| shot | 16 | 19 | +3 |
| Clip | 46 | 45 | -1 |
| 总时长 | 145 秒 | 147 秒 | +2 秒 |
| 总 token | 77,459 | 116,651 | +50.6% |
| 累计模型耗时 | 约 318 秒 | 412 秒 | 约 +29.7% |

本次 token 拆分：

- 输入：43,512
- 输出：73,139
- 其中思考：57,387
- 总 token：116,651
- 缓存命中：13,056

耗时是累计模型调用时间，不是并发后的墙钟时间。

## 时长裁决

147 秒不能在 75–105 秒窗口里装成一集。按完整 shot 边界裁决后：

| 提案集 | 时长 | shot 数 | 状态 |
| --- | ---: | ---: | --- |
| 第1集 | 78 秒 | 9 | 合格 |
| 第2集 | 69 秒 | 10 | 偏短，需要合并或人工接受 |

没有拆 shot、删源块或压台词。这个结果再次证明：

> 导演字段增加了判断质量，但没有自动解决“故事估时 → 分镜内容预算”的换算问题。

## 离线重放一致性

使用同一份 `trace.json` 重放后：

- shot：19 → 19
- Clip：45 → 45
- 总时长：147 → 147
- 字段完整率：100% → 100%
- 结构高问题：0 → 0
- 总 token：116,651 → 116,651
- 累计模型耗时：412,429ms → 412,429ms

说明当前解析、修复、编译和统计链路可重复；模型本身的变化则被原始输出固定住了。

## 回归样本

新增：

- `tests/fixtures/director-pilot-1-1-brief.raw.json`
- `tests/fixtures/director-pilot-1-1-chunk1.raw.json`

测试覆盖：

- 真实导演提示单字段完整。
- 真实 Schema v2 分块可解析。
- 21 源块真实分块字段完整率 100%。
- 旧 Schema v1 样本继续通过。
- 缺职责、运镜理由、起止状态和非法故事功能会被拦下。
- 分块合并保留导演上下文。

## 当前判断

可以继续吸收：

- 导演提示单。
- 镜头职责与故事功能。
- 起点、状态变化、终点。
- 运镜理由。
- 跨镜连续性说明。
- 9:16 场景锚点和观察侧。

还不能宣布完成：

- 语义连续性仍主要是模型填写 + 人工审阅，没有做到逐字段自动比对。
- `powerBefore` 和 `powerAfter` 是否真的成立，需要导演或编剧判断。
- 147 秒对 88 秒估时的膨胀需要单独标定。
- 116,651 token 还不能进入正式产品。
- 短集出口仍未在页面体现。

## 下一步建议

1. 对这次 19 个 shot 做人工抽样审查，重点看：
   - 职责是否有重复；
   - 是否有镜头只是复述原文；
   - 运镜理由是否真的服务变化；
   - 下一镜起点是否能接上一镜终点。
2. 增加“语义连续性审查”提示词，只审前后状态，不重写镜头。
3. 用这次 trace 建立“源块量 / 台词量 / 动作量 → 分镜时长”的校准样本。
4. 在解决时长和成本前，不把 Schema v2 接进流程三正式页面。
