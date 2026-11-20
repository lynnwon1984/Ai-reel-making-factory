---
name: screen-script-qc
description: "审计 20 分钟成年向虚构影视剧本，检查时间码、成人场景时长、同意节点、动作与衣物连续性、保护措施、镜头覆盖、重复内容及多语言版本对版。用于影视剧本质检和定点返修；不用于舞台剧本、未成年或非自愿内容。"
---

# 影视剧本质检

用于检查约 20 分钟的成人向影视短篇。默认成人内容约 14 分钟，最终参数以项目要求为准。

先运行确定性检查，再进行语义审查。不要用“整体不错”代替具体问题，也不要在质检阶段顺手改写无关内容。

## 自动检查

运行：

```bash
python3 scripts/check_screenplay.py <剧本.md> \
  --target-minutes 20 \
  --intimacy-minutes 14
```

需要比较不同语言版本时：

```bash
python3 scripts/check_screenplay.py <中文母版.md> \
  --compare <英文或日文版本.md> \
  --target-minutes 20 \
  --intimacy-minutes 14
```

脚本检查：

- `## Sxx` 场次是否连续
- `【时间码】` 是否从 0 开始、首尾衔接、无倒退
- 总时长是否符合目标约数
- 带 `【亲密戏】` 标记的场次累计时长
- 成人场景是否有意图、进入状态、同意节点和停止口令
- 是否有保护措施和镜头覆盖
- 是否残留模板占位或角色名占位
- 是否在镜头区块之外混入镜头语言
- 同场是否有完全重复的长句
- 多语言版本的场次数量、编号和时长是否一致

脚本通过不代表内容合格，只代表可解析的合同项没有明显断裂。

## 语义审查

逐场进行以下检查：

1. 前 1 分半是否直接进入危险、情欲或未解决的冲突。
2. 人物当前想要什么，是否只通过动作和对白表现。
3. 每场结束时，关系、权力、知识、衣物、空间或危险是否至少改变一项。
4. 成人场景是否改变了关系或权力，而不是可随意删除的装饰。
5. 第一次高潮后是否留下停顿、清理、换位或新的关系条件。
6. 第二次成人场景是否至少改变主动方、体位、空间、衣物、节奏和关系中的三项。
7. 两段性行为之间是否有真正的反转，而不是把同一动作再做一遍。
8. 每次新增行为前是否有可理解的同意或边界确认。
9. 停止口令是否真的可执行；任何一方说出口时必须立即停止。
10. 是否存在性换取救命、金钱、放行、庇护或政治承诺的暗示。
11. 非人角色身体、体温、器官和保护措施是否与项目 Canon 一致。
12. 非生命装置是否仍然是非生命装置；不能让它突然产生意识、自主欲望或未经触发的主动行为。
13. 动作、衣物、手部位置、道具和空间是否连续。
14. 镜头是否覆盖身体距离、手、面部、局部动作和环境；不能只拍脸或用空镜替代关键动作。
15. 日语和英语版本是否各自自然，并保持相同的动作、同意节点和时长。
16. AI 生成时，角色身份、脸、体型、肢体数量、手指、翅膀、鳞片、触手、衣物和关键接触点是否能在分镜间保持连续。

本项目没有真实演员参与。不要把演员现场安全、亲密戏指导和隔离衣物列为主要风险；它们应替换为生成身份漂移、肢体拓扑错误、衣物/道具漂移、接触点穿帮和镜头空间断裂。

## 问题级别

- `P0`：事实/同意错误、时间码断裂、非生命对象被写成自主主体、性暴力、未成年或真实人物风险。
- `P1`：核心场景目标不清、成人段落不足、连续性断裂、性交易暗示、两段成人戏高度重复。
- `P2`：局部节奏、用词、重复句、镜头覆盖或格式问题。

有 P0/P1 时 `STATUS: REPAIR`。只有 P2 或无问题为 `PASS`。输入缺失为 `BLOCKED`。

## 报告格式

```text
QC_FILE: <文件>
TARGET_RUNTIME: 20:00
INTIMACY_TARGET: 14:00
STATUS: PASS / REPAIR / BLOCKED

AUTOMATED:
- <pass/fail短句>

SEMANTIC:
ID | SEVERITY | CODE | LOCATION | EVIDENCE | REQUIRED FIX
S01-Q01 | P1 | REPEATED_SEQUENCE | S07 | <短引文> | <具体修法>

SUMMARY:
- <最多5条>

NEXT:
- PASS → 进入本地化/镜头表
- REPAIR → 只修改 P0/P1，再复检
```

## 常用问题代码

- `TIME_GAP` / `TIME_OVERLAP`
- `RUNTIME_OUT_OF_RANGE`
- `INTIMACY_TOO_SHORT`
- `CONSENT_NODE_MISSING`
- `STOP_WORD_MISSING`
- `PROTECTION_MISSING`
- `SHOT_COVERAGE_MISSING`
- `BODY_CONTINUITY`
- `REPEATED_SEQUENCE`
- `TRANSACTIONAL_SEX`
- `PASSIVE_VULNERABLE_PARTY`
- `NONLIVING_DEVICE_AUTONOMY`
- `CROSS_LANGUAGE_MISMATCH`
- `CHARACTER_IDENTITY_DRIFT`
- `BODY_TOPOLOGY_ERROR`
- `CONTACT_POINT_MISMATCH`
- `WARDROBE_PROP_DRIFT`
- `MODEL_CONTENT_LIMIT`
- `FORMAT_ERROR`

## 定点返修

先报告问题，再只修改被指出的场次或节拍。不要因为检查到 P1 就把整篇重写。

返修后重新运行自动脚本和语义检查。不要由同一次生成同时完成“修复”和“宣布通过”。
