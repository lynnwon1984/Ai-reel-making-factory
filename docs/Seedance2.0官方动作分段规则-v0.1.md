# Seedance 2.0 官方动作分段规则 v0.1

日期：2026-11-05

## 结论

“分镜内容拥挤”成立，但“把时长拉满 15 秒”不是 Seedance 2.0 官方建议。

官方要求的是：

1. 先按时间和事件顺序写 `Shot 1 / Shot 2 / Shot 3`。
2. 不强行限制每段秒数，让模型按剧情自然生成节奏。
3. 复杂快速动作、追逐、打斗和转折点，使用分段生成后再剪辑。
4. 单镜头只指定一种主要运镜。
5. 动作优先缓慢、连续、可看懂；写清身体部位、幅度、速度和力度。

因此，本项目的规则改为：

```text
先判断动作阶段
→ 出现独立阶段或剧情转折
→ 优先拆 shot
→ 每个 Clip 只承担一个连续动作阶段
→ 时长由动作、对白和反应决定
→ 不把 15 秒上限当成填写目标
```

## 官方依据

主文档：

https://ai.byteplus.com/ark/region:ap-southeast-1/docs/seedance-2-0-prompt-guide

Markdown 版本：

https://ai.byteplus.com/ark/region:ap-southeast-1/docs/seedance-2-0-prompt-guide.md

### 1. Shot sequencing

官方原文：

> Do not impose strict limits on the duration of each segment; prioritize allowing the model to naturally generate the pacing based on the plot.

> The model's support for precise timing (such as 0–3 seconds) is unstable, and forcibly limiting duration may lead to abnormal generation results.

对应本项目：

- `duration` 只作为生产任务参数。
- 不把秒级时间片写入提示词正文。
- 不设“尽量接近 15 秒”的目标。

### 2. 动作描述

官方原文：

> Prioritize slow, gentle, coherent subtle movements, and try to avoid high-burst, large-dynamic actions such as sprinting, big jumps, and violent rolls.

对应本项目：

- 写清身体部位、对象、位移、接触和结果。
- 不用“快速完成多个动作”掩盖动作过载。
- 动作阶段放不下时，先拆镜，再考虑时长。

### 3. 运镜

官方原文：

> Try to specify only 1 type of camera movement in a single shot.

对应本项目：

- 每个 Clip 只有一种主要运镜。
- “推近后横移”“下摇后固定”等复合运镜列入中间问题，需要人工确认。

### 4. 分段还是连续

官方原文：

> Continuous long take: suitable for dialogue scenes within a single scene, such as long conversations, emotional progression, and movement along a single path.

> Scene / action turning points: suitable for plot turns or complex, fast-paced action scenes, such as chases, fights, and montages.

对应本项目：

- 对白、情绪推进、单一路径移动：允许连续。
- 复杂动作、多人同时动作、连续位移、特效爆发：优先分段。
- 剧情或动作转折：在新阶段开始处拆 shot。

## 已实现

### 提示词

`src/prompts/scene-plan.md` 新增《官方动作分段规则》：

- 一个 shot 一个主要状态变化。
- 出现新动作目标、权力变化、威胁进入、救援到来、失败转反击时拆 shot。
- 一个 Clip 只承担一个连续动作阶段。
- 单个 Clip 只有一种主要运镜。
- 不写精确秒点，不把 15 秒当目标。

### 本地动作审计

`src/scene-engine.js` 新增 `auditShotActionDensity()`：

- 统计 Clip 数、平均 Clip 时长、状态分句、动作提示和转折提示。
- 抓“多个 Clip 挤在很短 shot 内”的阶段过载。
- 抓“一个 Clip 里包含多个动作阶段”的 Clip 过载。
- 抓复合运镜。
- 不把“动作多”直接翻译成“应为 15 秒”，而是要求拆 Clip 或拆 shot。

### 动作微单元 Schema v3

新增 `src/action-units.js`，把每条动作原文按中文标点拆成可追溯微单元：

```text
B16   △大魔导师的魔法盾被打破，他被冲击力击倒在地上，吐血，痛苦地喊道。
  ↓
B16.1 大魔导师的魔法盾被打破
B16.2 他被冲击力击倒在地上
B16.3 吐血
B16.4 痛苦地喊道
```

约束：

- 微单元只建立索引，不改原文；
- 所有微单元的 `source` 拼回去必须与原文逐字一致；
- `sourceBlockIds` 只引用台词或非动作块；
- `actionUnitIds` 引用具体动作微单元；
- 每个动作微单元在整场中只能引用一次；
- 一个 Clip 可以引用多个连续微单元，但不能跨动作阶段。

新增 Schema：

- `src/schemas/scene-plan-v3.schema.json`

真实模型单分块验证：

```text
分块：首个约 20 秒规划段
源块：11
schemaVersion：3
shot：5
导演字段完整率：100%
动作阶段问题：0
单 Clip 动作过载：0
复合运镜：0
token：17,282
```

该分块仍发现 1 个 Clip 的内容预算约 2.8 秒，但时长只有 2 秒。它说明动作阶段问题已受控，下一步应处理时长预算，而不是继续加动作拆分规则。

动作微单元还暴露了旧预算的偏差：

```text
旧动作预算：62 源块 ≈ 88 秒
按动作微单元重算：62 源块 ≈ 139 秒
20 秒规划段：6 段 → 8 段
```

这说明以前的 `0.8 秒 / 动作源块` 严重低估了一条动作行内部的真实动作量。

### 回归样本

- `tests/fixtures/director-pilot-1-1-chunk1.raw.json`
- `tests/fixtures/director-official-rules-chunk1.raw.json`
- `tests/fixtures/director-action-units-chunk1.raw.json`

对照结果：

| 指标 | 旧规则 | 官方动作分段规则 |
| --- | ---: | ---: |
| 第一规划段 shot 数 | 4 | 6 |
| 单 Clip 动作过载 | 2 | 0 |
| 剩余整镜阶段问题 | 2 | 2 |

说明：

- 04 类型的问题已从“一个 4 秒 Clip 塞入多个动作阶段”拆成两个 shot。
- 但整个规划段仍有两条 shot 属于多阶段连续动作，需要继续拆或由人工接受。
- 这不是规则失效，而是说明一次修复不能保证全部通过。

## 完整样本结果

按官方动作阶段规则重跑 62 源块：

```text
runs/director-pilot/2026-11-05T08-50-24-947Z/
```

结果：

| 指标 | 结果 |
| --- | ---: |
| shot | 23 |
| Clip | 44 |
| 总时长 | 160 秒 |
| 导演字段完整率 | 100% |
| 模型总 token | 149,601 |
| 累计模型耗时 | 约 546 秒 |

与上一轮的 19 shot / 45 Clip / 147 秒 / 116,651 token 相比：

- 动作阶段拆得更细。
- shot 增加 4 个。
- 总时长增加 13 秒。
- token 增加约 28.2%。

这是当前必须正视的成本代价：

> 按官方规则提高动作可读性，会增加分镜数量和生成成本。

## 当前判断

真正的通病不是“没用满 15 秒”，而是：

1. 一个 Clip 承担多个动作阶段。
2. 一个 shot 承担多个状态变化。
3. 复杂动作仍在单个生产任务里硬压缩。
4. 本地时长预算低估单个源块里的连续动作数量。

下一步应继续做：

1. 二次定点修复：首次修复后仍有多阶段问题时，只把问题 shot 返回模型。
2. 进入“故事估时 → 分镜时长”标定：动作微单元已提供了可测量的动作密度。
3. 保持“时长由内容决定”，不设填满 15 秒的固定目标。
