# 当前任务：制定分幕场景卡

把故事圣经和事实账本转成可逐场写作的施工图。你只规划戏剧事件、人物行动、空间和兼任风险，不写完整对白。

## 输入

```text
[PROJECT]
...

[STORY BIBLE]
...

[FACTS]
...

[CURRENT ACT]
ACT: 全部 / 第1幕 / 第2幕
```

一次规划不超过 8 场。全剧超过 16 场时，按幕或按叙事段拆成多次调用。后一次调用要附带上一段最后两场的 `CHANGE` 和结束状态。

## 输出格式

```text
# SCENE PLAN <ADAPTATION_VERSION> / <CURRENT ACT>

## ACT CONTRACT
ACT_1_QUESTION: <这一幕结束时观众最想知道什么>
ACT_1_END_CHANGE: <不可逆变化>
ACT_2_QUESTION: ...
ACT_2_END_CHANGE: ...

## SCENE CARDS

### S01
ACT: 1
SOURCE: S###–S###
TITLE: <不超过 12 字>
WHEN: <可被观众判断的时间>
WHERE: <具体舞台空间>
CAST: C01, C03
ON_STAGE_OPEN: <开场时谁已经在场、正在做什么>
OFF_STAGE: <观众需要知道但看不见的即时情况>
EVENT: <本场唯一主事件，用“谁对谁做什么，导致什么变化”>
OBJECTIVE: <每个主要角色本场想要什么>
OBSTACLE: <谁或什么阻止>
TACTICS: <角色采取的具体策略，按顺序>
TURN: <具体触发点>
CHANGE: <结束时哪一项发生了变化>
ENTER_EXIT: <谁何时进出；无则写“无”>
PROPS: <可追踪道具及其去向；无则写“无”>
SOUND_LIGHT: <只写承担叙事的提示；无则写“无”>
DOUBLING_RISK: <兼任/换装/同场冲突；无则写“无”>
EST_MINUTES: <范围，例如 4–6>
RISK: <最容易写坏的地方>

### S02
...

## ACT CLOSE
LAST_SCENE: S##
NEXT_ACT_ENTRY_STATE: <人物、道具、空间状态>
UNRESOLVED: <需人工确认的问题；无则写“无”>
```

## 场景规则

- 先按 `TARGET_MINUTES` 做时长预算。目标不超过 15 分钟时，规划 3–5 场，每场 2–4 分钟；全剧 `EST_MINUTES` 中值合计必须在目标时长 ±15% 内。
- `ACT_*_END_CHANGE` 必须是结束时已经发生的变化，不能写成“是否同意/是否离开”的开放问题。
- `EVENT` 必须是舞台上可见或可听见的事情，不是“两人关系变复杂”。
- `CHANGE` 只能写具体变化，例如“她把钥匙交出”“他承认证词是假的”“权力从母亲转到儿子”。不能只写“发生分歧”“未解决”“关系未改变”。
- 如果 `CHANGE` 为空，合并、删除或重写该场，不得用对白气氛补齐。
- 相邻场景不能只是换地点重复同一争执。若保留重复，后一场必须提高代价、改变策略或揭示新事实。
- 每场最多一个主转折；次要节拍可列在 `TACTICS`，不要产生两个互相抢重心的高潮。
- `OBSTACLE` 必须是人、制度或当前行动条件，不能写“信息未知”“回忆未被提及”这类不是舞台阻力的内容。
- 只安排必要进出。角色不能为了说一句信息突然出现，也不能说完就消失。只要 `EVENT` 中有进场、离场或跨过门界，`ENTER_EXIT` 就不能写“无”。
- `OFF_STAGE` 只写场外正在发生且会影响场内的事；已经发生在台上的人物动作不得写进 `OFF_STAGE`。
- `PROPS` 必须记录累计状态和最终去向。关键道具只能在第一次出现时写“首次出现”；后续场次写当前所在位置、在谁手中或是否被带走。
- 同一演员兼任的角色不能同场；换装时间不足时标为 `DOUBLING_RISK`。
- `EST_MINUTES` 是规划值，不与字数机械对应；全剧合计应落在目标时长 ±15% 内。
- 每张卡都必须有以下 20 个字段，一个也不能省略：`ACT / SOURCE / TITLE / WHEN / WHERE / CAST / ON_STAGE_OPEN / OFF_STAGE / EVENT / OBJECTIVE / OBSTACLE / TACTICS / TURN / CHANGE / ENTER_EXIT / PROPS / SOUND_LIGHT / DOUBLING_RISK / EST_MINUTES / RISK`。
- 不要在场景卡里写摄影术语、主题总结、导演训话或完整对白。
