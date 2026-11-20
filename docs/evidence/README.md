# 验收证据归档

这几个目录是 `runs/` 里**被文档点名引用过**的运行记录，复制过来随代码一起版本化。

## 为什么只有这几轮

`runs/` 全量 14MB / 281 次调用，其中 85% 是过程输出。真正作为结论证据被引用的只有 7 个运行目录，合计 2.2MB。

`runs/` 本身按设计不进 git（见 `.gitignore`），所以把这几轮挑出来单独归档——**否则三个月后没人能复核 A/B 的数字**。

## 目录对应关系

| 目录 | 引用它的文档 | 结论 |
| --- | --- | --- |
| `storyboard-3scene-ab/2026-11-06T06-46-19-953Z/` | `docs/三场A-B验收-v0.1.md` | 三场首轮 A/B：实验引擎 token 约为稳定链路 **6.0 倍** |
| `storyboard-3scene-ab/2026-11-06-shot-repair-v3/` | 同上 | 8-1 多人场定点修复：修复占比 **53.9% → 35.2%**，高危清零，总 token 降 21% |
| `storyboard-3scene-ab/2026-11-06-shot-repair-v4-action/` | 同上 | 4-2 动作场：同批输出重放后 **0 高危**，但仍是稳定链路的 7.9 倍 token |
| `ab-storyboard/2026-11-04T08-03-35-979Z/` | `docs/分镜引擎A-B实验-v0.2.md` | 分镜引擎 A/B（EP1 / EP4 基线与重放） |
| `director-pilot/2026-11-05T08-04-39-682Z/` | `docs/导演Schema与62源块回放-v0.1.md` | 导演 Schema 首轮试点 |
| `director-pilot/2026-11-05T08-09-23-220Z-replay/` | 同上 | 同批回放，验证可复现 |
| `director-pilot/2026-11-05T08-50-24-947Z/` | 同上 | 第二轮试点 |

## 每个目录里通常有什么

```
report.json      指标汇总（shot / Clip / 时长 / token / 高危数）
trace.json       调用轨迹
*-source.txt     该场的源剧本片段
*-stable.md     稳定链路产出
*-experimental.md  实验链路产出
*-replayed*.md   同批输出用当前规则重放的结果
```

## 注意

- **这些文件里含真实剧本文本**（人物名、剧情、台词）。仓库是 private，请勿改公开。
- 只读归档，不再更新。新的验收轮次请新增目录，不要覆盖。

## 怎么补

跑完一轮新的验收后：

```bash
mkdir -p docs/evidence/<组名>
rsync -a "runs/<组名>/<run-id>/" "docs/evidence/<组名>/<run-id>/"
```

然后在引用它的文档里写上这个路径，并把上面的对应表补一行。
