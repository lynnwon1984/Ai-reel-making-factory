---
name: stage-scene-plan
description: "把舞台改编圣经拆成可写作、可演、可验收的分幕场景卡，控制时长、事件、道具、进出场与演员兼任。用于逐场写作前的施工图；不写完整对白。"
---

# 舞台场景施工图

把整部戏装进可执行的场次。一次最多规划 8 场；长剧按幕或叙事段分批，并在下一批开头附上一段最后两场的结束状态。

## 输入

```text
项目参数
已批准的故事圣经
全部事实账本
当前规划范围: 全剧 / 第X幕 / Sxx–Sxx
```

## 输出

```text
# SCENE PLAN vN / 范围

## ACT CONTRACT
ACT_N_QUESTION
ACT_N_END_CHANGE

## SCENE CARDS

### S01
ACT
SOURCE
TITLE
WHEN
WHERE
CAST
ON_STAGE_OPEN
OFF_STAGE
EVENT
OBJECTIVE
OBSTACLE
TACTICS
TURN
CHANGE
ENTER_EXIT
PROPS
SOUND_LIGHT
DOUBLING_RISK
EST_MINUTES
RISK

## ACT CLOSE
LAST_SCENE
NEXT_ACT_ENTRY_STATE
UNRESOLVED
```

每张卡必须包含上面 20 个字段，一个也不能省略。

## 规划规则

- `EVENT` 是舞台上可见或可听的主事件，不是“关系变复杂”。
- 每场只有一个主转折；场末必须具体改变关系、权力、知识、危险、承诺、决定或行动方向。
- `CHANGE` 不写“发生分歧”“未解决”“关系未改变”。
- `ACT_N_END_CHANGE` 必须是已经发生的变化，不能写成“是否同意”。
- `OBSTACLE` 必须是人、制度或当前行动条件，不能写“信息未知”。
- 相邻场景不能只更换地点重复同一争执；若要重复，后一场必须提高代价或改变策略。
- `ENTER_EXIT` 与 `ON_STAGE_OPEN`、`EVENT` 保持一致。角色进屋、离开或跨过门界时不能写“无”。
- `OFF_STAGE` 只写场外影响场内的事，不写台上人物正在做的动作。
- `PROPS` 记录累计状态。每件关键道具只在第一次出现时写“首次出现”，之后写它在谁手中、在哪里或被谁带走。
- `SOUND_LIGHT` 只写承担叙事和分段责任的提示，不作装饰。
- `DOUBLING_RISK` 必须检查同场兼任和换装时间。
- `RISK` 写本场最容易被写坏的具体点。

## 时长预算

- 全剧估时中值合计应在目标时长 ±15% 内。
- 目标不超过 15 分钟时，通常规划 3–5 场；不要为了整齐拆出大量 30 秒过场。
- 一个场次若只有单一动作和一两句信息，通常不足以支撑 2 分钟，应与相邻连续冲突合并。

## 规划自检

1. 每一场都有可见主事件。
2. 每一场结束时状态真的变了。
3. 关键道具没有重复“首次出现”。
4. 角色没有凭空出现、消失或同场兼任。
5. 场次中值总时长落在目标 ±15%。
6. 下一场只承接本场结束状态，不重复本场事件。

不要在场景卡中写完整对白、镜头术语或导演训话。
