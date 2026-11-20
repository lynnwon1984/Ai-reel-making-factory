# 最短操作路径

先按这个顺序跑通一部短篇，再处理长故事。

## 1. 填参数

复制 [00-project-config.md](./00-project-config.md) 的 YAML，填入真实制作条件。暂时不知道的写 `[待确认]`，不要猜。

可以先用 [examples/smoke-test-story.md](./examples/smoke-test-story.md) 做测试，项目参数写成：

```yaml
SOURCE_TITLE: 借伞
SOURCE_TYPE: 故事梗概
TARGET_LANGUAGE: 中文普通话
PLAY_FORM: 话剧
AUDIENCE: 成人
TARGET_MINUTES: 12
ACT_COUNT: 1
INTERMISSION: 无
THEATRE_SHAPE: 黑盒
CAST_MIN: 2
CAST_MAX: 3
DOUBLING: 允许
NARRATOR_POLICY: 不得出现
```

## 2. 事实账本

模型调用内容：

```text
[BASE]
01-base-prompt.md 全文

[CURRENT TASK]
02-source-map.md 全文

[SOURCE CHUNK]
CHUNK_INDEX: 1
START_ID: S001
章节或段落范围：全文
原文：
<粘贴故事>
```

得到 `FACTS_JSONL` 后，人工只看三件事：每条是否只有一个事件、`change` 是否具体、原文台词是否逐字保留。不要在这个阶段评价文笔。

## 3. 故事圣经

```text
[BASE]
01-base-prompt.md 全文

[PROJECT]
已确认的项目参数

[FACTS]
上一步全部 JSONL

[PREVIOUS NOTES]
无

[CURRENT TASK]
03-story-bible.md 全文
```

重点检查 `SPINE` 是否真的是因果链，而不是六个事件标题。若主角没有主动选择，先在 `OPEN_QUESTIONS` 中决定怎么处理，不要直接进入写场。

## 4. 场景卡

```text
[BASE]
01-base-prompt.md 全文

[PROJECT]
已确认的项目参数

[STORY BIBLE]
上一步全文

[FACTS]
全部事实账本

[CURRENT ACT]
ACT: 全部

[CURRENT TASK]
04-scene-plan.md 全文
```

检查每张卡的 `EVENT`、`TURN`、`CHANGE`。三者中有一个为空，就不进入写场。

## 5. 写第一场

```text
[BASE]
01-base-prompt.md 全文

[PROJECT]
已确认的项目参数

[STORY BIBLE]
精简版故事圣经

[PREVIOUS]
PREVIOUS_EVENTS: 无
ENTRY_STATE: <开场可见状态>

[CURRENT SCENE CARD]
把 S01 的卡原样放入

[SOURCE]
把 S01 对应原文原样放入

[NEXT BOUNDARY]
本场必须留下的状态：<从 S01 CHANGE 改写>
不得提前发生：<S02 EVENT>

[CURRENT TASK]
05-scene-draft.md 全文
```

先看场景是否达到 `CHANGE`，再进入对白修订。结构不对时重写场景卡，不要在语言层硬救。

## 6. 三遍单场加工

每场依次调用：

1. `06-dialogue-pass.md`：只改台词和停顿。
2. `07-stage-pass.md`：只改调度、空间、道具和兼任冲突。
3. `08-qc-audit.md`：只报问题，不改稿。

如果质检出现 `P0` 或 `P1`，使用 `09-targeted-repair.md` 定向修复，然后再质检。质检 `PASS` 后再写下一场。

## 7. 拼装

用程序按场景卡顺序拼接各场定稿，统一生成目录、人物表和场次编号。拼装阶段不再调用模型，避免它在重抄时偷偷改台词。

拼装后最后人工确认：

- 每个人物是否都有明确的出场和离场。
- 兼任演员是否在同一场被分饰两角。
- 关键道具是否有来源和去向。
- 全剧目标、阻碍、代价和最终选择是否能一句话说清。
