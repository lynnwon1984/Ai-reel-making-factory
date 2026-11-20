# 项目参数

这份文件不交给模型自由创作。先由制作方填写；不知道的项目写 `[待确认]`，不要用常识补齐。

```yaml
PROJECT_ID: [待填]
SOURCE_TITLE: [待填]
SOURCE_AUTHOR: [待填]
SOURCE_TYPE: 小说 / 纪实 / 故事梗概 / 口述 / 其他
SOURCE_LANGUAGE: 中文
SOURCE_VERSION: [文件名或版本号]
ADAPTATION_VERSION: v1

TARGET_LANGUAGE: 中文普通话
PLAY_FORM: 话剧 / 儿童剧 / 音乐剧 / 沉浸式剧场 / 戏曲 / 其他
AUDIENCE: [例如：成人、家庭、校园]
TARGET_MINUTES: [例如：105]
ACT_COUNT: [例如：2]
INTERMISSION: 有 / 无
REHEARSAL_LEVEL: 围读稿 / 排练稿 / 演出稿

THEATRE_SHAPE: 镜框式 / 伸出式 / 黑盒 / 圆形 / 沉浸式 / 不确定
STAGE_CONSTRAINTS: [例如：固定主景、无升降台、不可用明火]
CAST_MIN: [数字]
CAST_MAX: [数字]
DOUBLING: 允许 / 不允许 / 仅群演
ENSEMBLE_POLICY: [群演最多同时出现几人]
AGE_RANGE_ALLOWED: [演员可覆盖的角色年龄范围]

NARRATOR_POLICY: 不得出现 / 可作证人或歌队 / 必须保留
NONLINEAR_POLICY: 禁止 / 允许局部倒叙 / 原著必须非线性
VIOLENCE_LIMITS: [文字尺度、是否可见、是否允许声音暗示]
INTIMACY_LIMITS: [表演尺度]
MUSIC_POLICY: 无配乐 / 现场 / 预录 / 可作剧情内声音
DIALECT_POLICY: [标准语、方言、混合]

MUST_KEEP:
  - [不可删除的事件、人物关系、台词或意象]
MAY_CUT:
  - [允许压缩的支线或描写]
MUST_NOT:
  - [禁止新增或改变的设定]
CREATIVE_BRIEF: [一句话说明这次改编最想让观众经历什么]
DIRECTOR_QUESTIONS:
  - [需要人工确认的取舍]
```

## 参数解释

- `PLAY_FORM` 决定后续是否允许唱段、舞蹈、观众互动。未明确时按写实话剧处理。
- `NARRATOR_POLICY` 只决定叙事者能否作为舞台角色保留，不决定小说描写能不能被改成别的手法。
- `CAST_MIN/MAX` 是制作限制，不是人物表。人物可以被兼任，但兼任冲突会在场景卡和质检中检查。
- `REHEARSAL_LEVEL` 为 `围读稿` 时优先保证结构和对白；为 `排练稿` 时才细化调度、道具和转场提示。
- `MUST_KEEP` 写事实，不写形容词。例如写“母亲最终没有认女儿”，不要写“保留母亲的复杂感”。
