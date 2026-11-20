# EOS AI 分镜无损导入验证

日期：2026-11-02  
测试项目：`321321321321`（项目 ID `1301`）

## 结论

EOS AI 的视频生成单位是 **shot**，不是 Clip。一条 EOS 分镜记录对应一个 5–15 秒视频任务，内部可以用 A/B/C 表示多个 Clip。

平台界面上的“导入剧本 → 继续批量分镜”不是无损导入：

- 普通场景先成为原始剧集；
- 资产解析完成后，还要再次点击“继续批量分镜”；
- “继续批量分镜”会调用模型重新分镜；
- 实测本地第 1 集 24 shot 被压成 23 shot，第 2 集 22 shot 被压成 18 shot。

因此，本地已经生成好的分镜不能作为普通剧本再次交给 EOS 分镜模型。

## 已验证的无损写入

使用 EOS 页面自身调用的内部接口：

1. `POST /api/projects/{projectId}/episodes`
   - 创建剧集；
   - 请求体：`{ projectId, name, script }`。
2. `POST /api/projects/{projectId}/storyboards`
   - 一次写入该集的全部 shot；
   - 每条至少包含：`episodeId`、`order`、`duration`、`recommendedDuration`、`sourceText`、`text`。

实测：

- 第 1 集写入 24 条，取回 24 条，原文 24/24 完全一致，时长 24/24 完全一致，顺序 0–23 连续；
- 第 2 集写入 22 条，取回 22 条，原文 22/22 完全一致，时长 22/22 完全一致，顺序 0–21 连续。

## 本地交付格式

`src/eos-adapter.js` 提供两层输出：

1. `renderEOSAdapter()`：可阅读、可人工粘贴的逐 shot 文本；
2. `buildEOSImportPlan()`：EOS 直连导入器使用的无损 JSON 计划。

直连包结构：

```json
{
  "version": 1,
  "source": "ai-storyboard-forge",
  "episodes": [
    {
      "name": "第1集：集名",
      "script": "本集完整适配稿",
      "storyboards": [
        {
          "order": 0,
          "duration": 12,
          "recommendedDuration": 12,
          "sourceText": "【分镜1】12s ｜ …",
          "text": ""
        }
      ]
    }
  ]
}
```

## 产品约束

- 内部主格式保持不变：集 → shot → Clip。
- EOS 只作为导出目标，一条本地 shot 映射一条 EOS 分镜记录。
- 直连写入后不需要再点“继续批量分镜”。
- 角色、场景、物品 ID 可以先留空；资产匹配仍由制作工具和一线同事负责。
- EOS 内部接口没有公开稳定性承诺。正式商用前必须再次确认接口稳定性、授权边界和错误恢复策略。
- 单次写入应先做幂等检查：
  - 已存在同名剧集时，默认不重复创建；
  - 分镜记录按 `order` 和目标集核对；
  - 写入失败时保留本地 EOS 直连包，不静默丢稿。

## 正式产品出口（v1）

正式产品不直接操作 EOS，交给剪辑与制作人员自行完成后续工作。流程三提供 ZIP 交付包：

- 完整分镜 Markdown；
- 一集一个 EOS 文本；
- 逐 Clip 镜头总表 CSV；
- 交付说明；
- manifest.json。

页面同时提供单集复制和单集下载。EOS 直连 JSON 保留在“实验性导出”中，仅用于内部联调。

