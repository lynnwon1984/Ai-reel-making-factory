# Seedance 2.5 第1集
## 竖屏资产盘点与角色绑定 v1

日期：2026-11-04

## 一、使用边界

- 本次范围为第1集 1-1《城堡前竞技场》与 1-2《皇家竞技场》。
- 输出目标为竖屏短剧，画幅在生成页面或 API 设置为 `9:16`，不写入 Prompt 正文。
- 当前只有文字剧本，没有实际参考资产；以下是正式素材的槽位、数量、用途和绑定规则。
- 素材上传后，按本文件规定的顺序把槽位替换成对应的 `@ImageN` 或 `@VideoN`。
- 实际生成前必须再次核对 `【Unused Assets】`，未使用资产要逐个列出，不能让模型自行激活。

## 二、竖屏构图规则

1. 不使用横向排开的宽幅群像作为主要叙事镜头。
2. 竞技场空间用纵向三层处理：前景马头、披风骑手或人物背影；中景核心冲突；后景看台、城堡和大门。
3. 三名披风骑手以纵深错位站在画面下方，不能像横屏那样并排占满左右。
4. 双人对峙优先使用越肩近景、前后景站位或正反打；需要同框时使用半身双人构图。
5. 白色光柱、云涡和城堡尖顶向上延伸，利用竖屏高度建立神圣感。
6. 冲马镜头从前景马头和马腿切入，主骑手位于画面中上部，观众与后景骑手虚化。
7. 武器、胸针、玻璃球、血迹和手部动作使用特写，承担竖屏中的信息交代。
8. 国王、观众和重甲骑兵只在必要反应镜头中出现，不能让群像抢占核心主体。

## 三、素材规格

| 类型 | 计划数量 | 硬上限 | 说明 |
| --- | ---: | ---: | --- |
| 图片 | 30 | 30 | 角色、群像、场景、载具、道具 |
| 视频 | 4 | 10 | 光效、冲马、飞剑、破门动作参考 |
| 音频 | 0 | 10 | 本版由 Seedance 直接生成声音 |
| 总资产 | 34 | 50 | 未超过 Seedance 2.5 硬上限 |

## 四、图片资产盘点

### A. 角色图片

| 槽位 | 资产内容 | 绑定对象 | 必须保留 | 禁止继承 |
| --- | --- | --- | --- | --- |
| I01 | 长发骑士面部与长发近照 | 长发骑士 | 脸型、五官、长发 | 背景、其他人物 |
| I02 | 长发骑士银白天使甲全身正面 | 长发骑士 | 米色衬衫、银白甲结构、比例、腰侧剑位 | 背景、武器光效 |
| I03 | Brian 全身正面 | Brian | 面部、发型、服装、体型 | 背景、武器 |
| I04 | Brian 铁手套细节 | Brian | 铁手套结构、材质、磨损 | 周围人物与背景 |
| I05 | 紫甲黑发骑士全身正面 | 紫甲黑发骑士 | 紫甲结构、比例、黑发 | 背景、马匹 |
| I06 | 紫甲黑发骑士头部近照 | 紫甲黑发骑士 | 脸型、五官、黑发 | 盔甲以外的服装 |
| I07 | 紫袍法师全身正面 | 紫袍法师 | 紫袍、面部、发型、坐姿比例 | 王座、背景 |
| I08 | 白裙公主全身正面 | 白裙公主 | 白裙、面部、发型、银冠 | 背景、其他人物 |
| I09 | Lothar 面部疤痕近照与全身 | Lothar | 面颊疤痕、脸型、服装、体型 | 背景、马匹 |
| I10 | 国王 Arthur 全身正面 | 国王 Arthur | 面部、王冠、国王服饰 | 王座、看台 |
| I11 | 披纱女子全身正面 | 披纱女子 | 面部、披纱、服装、体型 | 白裙公主的外观 |

### B. 群像图片

| 槽位 | 资产内容 | 绑定群像 | 数量与限制 |
| --- | --- | --- | --- |
| I12 | 三名披风骑手与坐骑 | 披风骑手 | 必须明确为三个独立骑手，不能复制成更多 |
| I13 | 骑马士兵群像 | 骑马士兵 | 若干士兵，紫甲骑士出场时随行 |
| I14 | 竞技场观众群像 | 观众 | 看台两侧人群，不作为核心主体 |
| I15 | 重甲骑兵群像 | 重甲骑兵 | 长矛、金纹盾牌、重甲，仅从大门方向进入 |

### C. 场景图片

| 槽位 | 资产内容 | 使用范围 | 说明 |
| --- | --- | --- | --- |
| I16 | 城堡前竞技场白天全景 | 1-1 | 沙地、石阶、两侧看台、城堡外立面 |
| I17 | 皇家竞技场白天全景 | 1-2 | 沙地、看台、金色王座区、木质侧门 |

如果制作方确认两场实际是同一竞技场，可在上传前用 I16 替换 I17；在未确认前保留两个独立场景槽，避免擅自合并。

### D. 载具与动物

| 槽位 | 资产内容 | 绑定对象 | 连续性要求 |
| --- | --- | --- | --- |
| I18 | 黑色马匹 | 长发骑士坐骑 | 全身、马具、毛色一致 |
| I19 | 白色马匹 | 紫甲黑发骑士出场坐骑 | 只用于 1-1 冲出场 |
| I20 | 棕色马匹 | 紫甲黑发骑士战斗坐骑 | 1-1 后段至 1-2 保持同一匹 |

### E. 道具与固定物

| 槽位 | 资产内容 | 绑定对象 | 归属与连续性 |
| --- | --- | --- | --- |
| I21 | 长剑/白色光柱武器 | 长发骑士首段长剑 | 剑形、护手、光柱来源一致 |
| I22 | 锈蚀铁剑 | 长发骑士手中铁剑 | 锈斑、刃口、长度一致 |
| I23 | 紫甲黑发骑士长剑 | 紫甲黑发骑士 | 只作为其战斗武器 |
| I24 | Brian 长剑 | Brian | 从沙地拔出后由 Brian 持有 |
| I25 | Lothar 长剑 | Lothar | 被震飞前始终由 Lothar 使用 |
| I26 | 破空飞来的长剑 | 未指归属的救援长剑 | 不得擅自绑定为某个角色所有 |
| I27 | 黑宝石城堡纹章胸针 | 紫袍法师 | 佩戴在胸前，微光只来自胸针 |
| I28 | 透明玻璃球与红色液体 | 1-1 一次性道具 | 滚落后碎裂，只出现一次 |
| I29 | 红金高背座椅/金色王座 | 紫袍法师座席 | 1-1 为红金高背椅，1-2 为金色王座 |
| I30 | 竞技场木质侧门 | 1-2 重甲骑兵入口 | 破门前紧闭，破门时木屑向外飞溅 |

## 五、动作与特效参考视频

| 槽位 | 参考内容 | 可继承信息 | 禁止继承 |
| --- | --- | --- | --- |
| V01 | 长剑射向云涡的白色光柱 | 光柱形态、亮度变化、消散节奏 | 人物、服装、场景 |
| V02 | 骑手冲锋与勒马 | 加速、马蹄节奏、勒缰姿态 | 骑手身份、服装、武器 |
| V03 | 长剑破空插入沙地 | 飞行轨迹、落点、震颤与扬尘 | 飞剑主人身份 |
| V04 | 木门爆裂与骑兵涌入 | 破门方向、木屑、尘土、队形 | 具体角色身份 |

## 六、角色绑定规则

### 长发骑士

- 面部与长发：I01。
- 银白天使甲与米色衬衫：I02。
- 黑马：I18。
- 首段光柱长剑：I21。
- 后段锈剑：I22。
- 腰间剑柄不作为新增武器，不凭空拔出未在剧本出现的佩剑。
- 所有单元中只能有一个长发骑士，不出现同款分身。

### Brian

- 面部、服装和体型：I03。
- 铁手套：I04。
- 长剑：I24。
- 第一单元单膝跪地、嘴角渗血；后续单元血迹只可在原位置保留，不能自行新增其他伤口。
- Brian 与长发骑士、白裙公主不得交换服装、身份或位置。

### 紫甲黑发骑士

- 全身与紫甲：I05。
- 头部与黑发：I06。
- 1-1 出场骑白马 I19；之后改骑棕马 I20。
- 战斗长剑：I23。
- 同一单元内不得同时出现第二个紫甲黑发骑士。

### 紫袍法师

- 面部与紫袍：I07。
- 胸针：I27。
- 座席：I29。
- 胸针始终佩戴在胸前，不得变成手持道具。
- 只负责观察、判断、下令和反应，不新增施法动作。

### 白裙公主

- 白裙、面部、发型和银冠：I08。
- 全程保持同一条白裙和同一顶银冠。
- 不与披纱女子混用服装或身份。

### Lothar

- 面部疤痕、服装和体型：I09。
- 长剑：I25。
- 面颊疤痕、嘴角血迹和跪姿变化必须连续。

### 国王 Arthur

- 面部、王冠与国王服饰：I10。
- 只出现在看台，不进入沙地战斗区域。

### 披纱女子

- 面部、披纱与服装：I11。
- 只从白裙公主身后伸手扶住她的手臂，不替代公主说话或行动。

### 群像与数量

- 披风骑手：I12，始终为三名。
- 骑马士兵：I13，作为紫甲骑士随行背景。
- 观众：I14，分布在两侧看台。
- 重甲骑兵：I15，只从 I30 木门方向进入。
- 群像参考不得复制出与核心角色完全相同的人物。

### 载具

- 黑马 I18 只绑定长发骑士。
- 白马 I19 只用于紫甲骑士在 1-1 的首次出场。
- 棕马 I20 用于紫甲骑士后续战斗。
- 马匹数量、毛色和马具在连续镜头中不可互换。

### 道具归属

- 每把剑在剧情段落中保持唯一归属，除非剧本明确发生转移或落地。
- I26 是“未指归属的救援长剑”，不得写成长发骑士所有、Brian 所有或 Lothar 所有。
- I28 玻璃球破碎后不再出现完整形态。
- I29 座席始终属于紫袍法师。
- I30 木门只在最后一个生成单元破开。

## 七、素材上传顺序

正式上传时按以下顺序操作：

| 上传序号 | 槽位 | Seedance 引用 |
| ---: | --- | --- |
| 1 | I01 | `@Image1` |
| 2 | I02 | `@Image2` |
| 3 | I03 | `@Image3` |
| 4 | I04 | `@Image4` |
| 5 | I05 | `@Image5` |
| 6 | I06 | `@Image6` |
| 7 | I07 | `@Image7` |
| 8 | I08 | `@Image8` |
| 9 | I09 | `@Image9` |
| 10 | I10 | `@Image10` |
| 11 | I11 | `@Image11` |
| 12 | I12 | `@Image12` |
| 13 | I13 | `@Image13` |
| 14 | I14 | `@Image14` |
| 15 | I15 | `@Image15` |
| 16 | I16 | `@Image16` |
| 17 | I17 | `@Image17` |
| 18 | I18 | `@Image18` |
| 19 | I19 | `@Image19` |
| 20 | I20 | `@Image20` |
| 21 | I21 | `@Image21` |
| 22 | I22 | `@Image22` |
| 23 | I23 | `@Image23` |
| 24 | I24 | `@Image24` |
| 25 | I25 | `@Image25` |
| 26 | I26 | `@Image26` |
| 27 | I27 | `@Image27` |
| 28 | I28 | `@Image28` |
| 29 | I29 | `@Image29` |
| 30 | I30 | `@Image30` |
| 视频1 | V01 | `@Video1` |
| 视频2 | V02 | `@Video2` |
| 视频3 | V03 | `@Video3` |
| 视频4 | V04 | `@Video4` |

## 八、六个生成单元的资产启用表

| 单元 | 启用角色 | 启用群像/场景 | 启用载具与道具 | 启用视频参考 |
| --- | --- | --- | --- | --- |
| 1 圣光降临 | 长发骑士、Brian、公主、法师、紫甲骑士、Lothar | 披风骑手、观众、骑马士兵、1-1 竞技场 | 黑马、白马、光柱剑、胸针、玻璃球、座席 | V01 |
| 2 Brian 挡马 | 长发骑士、Brian、公主、紫甲骑士 | 1-1 竞技场 | 黑马、棕马、锈剑、紫甲骑士剑 | V02 |
| 3 老骑士誓言 | 长发骑士、Brian、公主、法师、紫甲骑士 | 1-1 竞技场 | 黑马、棕马、锈剑、Brian 剑、紫甲骑士剑、座席 | V02 |
| 4 Lothar 被击倒 | Lothar、长发骑士、公主、法师、紫甲骑士 | 观众、1-2 竞技场 | 棕马、Lothar 剑、紫甲骑士剑、座席 | V02 |
| 5 飞剑救人 | Lothar、长发骑士、公主、紫甲骑士、披纱女子 | 观众、1-2 竞技场 | 棕马、Lothar 剑、紫甲骑士剑、救援长剑 | V03 |
| 6 重甲骑兵入场 | 长发骑士、紫甲骑士、公主、披纱女子、Arthur | 观众、重甲骑兵、1-2 竞技场 | 黑马、棕马、紫甲骑士剑、木门 | V04 |

## 九、仍需制作方确认或补齐

1. Brian 和 Lothar 的完整服装没有在剧本中明确，必须由角色资产补充，不能由提示词臆造。
2. 1-1《城堡前竞技场》与 1-2《皇家竞技场》是否为同一地点，需要场景设计确认；确认同地后可让 I17 复用 I16。
3. 紫甲黑发骑士从白马改骑棕马是明确剧情；如果只是连续性笔误，需要在资产制作前修正。
4. I26 飞来的长剑没有说明来源或归属，后续不得擅自补成某个角色的武器。
5. 本版没有音频资产；若后续要求固定角色音色，需要追加对应角色音频，并重新建立 `@AudioN` 映射。
6. 全部素材上传后，还需要生成 `【Unused Assets】`，逐一列出未启用的 `@ImageN`、`@VideoN`、`@AudioN`。

## 十、上传完成后的 Prompt 前导绑定块

以下内容只有在素材按上述顺序实际上传后才可直接使用：

【Reference Asset Roles】
Use @Image1 and @Image2 for the long-haired knight's face, long hair, beige shirt, silver-white angel armor, and body proportions.
Use @Image3 and @Image4 for Brian's face, clothing, body proportions, and iron gauntlet.
Use @Image5 and @Image6 for the purple-armored black-haired knight's face, black hair, purple armor, and body proportions.
Use @Image7 for the purple-robed mage's face, hair, purple robe, and seated body proportions.
Use @Image8 for the white-dress princess's face, hair, white dress, and silver crown.
Use @Image9 for Lothar's face, cheek scar, clothing, and body proportions.
Use @Image10 for King Arthur's face, crown, clothing, and body proportions.
Use @Image11 for the veiled woman's face, veil, clothing, and body proportions.
Use @Image12 for the group of exactly three cloak riders and their mounts.
Use @Image13 for the mounted-soldier group.
Use @Image14 for the arena spectators.
Use @Image15 for the heavily armored cavalry with spears and gold-pattern shields.
Use @Image16 for the castle-front arena space, stone steps, stands, sand, castle exterior, and daylight.
Use @Image17 for the royal arena space, sand, stands, throne area, and wooden side gate.
Use @Image18 for the long-haired knight's black horse.
Use @Image19 for the purple-armored knight's white horse in the first entrance.
Use @Image20 for the purple-armored knight's brown horse in the combat sequence.
Use @Image21 for the long-haired knight's first longsword and the source of the white light pillar.
Use @Image22 for the rusty iron sword.
Use @Image23 for the purple-armored knight's longsword.
Use @Image24 for Brian's longsword.
Use @Image25 for Lothar's longsword.
Use @Image26 only for the unnamed flying longsword that rescues Lothar; do not assign its ownership.
Use @Image27 only for the mage's black-gem castle-crest brooch.
Use @Image28 only for the transparent glass orb and its red liquid.
Use @Image29 only for the mage's red-gold high-backed seat and golden throne.
Use @Image30 only for the arena's wooden side gate.

Use @Video1 only for the white light pillar's formation, brightness, and dissipation.
Use @Video2 only for mounted charging, reining, and horse movement rhythm.
Use @Video3 only for the flying sword's trajectory, sand impact, vibration, and dust.
Use @Video4 only for the wooden gate bursting open and cavalry entering through it.

Do not adopt backgrounds from character or prop images. Do not use character references to create additional identical people. Keep each character as a single continuous instance.
