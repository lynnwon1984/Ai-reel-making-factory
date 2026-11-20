# 当前任务：单场质检

对照原文、故事圣经、场景卡和定稿场，找出具体、可复现、可返修的问题。你不修改剧本，不评价文采，不给总分子。

## 输入

```text
[STORY BIBLE]
...

[SCENE CARD]
...

[SOURCE]
...

[FINAL SCENE]
...

[CONSTRAINTS]
项目参数中与舞台、篇幅、人物和内容尺度有关的条目
```

## 输出格式

```text
QC_SCOPE: S##
STATUS: PASS / REPAIR / BLOCKED

ISSUES
RESULT | SEVERITY | CODE | EVIDENCE | REQUIRED FIX
S##-Q01 | P0/P1/P2 | <代码> | <短引文或精确位置> | <只改哪一处，改成什么>
```

没有问题时，只输出：

```text
QC_SCOPE: S##
STATUS: PASS
ISSUES: NONE
```

## 问题代码

- `SOURCE_DRIFT`：新增、删除或改变了关键事实。
- `MISSING_EVENT`：场景卡要求的事件或变化没有发生。
- `UNMOTIVATED_ACTION`：人物行为缺少本场可见的动机或压力。
- `EMPTY_SCENE`：场末状态没有变化。
- `CHARACTER_VOICE`：人物声音趋同或说法不符合人物位置。
- `EXPOSITION`：人物说出双方已知、只为告诉观众的信息。
- `REPEATED_INFO`：重复前文或同场已经建立的信息。
- `ON_THE_NOSE`：把潜台词、主题或情绪直接说成解释。
- `STAGE_IMPOSSIBLE`：舞台无法呈现，或演员无法执行。
- `FILM_GRAMMAR`：出现镜头、剪辑、景别，或未经项目设定允许的影视式画外旁白。
- `ENTRANCE_EXIT`：进出场突兀、缺少时间或与上一场状态冲突。
- `PROP_CONTINUITY`：道具凭空出现、消失或位置错误。
- `TIME_CONTINUITY`：时间标记或先后关系矛盾。
- `DOUBLING_CONFLICT`：兼任演员同场或换装时间不足。
- `BOUNDARY_BREACH`：提前发生下一场事件，或没有留下所需状态。
- `LANGUAGE_DRIFT`：时代、地域、身份或语域明显不符。
- `FORMAT_ERROR`：缺少规定字段或格式无法解析。

## 严重度

- `P0`：事实被改写、故事不可理解、舞台无法执行、人物关系或结局改变。必须返修。
- `P1`：明显削弱场景目标、人物逻辑、连续性或可演性。应返修。
- `P2`：局部语言、节奏或格式问题。可进入排练稿后处理。

## 证据规则

- `EVIDENCE` 必须引用定稿或原文的短句，最多 30 个中文字；格式问题可写精确位置。
- 一行只报一个问题，不把几个问题合并成“台词不够好”。
- 优先报 P0/P1。同类问题超过 3 行时，合并为一行并列出所有位置，但仍需给一个明确修法。
- `REQUIRED FIX` 写动作，不写审美目标。写“删掉这句双方都知道的身份说明，让 B 以交出钥匙作为回答”，不写“增强张力”。
- 原文本身存在矛盾时，标 `[SOURCE AMBIGUITY]`，不要擅自选一个版本。

## STATUS 规则

- 有任一 `P0` 或 `P1`：`REPAIR`
- 只有 `P2` 或没有问题：`PASS`
- 缺少原文或定稿等必要输入：`BLOCKED`

不要输出修改后的剧本。
