---
name: stage-adaptation-bible
description: "把舞台事实账本收敛成制作圣经：戏剧脊柱、人物弧、舞台规则、演员兼任、母题与改编变更账。用于场景拆分前的整体设计；不写分场或完整对白。"
---

# 舞台改编圣经

把事实变成一部可执行的舞台作品，而不是写剧情摘要。先确认制作条件，再决定哪些事件保留、压缩、合并或重排。

## 输入

```text
项目参数: 目标语言/演出类型/时长/幕数/演员上限/舞台形态/必须保留/禁止改写
事实账本: 全部 S### JSONL
```

事实缺号或有阻断项时停止，不以“先写着看”绕过关口。

## 变更分级

- `T1`：叙述改动作、心理改潜台词、背景改物件或声音。允许，但不得新增关键事实。
- `T2`：压缩、合并人物或场次。必须说明保住了哪项戏剧功能。
- `T3`：调整时序、地点、视角或人物功能。必须有项目授权。
- `T4`：改变事件因果、关系、结局或主题判断。默认禁止。

## 必须输出

```text
# STORY BIBLE vN

## 1. 制作命题
LOG LINE
DRAMATIC QUESTION
THEATRICAL PREMISE
AUDIENCE EXPERIENCE

## 2. 因果脊柱
SPINE_01–SPINE_06，逐项附 SOURCE

## 3. 主角
CHARACTER / WANT / NEED / OBSTACLE / STAKES / TACTICS / ARC / VOICE

## 4. 对手与关系动力
FORCE / POWER / DEPENDENCY / RELATION_TURNS

## 5. 舞台世界
TIME_SPACE_CONTRACT / SCENIC_RULE / TRANSITION_GRAMMAR / VISIBLE_SYSTEM / NARRATION_POLICY

## 6. 人物表与兼任
CASTING / DOUBLING_PLAN / DOUBLING_GUARDS

## 7. 母题与兑现
MOTIF

## 8. 改编变更账
CHANGE LEDGER

## 9. 缺席与风险
OMITTED / OPEN_QUESTIONS
```

## 判定规则

- `THEATRICAL PREMISE` 必须是一条可指导调度的舞台规则，例如“谁触碰柜台上的物件，谁暂时掌握谈话”，不能只写象征意义。
- 主角必须有主动选择。只被动遭遇时，优先改用原文已有的主动行为；仍不足则列入待确认。
- `STAKES` 和未明说的人物心理标“推断：”，不得冒充原文事实。
- 先数有姓名、有台词或承担关键行动的角色。角色数不超过演员上限时，一人一角；不得为了显得紧凑强行兼任。
- 兼任角色不能同场；必须标出换装、道具和出场冲突。
- `TRANSITION_GRAMMAR` 不能写“无”。单场景戏也要规定灯光、声音、物件或表演如何分段。
- `CHANGE LEDGER` 引用原文必须逐字；不得用原文不存在的例子解释改编。
- 输出中不得残留 `<演员>`、`<角色>`、“原文名”等模板占位。

## 自检

只看五件事：

1. 因果脊柱是否能从起点推到结尾，而不是六个事件标题。
2. 主角在结尾是否做出选择，并付出可见代价。
3. 舞台规则能否直接决定演员站位、物件和转场。
4. 每个 T2/T3 是否有来源、理由和保留的戏剧功能。
5. `OPEN_QUESTIONS` 是否只问项目参数没有回答的事项。

不要在这一步写场景卡、完整台词或整场剧本。
