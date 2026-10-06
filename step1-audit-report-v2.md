# Step 1 审计报告：《Under the Apron Was a Warrior Queen》

> 生成时间：2026-10-04
> 源文件：`Under the Apron Was a Warrior Queen-1.docx`

---

## Part 1: 审计摘要

| 指标 | 数值 |
|------|------|
| 原始总集数 | 16 集 |
| 原始总场景数 | 86 个场景 |
| 原始总行数 | 1872 行 |
| 内容行（去除标题/人物/场景头） | 1684 行 |
| 唯一内容行 | 1647 行 |
| 重复内容行 | 37 行 |
| 重复台词对 | 22 对 |
| 重复舞台指示块 | 15 组 |
| 编辑备注数量 | 16 条（每集1条剧情概要） |
| 音效标记【音效】 | 45 处 |
| 字幕标记【字幕】 | 13 处 |
| △ 前缀行 | 1040 行 |
| 角色名不一致写法 | 6 个角色共 12 种变体 |

### 关键发现

1. **大量重复段落**：剧本存在严重的段落级重复，每个场景切换时前一场景的尾部内容会被重新叙述一遍，导致 37 行完全重复。
2. **角色名格式混乱**：`Bella Cross` 有 4 种写法（`Bella`、`Bella Cross`、`bella_cross`、`Bella Cross`），`Diana` 有 `diana`/`Diana`，`Emily` 有 `emily`/`Emily` 等。
3. **场景碎片化**：86 个场景头将剧本切割得极为细碎，平均每个场景仅约 20 行内容。
4. **跨集重复**：第 3-4 集之间、第 12-13 集之间、第 13-14 集之间存在明显的跨集内容重复。

---

## Part 2: 重复内容详细清单

### A. 跨集重复（集尾→集首完全重复）

| # | 位置 | 重复内容 | 说明 |
|---|------|---------|------|
| 1 | [36]↔[43] | `△【字幕】THREE YEARS LATER。画面展现一栋两层黄色房子的外景。` | 第1集场景3↔场景4重复 |
| 2 | [369]↔[375] | `△Bella抬头看向天空，眼神变得无比冷酷和决绝。` | 第3集结尾↔第4集开头重复 |
| 3 | [370]↔[376] | `Bella Cross（冷酷而坚定地）：And I'll make them pay... for everything.` | 第3集结尾台词↔第4集开头重复 |
| 4 | [417]↔[429] | `△Emily迎面走来，张开双臂，傲慢地挡在Dr. Spencer和两名士兵面前。` | 第4集场景3↔场景4重复 |
| 5 | [1061]↔[1066] | `△旁边的一位女宾客（身穿黑裙、戴大耳环）震惊地用右手捂住嘴巴。` | 第9集结尾↔第10集开头重复 |
| 6 | [1395]↔[1397] | `Emily（低声劝说）：This banquet could save everything.` | 第12集内连续重复 |
| 7 | [1502]↔[1507] | `△Lawrence 坐在沙发上，端着一杯水大口喝着...` | 第13集场景2↔场景3重复 |
| 8 | [1508]↔[1511] | `△门被推开，Bella 穿着黑色西装外套和白衬衫走进来...` | 第13集场景3内重复 |
| 9 | [1510]↔[1514] | `△Lawrence 和 Emily 震惊地看着走入的 Bella 和 James...` | 第13集场景3内重复 |
| 10 | [1512]↔[1515] | `△Lawrence 愤怒地指着 Bella 质问。` | 第13集场景3内重复 |
| 11 | [1517]↔[1519] | `△Bella 停下脚步，神色平静而冷漠地看着 Lawrence 回答。` | 第13集场景3内重复 |

### B. 集内重复（同一集内相邻场景重复叙述）

| # | 位置 | 重复内容摘要 | 说明 |
|---|------|------------|------|
| 12 | [130]↔[146] | Emily关门走进客厅 | 第2集场景5↔场景6 |
| 13 | [192]↔[208]~[215] | Bella与Emily对峙的7行舞台指示 | 第2集场景6↔场景7完全重复（7行） |
| 14 | [603]↔[605] | `James Draven（冰冷地警告）：Don't test me.` | 第5集场景3内连续重复 |
| 15 | [663]↔[665] | James紧张询问 | 第6集场景1内重复 |
| 16 | [667]↔[669] | Bella示范擦伤口 | 第6集场景1内重复 |
| 17 | [672]↔[674] | James赞许微笑 | 第6集场景1内重复 |
| 18 | [673]↔[675] | `You know your emergency medicine.` | 第6集场景1内重复 |
| 19 | [748]↔[750] | Bella灿烂微笑 | 第6集场景5内重复 |
| 20 | [805]↔[813] | Lawrence得意微笑 | 第7集场景3内重复 |
| 21 | [1007]↔[1013] | Lawrence愤怒挡在Diana身前 | 第9集场景2↔场景3 |
| 22 | [1039]↔[1044] | Military Officer宣布邀请函 | 第9集场景3内重复 |
| 23 | [1147]↔[1149] | James悄悄伸手准备拔枪 | 第10集场景3内重复 |

### C. 台词级重复（同一台词出现两次）

| # | 台词 | 位置 | 角色 |
|---|------|------|------|
| 1 | `We're done!` | [338]↔[342] | Bella Cross / bella_cross(O.S.) |
| 2 | `And I'll make them pay... for everything.` | [370]↔[376] | Bella Cross |
| 3 | `Finally. After all this time.` | [541]↔[544] | James Draven(V.O.) |
| 4 | `Please. Allow me.` | [546]↔[548] | James Draven |
| 5 | `We were talking. Get lost!` | [599]↔[601] | Lawrence |
| 6 | `Don't test me.` | [603]↔[605] | James Draven |
| 7 | `I... I don't want to make it worse. Does it hurt?...` | [664]↔[666] | James Draven |
| 8 | `You're supposed to do it like this—` | [668]↔[670] | Bella Cross |
| 9 | `You know your emergency medicine.` | [673]↔[675] | James Draven |
| 10 | `They told me the examination went well. She's stabilized.` | [710]↔[712] | Bella Cross |
| 11 | `That's great news.` | [714]↔[716] | James Draven |
| 12 | `But the Alzheimer's is progressing faster than expected.` | [718]↔[720] | Bella Cross |
| 13 | `You read my mind. Where did you have in mind?` | [749]↔[751] | Bella Cross |
| 14 | `You and Lawrence are a perfect match.` | [762]↔[766] | Party Guest |
| 15 | `That... was only four shots.` | [959]↔[961] | Diana |
| 16 | `Delivery! Invitation to the returning ceremony...` | [1039]↔[1044] | Military Officer |
| 17 | `What's so funny?` | [1198]↔[1200] | Lawrence |
| 18 | `This banquet could save everything.` | [1395]↔[1397] | Emily |
| 19 | `Tell me you didn't freeze my accounts.` | [1513]↔[1516] | Lawrence |
| 20 | `You vindictive bitch!` | [1522]↔[1524] | Emily |
| 21 | `What the hell happened here?` | [1604]↔[1614] | Diana |
| 22 | `Shut your mouth!` | [1711]↔[1713] | Diana |
| 23 | `I'd watch what you say next.` | [1799]↔[1801] | James Draven |
| 24 | `Or what? You'll keep running your mouth?` | [1803]↔[1805] | Lawrence |

---

## Part 3: 角色名标准化映射表

| 统一名称 | 原始写法变体 | 出现次数 |
|---------|------------|---------|
| **Bella Cross** | `Bella`、`Bella Cross`、`bella_cross`、`Bella Cross` | 183 次 |
| **Diana** | `Diana`、`diana` | 94 次 |
| **Lawrence** | `Lawrence`、`lawrence` | 115 次 |
| **Emily** | `Emily`、`emily` | 63 次 |
| **James Draven** | `James Draven`、`James` | 112 次 |
| **Uma** | `Uma` | 9 次 |
| **Aurora** | `Aurora` | 5 次 |
| **Party Guest** | `Party Guest`、`party_guest`、`宾客` | 10 次 |
| **Military Officer** | `Military Officer`、`military_officer` | 5 次 |
| **Dr. Spencer** | `Dr. Spencer` | 4 次 |
| **Grey Suit Bodyguard** | `Grey Suit Bodyguard` | 5 次 |
| **Jewelry Store Clerk** | `Jewelry Store Clerk` | 4 次 |
| **Nurses** | `Nurses`、`nurses` | 5 次 |
| **Armed Intruder** | `Armed Intruder` | 4 次 |

### 带标记的变体

| 原始写法 | 统一为 | 标记类型 |
|---------|--------|---------|
| `Bella(V.O.)` | Bella Cross [旁白] | 内心独白 |
| `bella_cross(V.O.)` | Bella Cross [旁白] | 内心独白 |
| `Bella Cross(V.O.)` | Bella Cross [旁白] | 内心独白 |
| `bella_cross(O.S.)` | Bella Cross [画外音] | 画外音 |
| `Bella Cross(O.S.)` | Bella Cross [画外音] | 画外音 |
| `Uma(O.S.)` | Uma [画外音] | 画外音 |
| `Lawrence(O.S.)` | Lawrence [画外音] | 画外音 |
| `lawrence(O.S.)` | Lawrence [画外音] | 画外音 |
| `lawrence(V.O.)` | Lawrence [旁白] | 内心独白 |
| `Lawrence(V.O.)` | Lawrence [旁白] | 内心独白 |
| `emily(O.S.)` | Emily [画外音] | 画外音 |
| `Emily(V.O.)` | Emily [旁白] | 内心独白 |
| `diana(O.S.)` | Diana [画外音] | 画外音 |
| `Diana(O.S.)` | Diana [画外音] | 画外音 |
| `diana(V.O.)` | Diana [旁白] | 内心独白 |
| `Diana(V.O.)` | Diana [旁白] | 内心独白 |
| `James Draven(V.O.)` | James Draven [旁白] | 内心独白 |
| `James Draven(O.S.)` | James Draven [画外音] | 画外音 |
| `nurses(O.S.)` | Nurses [画外音] | 画外音 |
| `party_guest(O.S.)` | Party Guest [画外音] | 画外音 |
| `military_officer(V.O.)` | Military Officer [旁白] | 内心独白 |

---

## Part 4: 噪音标记分类

### 保留（有意义的叙事信息）

| 类型 | 数量 | 示例 | 处理方式 |
|------|------|------|---------|
| 【字幕】地点/时间 | 8 | `【字幕】DELTA FORCE BASE`、`【字幕】THREE YEARS LATER` | 转为场景描述 |
| 【字幕】角色介绍 | 5 | `【字幕】JAMES DRAVEN, Arms Magnate` | 转为角色描述 |
| 【字幕】文件/道具 | 3 | `【字幕】文件特写，上面写着 "DISSOLUTION OF MARRIAGE"` | 保留为叙事描述 |
| 【音效】关键音效 | 12 | `【音效】枪声`、`【音效】金属落地的清脆响声` | 保留为叙事描述 |
| 【闪回】标记 | 6 | `△【闪回】Bella身穿浅蓝色衬衫...` | 保留，标注为回忆段落 |

### 剔除（纯技术指令/冗余标记）

| 类型 | 数量 | 示例 | 处理 |
|------|------|------|------|
| △ 前缀 | 1040 | 所有以 `△` 开头的行 | 去除前缀 |
| 【音效】转场音效 | 8 | `【音效】转场音效。画面白光一闪` | 剔除 |
| 【音效】简单动作音 | 25 | `【音效】开门声`、`【音效】沉重的关门声` | 融入叙事描述 |
| 画面特写指令 | ~15 | `画面特写Bella的脚`、`镜头特写James Draven手中拿着的棉片` | 简化为叙事描述 |
| 分屏指令 | 1 | `画面分屏，上方是 Bella 自信的笑容...` | 剔除 |

### 转换（需格式转换后保留）

| 原始格式 | 目标格式 | 数量 |
|---------|---------|------|
| `(V.O.)` | `[旁白]` | 14 处 |
| `(O.S.)` | `[画外音]` | 18 处 |
| `角色名（情绪/动作）：台词` | 保持原格式 | ~350 处 |
| `画面切到...` | 简化为场景过渡 | ~20 处 |

---



## Part 5: 净化后的连续剧本

> 以下为去除分集/分场景结构、去重、统一角色名后，以连贯叙事体重写的完整剧本文本。

---

DELTA FORCE BASE。晴朗的天空中，两架直升机并排飞过三角洲特种部队基地上空。操场上，士兵们整齐列队，中间竖立着一面美国国旗。

Uma穿着军装走近Bella Cross，手里拿着一枚银星勋章，亲手将它佩戴在Bella的胸前。

Uma（庄重地）：Captain Bella Cross. Operation Jagged Arrow should have been a bloodbath. You went into a dire situation and made sure everybody got home. It is my great honor to promote you to Major and confer upon you the Silver Star. You are now the only living member of Delta Force to be awarded such.

Uma帮Bella整理好胸前的勋章。Bella向她敬礼。

Bella Cross（坚定而遗憾地）：Thank you, ma'am. But I must respectfully request to retire.

Uma露出惊讶和疑惑的神情。

Uma（不解地）：But you've just made Major. This is your moment. What's going on?

Bella微微低下头，神色黯然。

Bella Cross（伤感地）：My mother raised me alone. Gave up everything so I could be here. She's been diagnosed with Alzheimer's. Early onset. She needs constant care now, and I'm all she has. I don't know how long that'll take. Could be months. Could be years. Could be forever.

Uma伸出双手，将银星勋章放在Bella的手心里。

Uma（真诚而惋惜地）：You're the best operator I've ever commanded. And you're a damn fine soldier. I hate to lose you. If you are ever in need, Delta Force will be here for you.

两人互相敬礼。

Bella Cross（感激地）：Thank you, ma'am.

一个穿着黑色西装的男人迎着阳光走来，神情冷酷。JAMES DRAVEN, Arms Magnate。

THREE YEARS LATER。

一栋两层黄色房子的外景。Bella轻轻推开一扇棕色的木门走了进来。她穿着白衬衫，系着印有花朵图案的围裙。

Bella Cross [旁白]（感慨地）：Walking away from Delta Force was the hardest thing I've ever done. But mom's stable now. Lawrence's work is starting to take off. We're building something real. It's all going to be worth it.

Bella关上门，脸上露出温柔的微笑。她走向坐在轮椅上的母亲Aurora——一位神情有些呆滞的老年女性。Bella弯下腰，温柔地亲吻Aurora的额头。

Bella Cross（温柔地）：Hi, mom.

Bella走到木制衣柜前，打开柜门，从里面拿出一叠折叠整齐的衣服，上面放着她的银星勋章。她用双手捧着勋章，深情地看了一会儿，然后把它放回柜子。听到外面的动静，她转过头。

Bella Cross（语气有些兴奋）：Mom, Lawrence is home.

然而，走进来的不是Lawrence一个人。他抱着Diana——一个双手环绕着他脖子的女人。Diana笑着，语气亲昵。

Diana（笑着）：Lawrence, I said put me down.

Lawrence把Diana放下来，但双手仍然扶着她的腰，关切地看着她。

Lawrence（语气温柔且关切）：You pushed yourself too hard on that training op. The medic said you need to keep it elevated and rested. Let me take care of you. Please.

Diana深情地看着Lawrence。Lawrence搂着Diana的腰，将她往后倾斜，做了一个亲密的下腰动作，两人深情对视。

此时，Bella推着母亲Aurora从走廊走出来，停在楼梯旁，震惊地看着这一幕。

Bella Cross（语气震惊且愤怒）：What is going on here?!

Lawrence赶紧松开Diana，慌乱地解释。

Lawrence（结结巴巴）：Ok, don't... don't jump to conclusions. Di-Diana and I grew up together. We're just old friends. That's all.

Diana走上前一步，神态自若地自我介绍。

Diana（自信地微笑）：I serve in Delta Force Special Operations. I was injured on a recent mission. Lawrence mentioned his wife stays home, and that taking care of people is your specialty. So here I am.

Bella Cross（严厉地）：Injured soldiers belong in military hospitals. Not hanging all over another woman's husband. You wear the uniform—act like it.

Lawrence走上前，站在Diana身旁，有些生气地指责Bella。

Lawrence（严肃地）：Dear, you should show some respect. Diana puts her life on the line for our country daily. While you—while you're here—

Bella Cross（愤怒地打断）：While I'm here what? Taking care of the house? You think being a housewife is such an easy job? Is that why you look at her like that? Because she's out there doing something that matters? Because next to her, I'm... I'm just... The help?

Lawrence（慌忙解释）：That's not, I... I didn't mean... Bella. I know what you do is important. But Diana is—

Diana（挑衅地打断）：It's really nothing. I've been shot at by insurgents in combat zones. A jealous housewife doesn't scare me.

Diana叹了口气，转身准备离开，但突然身体一晃，痛苦地捂住肩膀。

Diana（叹气）：Maybe I should leave...

Lawrence见状急忙上前，将Diana扶到沙发旁。

Lawrence（关切地）：No. Absolutely not. You're hurt. You shouldn't be alone.

Bella Cross（冷笑讽刺）：I don't recall ever seeing this level of care for your own wife or mother-in-law...

Lawrence（愤怒地喊道）：Babe! You're twisting this into something it's not. Diana and I are just friends. That's it. You're my wife. You're the one I love.

Bella愤怒地大喊。就在这时，大门被推开，一个身穿红色真丝衬衫的中年女性走了进来——EMILY, LAWRENCE's Mom。

Emily走到客厅中央，站在Lawrence和Diana身旁，严厉地指责Bella。

Emily（严厉地）：Diana is the Silver Star of Delta Force. A war hero. You should be grateful she's even breathing the same air as you.

Bella Cross（震惊而愤怒）：What did you say?

Bella Cross [旁白]（内心疑惑）：She's... the Silver Star? Why would she steal my identity?

Bella看着Diana，开口问道。

Bella Cross（语气平静而坚定）：Can I ask you a simple question? What's the standard entry protocol for a Level 3 hot zone entry?

Diana神情微微一僵，避开视线。

Diana（结巴地）：I... That's classified information. I can't just discuss it in front of civilians.

Bella Cross（语气嘲讽）：It's basic training. Every operator knows it by heart.

Diana神情尴尬，不知道该怎么回答。突然，她用手在鼻子前扇了扇。

Diana（嫌弃地）：God, what is that disgusting smell?

坐在轮椅上的Aurora神情呆滞，双手在腿上微微颤抖。Bella蹲下身，温柔地安慰母亲。

Bella Cross（温柔地）：It's okay, Mom.

Emily（愤怒地大喊）：She reeks. This is exactly what I've been telling you for months! Your mother doesn't belong here anymore. She belongs in hospice somewhere.

Bella Cross（愤怒地反驳）：We have been through this—

Diana（挑衅地）：You heard her. Time to go.

Bella Cross（愤怒地大喊）：This is my mother's house! Her house, her money. Lawrence's business? She paid for it. She earned her right to stay in her own home.

Emily（愤怒地反驳）：My son is responsible for everything! The both of you are just dragging us down.

突然，Emily弯下腰，抓住Aurora的轮椅，用力往后拉。Bella惊恐地大喊。

Bella Cross（惊恐地）：Mom!

Emily咬牙切齿地推着轮椅。Aurora坐在轮椅上，神情极其惊恐。Diana突然冲向Bella，抓住她的肩膀，两人发生推搡。Diana摔倒在木地板上，发出一声闷哼。

Bella震惊地看着，然后转头看到Emily正在把Aurora的轮椅推向楼梯口。Bella惊恐地试图冲过去阻止，但失去了平衡，从楼梯上滚落下去。Emily站在楼梯顶端，居高临下地看着。Bella躺在楼梯底部的地板上，额头上有血迹，神情痛苦。

Lawrence焦急地跑下楼梯——但他跑向的是Diana。

Lawrence（焦急地询问）：Are you hurt?

Lawrence扶起Diana。Bella躺在楼梯平台上，悲伤而难以置信地看着这一切。她捂着受伤的手臂，艰难地爬起来，扶着楼梯扶手，一步一步走下楼梯。她的裙子上有血迹。

Bella走到客厅，看到Lawrence正蹲在地上，双手扶着Diana的肩膀，温柔地安慰她。

Lawrence（温柔地）：Careful.

Diana（痛苦地）：I think she may have dislocated my shoulder.

Lawrence（关切地）：Don't move. Let me see.

Bella的手紧紧抓住楼梯扶手，看着这一幕。

【闪回】画面叠化到过去。一片阳光明媚的户外草地上，Lawrence身穿灰色西装，单膝跪地，手里拿着钻戒向Bella求婚。Bella身穿浅蓝色衬衫，眼含泪水，面带微笑。Aurora坐在轮椅上，在旁边微笑看着他们。

Aurora（温柔地）：I'm trusting you with my daughter. I'm transferring everything to you. The company, the resources. But you have to promise me. Love her. Take care of her.

Lawrence（坚定地）：Always. Bella. Marry me, please. I promise I will always be there for you. What do you say, Bella?

Bella Cross（深情地）：I do.

画面切回现实。Bella额头上有血迹，眼含泪水，神情悲伤而愤怒地控诉。

Bella Cross（悲愤地）：You took everything my mother had. I was the Delta Force Silver Star. I didn't walk away from it all for us to be tossed aside like this.

画外传来Aurora微弱的呼喊声。紧接着，一声重物落地的声响。

Aurora [画外音]（虚弱地）：Bella...

Bella Cross（惊恐地）：Mom!

Bella快速跑上楼梯。Aurora躺在楼梯顶部的地板上，神情痛苦。Bella用尽全力扶着母亲，小心翼翼地帮她坐回轮椅上。

Bella站在楼梯口，神情冷酷、决绝地看着楼下的Lawrence和Diana——Diana依偎在Lawrence怀里，两人神情亲密。

Bella Cross（冷酷地）：I want a divorce.

Lawrence（震惊且不耐烦）：Bella... What? Is this about Diana's recovery? Don't be unreasonable—

Bella Cross（冷漠地）：Blind and stupid. I'll deal with you later. My mother needs to see a doctor.

Emily从画外走进来，手里拿着一份文件，冷酷地递给Bella。

Emily（刻薄地）：You should've divorced long ago. A woman who only cooks and cleans was never good enough for my son.

文件特写，上面写着"DISSOLUTION OF MARRIAGE"——解除婚姻关系协议书。Diana站在Lawrence身边，脸上露出得意的微笑。Bella拿起笔，毫不犹豫地在离婚协议书上签下自己的名字，然后将文件合上，递回给Emily。

Bella Cross（决绝地）：We're done!

Bella双手握着轮椅把手，推着虚弱的Aurora朝大门走去。

Lawrence（愤怒地）：You're just a housewife. Be real. You have nothing without me! You'll be back within a week.

Diana痛苦地用左手捂住额头。

Diana（痛苦虚弱地）：Lawrence, I think she hit my head. I feel dizzy.

Lawrence（焦急温柔地）：I've got you. Hospital. Right now.

沉重的关门声。Diana靠在Lawrence的肩膀上，微微睁开眼，露出一丝得意的微笑。

Bella推着坐在轮椅上的Aurora在人行道上缓缓前行，神情悲伤而坚定。她停下轮椅，走到轮椅前蹲下，双手紧紧握住Aurora的手。

Bella Cross（自责且深情地）：Mom, I'm so sorry. I let that coward hurt you. But I swear I'll make you well.

Bella抬头看向天空，眼神变得无比冷酷和决绝。

Bella Cross（冷酷而坚定地）：And I'll make them pay... for everything.

Bella深吸一口气，从花围裙的口袋里拿出一台白色手机，拨通了电话。

Bella Cross（严肃而焦急地）：Ma'am, my mother's condition is critical. She was attacked and is now struggling to stay conscious. Is Dr. Spencer available? He's the only specialist I trust for this.

Uma [画外音]（沉稳地）：He's already on his way. Thunder Squad will escort you in.

Bella Cross（感激地）：Copy that. Thank you.

医院大楼的外观。大厅内，Dr. Spencer身穿白大褂，与两名身穿全套黑色特战装备的雷霆小队士兵站在前台旁。护士们惊讶地低语。

Nurses [画外音]（八卦地）：I heard the Silver Star is here. They only deploy for her.

Emily坐在大厅的椅子上，脸上露出得意的神情。

Emily [旁白]（得意地）：They must be here for Diana! She really is something. I have to make sure Lawrence marries her.

Emily迎面走来，张开双臂，傲慢地挡在Dr. Spencer和两名士兵面前。

Emily（傲慢地）：I know exactly why you're here. Come with me. The Silver Star is this way.

Dr. Spencer（严肃地）：Ma'am, we have an urgent case to attend to—

Bella走上前来，急切地大喊。

Bella Cross（急切地）：Wait! My mother is right here.

Emily（不屑地）：They're here to treat Diana. The Silver Star and my future daughter-in-law.

Dr. Spencer（严肃地）：Step aside, ma'am.

Bella（坚定地）：My mother is the critical patient. She needs treatment now.

Bella举起右手，展示手中握着的银星勋章。

Bella Cross（自豪而坚定地）：I am the Silver Star.

Emily震惊地转过头。Dr. Spencer恭敬地说"Obey your orders"。Emily突然爆发出一阵夸张的大笑。

Emily（嘲讽地）：You? You're the housewife my son threw away. Ignore her. Treat my daughter-in-law. If anything happens to Diana, it's on you.

Diana [画外音]（虚弱地）：What's all the noise?

Lawrence揽着Diana的肩膀，扶着她从走廊另一端走过来。Emily指着Bella。

Emily（挑拨地）：This lunatic found a fake medal and now thinks she's you.

Diana走上前，站在Bella面前。Bella神情平静而冷漠，右手展示着银星勋章。Diana突然抬起右手，一巴掌将银星勋章拍落。金属落地的清脆响声中，勋章在地板上滑行了一段距离后停下。

Bella Cross（语气冰冷而坚定）：I let your disrespect go earlier.

Diana（严厉而挑衅）：But impersonating a soldier? You'll be court-martialed for this. I'm the Silver Star.

Bella Cross（平静而嘲讽）：Am I supposed to feel threatened? Fine. Let's take this to Command. Then see who gets court-martialed.

Diana（慌乱而心虚）：Um... they're probably too busy to—

Lawrence突然冲上前，一把抓住Bella的手臂，粗暴地拉扯她。

Lawrence（粗暴地）：Listen. Nobody wants anybody's boss to get involved here, okay, Bella? Just back off, and let the doctor see Diana first.

Emily对Dr. Spencer示意，带着他往病房走。Diana靠在Emily肩膀上。

Bella Cross（焦急而愤怒）：No— Wait!

Lawrence（粗暴而无情）：After Diana is treated, your mom can have her turn. Diana is the Silver Star. She comes first.

Bella Cross（歇斯底里而焦急）：My mother doesn't have time! Diana has a headache at worst—

Lawrence猛地用力一推，将Bella推倒在医院走廊的地板上。重物落地声。Bella倒在地上，双手撑地，痛苦而震惊地看着Lawrence。

就在这时，一只戴着黑色皮手套的手突然从画外伸出，搭在Lawrence的右肩膀上。

James Draven（语气冰冷而充满威严）：Let her go.

James Draven身穿黑色条纹西装，眼神充满杀气。他猛地一拳将Lawrence打飞出去，Lawrence重重地摔倒在走廊地板上。

James Draven低头看着坐在地上的Bella Cross，神色温柔。

James Draven（温柔地）：Finally.

James Draven [旁白]（深情地）：Finally. After all this time.

James Draven向Bella伸出戴着黑色皮手套的右手。

James Draven（语气温柔而关切）：Are you hurt? Please. Allow me.

Bella犹豫了一下，缓缓抬起右手，搭在James的手掌上。James顺势握住她的手，将她从地上拉起来。

Lawrence在远处挣扎着爬起来，愤怒地大喊。

Lawrence（愤怒地）：Who the hell are you? Let go of my wife!

James猛地一甩手臂，将Lawrence再次摔倒在走廊地板上。他整理了一下自己的西装。

James Draven（平静地）：Your mother is heading in for examination now. I pulled a few strings. She'll be fine.

Bella Cross（疑惑地）：How can you arrange something like that? Who are you?

James Draven（微笑地）：James Draven. My family is... well connected.

Bella Cross（微笑地）：Doesn't your family run the largest international arms company in the country? Well connected must be an understatement.

James Draven（温柔地）：I try not to broadcast it. My clients require a certain degree of discretion.

突然，James注意到Bella Cross白色裙子上大腿处的一滩血迹。

James Draven（严肃地）：Your leg. You're bleeding pretty badly. Let me get a doctor—

Bella Cross（坚决地）：I'm fine. My mother needs—

James Draven（坚定地）：She's in examinations. The best hands available. But you're hurt. That cut needs stitches. You should have it looked at.

Lawrence又从后面走过来，愤怒地大喊。

Lawrence（愤怒地）：Hello! What is going on here?

James侧身挡在Bella面前。Lawrence走上前，与James对峙。

Lawrence（愤怒地命令）：We were talking. Get lost!

James猛地揪住Lawrence的西装领口，将他拉近，眼神冰冷地警告。

James Draven（冰冷地）：Don't test me.

Bella Cross（平静而坚决）：We have nothing to talk about.

Bella转身往走廊深处走去，James冷冷地看了Lawrence一眼，也跟着转身离开。

Lawrence（愤怒地大喊）：Bella! We aren't finished!

James扶着Bella Cross坐在病床边。Bella掀起白色裙摆，露出大腿上一道很深的血淋淋的伤口。James打开一个黑色的医药箱，将一卷绷带递给Bella。Bella接过绷带，自己在大腿的伤口上缠绕包扎。

Bella Cross（平静地）：You can look now.

James抬头看着她，然后视线落在她的额头上。

James Draven（关切地）：Your... your forehead. Let me get that cut on your forehead.

Bella Cross（轻声拒绝）：I've got it.

James Draven（真挚地请求）：Please...

Bella微微动容，默认了他的请求。James坐在床边的凳子上，用酒精棉片轻轻擦拭Bella额头的伤口。

James Draven（轻声询问）：This is going to hurt, isn't it? Maybe I should get a nurse? Someone trained for—

Bella Cross（打断他）：James. It's a cut. Not surgery.

James有些紧张。

James Draven（紧张而关切）：I... I don't want to make it worse. Does it hurt? I mean, just... just sitting there.

Bella觉得好笑，从他手中拿过棉片示范。

Bella Cross（微微一笑）：You're supposed to do it like this—

James赞许地微笑。

James Draven（赞许地）：You know your emergency medicine.

Bella Cross（神色认真）：In my line of work, you learn field medicine fast or you don't make it.

James Draven（认真询问）：How long were you active?

Bella Cross（平静地）：Seven years. So what were you even doing here? This doesn't seem like a place you'd normally be.

James Draven（平静地解释）：High-level meetings with the medical administration. We're finalizing a contract for surgical equipment deployment. Your incident caught my attention.

Bella Cross（恍然大悟）：That explains how you could get my mother in so quick. But why help? You didn't know me. Didn't know my mother.

James沉默地看着她，右手微微攥紧。

James Draven（轻声询问）：You don't remember me, do you?

Bella Cross（惊讶而疑惑）：Should I?

这时，传来敲门声。

Nurses [画外音]（大声呼喊）：Family of Aurora Cross!

Bella转身快步走向病房门口。James独自坐在病房里，神情有些失落和深思。

场景切换到医院走廊。Bella从病房里走出来。

Bella Cross（面带微笑，语气轻松）：They told me the examination went well. She's stabilized. But the Alzheimer's is progressing faster than expected. Sorry. Really, I should be thanking you.

James Draven（神情认真，语气诚恳）：Listen, if you really want to thank me, there's only one thing you can do. Rejoin Delta Force. It's so obvious you miss it.

Bella Cross（面露难色）：I can't. The doctors say she'll need full-time professional care soon. The kind of facility she needs... isn't cheap.

James Draven（自信且温柔地微笑）：I've already made arrangements. There's a state-of-the-art memory care facility in the city. The best care at all times.

Bella Cross（震惊且难以置信）：You what? I-I can't possibly pay you back for this.

James Draven（温柔且坚定）：You won't. Consider it my patriotic duty. The country needs you back in service, and your mother needs the best care available. Now you can give her both. What do you say? Rejoin the Force?

心跳声。Bella视线微微移开，陷入沉思。然后重新看着James，眼神变得坚定。

Bella Cross（眼神坚定，语气果断）：Yes. I'll rejoin. They need me and... I need them.

James Draven（欣慰且充满期待）：Excellent! I'll pull a few more strings and set up a re-initiation ceremony. In the meantime, I feel like getting a little field practice in might be a good idea.

Bella Cross（灿烂地微笑）：You read my mind. Where did you have in mind?

APEX WELLNESS, APEX OUTLET。一栋现代建筑的外景。酒会现场，Lawrence穿着西装，Diana穿着黑色皮夹克，手里拿着香槟杯，与另外两名女性交谈。背景墙上的展示柜里挂着几支步枪。

一名非裔男性宾客端着酒杯走过来。

Party Guest（微笑着）：You and Lawrence are a perfect match. Bella should've been gone a long time ago.

Diana（得意地）：Not everyone can handle the life I lead. Some are just jealous.

【音效】开门声。一扇黑色的双开大门缓缓打开。Bella Cross和James Draven站在门口。Bella穿着白色连衣裙，裙摆上有血迹，额头上贴着创可贴。James穿着黑色条纹西装，戴着黑色皮手套。两人并排走入酒会大厅，神情冷峻。

Emily转过头，惊讶地看着他们。Lawrence脸上露出震惊和难以置信的神情。

Lawrence（震惊地）：Bella? How did you get in here?

Diana很快恢复镇定，脸上露出嘲讽的微笑。

Diana（嘲讽地）：This is a professional tactical range. Don't tell me you're here to compete?

Lawrence（不屑地）：These are real guns. Not pots and pans from your kitchen. Go home before you embarrass yourself.

旁边的女宾客们发出一阵嘲笑声。Diana从桌上拿走一把黑色手枪，在手里把玩。

Diana（挑衅地）：I'm really not sure you have what it takes to handle a weapon.

James Draven站在Bella身边，面无表情地看着Diana。Diana走上前一步，直视着Bella。

Diana（咄咄逼人地）：Why don't you put your money where your mouth is? A shooting challenge. You and me. Five shots.

Party Guest（语气嘲讽）：What would a housewife know about firearms anyway? You are the Silver Star. She can't compare to that.

Lawrence（神情轻蔑）：Diana, don't bother with her. She isn't capable of a damn thing, and she knows it.

James Draven走上前一步。

James Draven（语气冰冷）：I think you should back off.

Lawrence（神情挑衅）：What? Are you her new boyfriend? That was fast, Bella. You couldn't even wait for the divorce papers to process?

James向前迈步，伸手向西装内侧。【音效】拔枪和上膛声。James迅速掏出一把黑色手枪并上膛，用枪指着Lawrence的头。Lawrence吓得张大嘴巴，举起双手。

Lawrence（极度惊恐）：W-W-What?

Bella走上前，伸手按在James举枪的手臂上。

Bella Cross（语气坚定）：Stand down there, soldier. Though I appreciate the effort.

James缓缓放下枪。Bella看着Diana，自信地微笑。

Bella（自信微笑）：I accept your challenge. Let's see how far stolen valor will get you.

Lawrence愤怒地指责。

Lawrence（愤怒）：You just... You pointed a gun at me! That's assault.

Bella（冷冷打断）：That's what happens when you don't listen. Come home. Please. Before this gets worse.

Diana走向射击位，熟练地拉动套筒上膛。

Diana（挑衅）：Are we doing this or not? Do you even own a weapon?

James凑近Bella，在她耳边低声说。

James Draven（低沉且体贴）：I can have proper arms brought over. Military grade.

Bella Cross（自信微笑）：The range's equipment will be just fine.

Diana面向靶纸，连续快速射击数枪。弹孔大部分集中在靶心及周围的高分区域。Emily脸上露出得意和赞许的微笑。

Diana（有些遗憾）：My ankle... Still not right since that mission in Colombia. Besides... The weight of this gun, it's all off.

Emily（得意且维护）：She's trained on assault rifles. A range pistol is totally different.

Lawrence（讨好且赞同）：Yeah, and she's injured. I doubt anybody else could land a shot at all.

James发出一声不屑的冷笑。

Bella Cross（冷酷且自信）：On a mission, excuses will only get you killed.

James Draven（轻蔑）：Your spread pattern is amateurish.

Diana（愤怒质问）：What would you know about it? Either of you? You think you can do better?

Diana（极度鄙夷）：You clean a house and wash dishes for a living. I don't think there are many weapons involved with that kind of work.

Bella Cross拿起手枪，神情平静而自信地提出赌约。

Bella Cross（平静自信）：Fine. If I win, you admit in front of everyone that you aren't the Silver Star. How's that?

Diana（不屑冷笑）：You? Win? Alright. What happens when you lose?

James走上前，从西装内侧口袋里掏出一把车钥匙。

James Draven（神情自信）：She won't. But I'll make it interesting. My new Porsche 911. Delivered yesterday.

Party Guest [画外音]（兴奋高喊）：Somebody record this please!

Bella Cross走近James，指了指他的领带。

Bella Cross（神情认真）：Do you mind— Could I borrow your tie?

James微微一笑，点头答应，解下白色领带递给Bella。Bella接过领带，转身走向射击位，双手将领带折叠后蒙在自己的双眼上，在脑后系紧。

Bella Cross（自信挑衅）：That's better. Are you ready to lose?

Lawrence（焦急大喊）：Bella, stop! You're going to get yourself hurt! You've never even shot a gun before!

蒙着双眼的Bella毫不理会，双手举起手枪平举指向前方。【音效】枪声响起。慢动作展示子弹从枪口飞出，精准地击中靶纸红心正中央。Lawrence震惊地张大嘴巴。

连续的枪声响起，蒙着眼的Bella保持举枪姿势连续快速射击，子弹全部精准击中靶心同一个位置。Diana脸色苍白，瞪大双眼，满脸不可置信。

Diana（声音颤抖、难以置信）：That... was only four shots. The challenge was five. Did you load the gun incorrectly?

Bella重新将手枪平举指向前方。【音效】枪声响起，一颗弹壳飞出。慢动作展示子弹精准地穿过靶纸红心中央原有的弹孔。

Bella抬手解开领带，将手枪退膛放在桌上。

Bella Cross（平静、自信）：It's not impossible. It's good training.

James Draven（冷峻、得意）：I think we can all agree the winner is obvious.

Bella Cross（嘲讽、微笑）：Well? Honor your bet.

Diana（慌张、辩解）：There are too many variables at play here. Equipment differences, range conditions—

James Draven（冰冷、严厉）：Instead of making excuses, why not prove it? Match Bella's blind score and all is forgotten.

Lawrence（严肃）：You're the real Silver Star, right? Do it. Hit the target and prove her wrong.

Diana额头上渗出细密的汗珠，眼神极度慌乱。Bella Cross神情严肃。

Bella Cross（坚定、冰冷）：The Silver Star isn't a title you fake. It's earned.

Lawrence（愤怒、质问）：What are you trying to prove? Diana's been in service for ten years! A gun never leaves her hands. You challenging her? You're just embarrassing yourself.

Bella Cross（反问）：Ten years of service and she can't even hold a pistol correctly? Is she really the Silver Star? Or did you just take her word for it?

Lawrence（支吾）：I... Well, she—

Diana（愤怒打断）：Don't twist my words! If I'm not the Silver Star, then who is? You?

Bella Cross（自信坚定）：Yes. I am.

就在这时，一名身穿深绿色军装、戴白手套的男军官推开门，手里拿着一封带有红色火漆印章的信件走入。

Military Officer（庄重）：Delivery! Invitation to the returning ceremony for the Silver Star. Commander Uma has personally signed your invitation to the returning ceremony.

Diana伸手接过信件。

Diana（得意而自信）：Of course. Tell the Commander I wouldn't miss it.

Diana拿着信件在Bella面前挥了挥。

Diana（挑衅而得意）：From Commander Uma herself. What more confirmation do you need?

Lawrence（严厉）：Diana's right. Apologize. Please.

James Draven（嘲讽）：No wonder she divorced you.

Lawrence愤怒地揪住James的西装衣领。

Lawrence（愤怒警告）：Stay out of this, pretty boy!

Lawrence松开James，凑近Bella耳边低声警告。

Lawrence（严厉警告）：The company needs Diana's military connections. Don't ruin this.

Bella Cross（嘲讽反问）：Apologize? For what? For your blindness?

Bella Cross（冷冷地命令）：For someone who can't hit a stationary target, you think very highly of yourself. Open the invitation. Check the name.

Lawrence一把夺过信件，递给Diana。

Lawrence（不耐烦）：Open it. End this circus.

Diana看着Lawrence手里的信件，神情突然变得慌张和震惊。

Lawrence动手撕开信封。Diana瞪大眼睛，死死盯着信封，呼吸变得急促。Lawrence展开信纸，看清内容后，瞳孔猛地放大——

【音效】沉重的脚步声和喘息声。一名身穿灰色背心、橙色工装裤，浑身是血的男子手持猎枪，猛地推开门冲入酒会现场。【音效】巨大的枪声。

Bella Cross（震惊而急迫地大喊）：Get down! Get down!

现场一片混乱。Lawrence护着Diana躲在沙发后面。

Lawrence（惊恐地大喊）：Escaped convict—he got inside!

James Draven（低声询问）：What's the matter?

Bella Cross（冷静而低声地）：Too many shots. Stay alert. There's more than one.

Lawrence抓着Diana的手臂。

Lawrence（急切地）：This is what you're trained for!

Diana（故作镇定地大声说）：Everyone stay calm. I've handled hostile situations. Just... stay behind me.

Armed Intruder（愤怒地咆哮）：Nobody move!

Diana（严厉地大喊）：Halt! Protocol says we establish communication. I can get you safe passage if you—

Armed Intruder（嘲讽地冷笑）：Protocol?! Are you some kind of recruit?

突然，另一名持枪男子从侧面冲出来，猛地一拳将Diana打倒在地。Diana惨叫一声，重重地摔在地板上。

Armed Intruder（恶狠狠地警告）：Next person... who speaks up dies!

James悄悄将戴着黑手套的手伸向身后，准备拔枪。第二名持枪男子注意到了James的动作，举枪对准他。就在第二名男子准备开枪时，Bella Cross突然从一旁冲出，一把锁住他的喉咙，夺下他手中的手枪，迅速转身用夺来的手枪对准第一名持枪男子。

Bella Cross（冷静而坚定地命令）：Surrender! Surrender!

Bella迅速扣动扳机，将两名持枪男子击倒。

Diana睁大眼睛，震惊地看着。Lawrence震惊地看着，喉结上下移动。James Draven走上前。

James Draven（面带微笑）：Remind me not to get on your bad side.

Bella Cross（微笑）：Don't point a gun at me and you have nothing to worry about.

James Draven（赞许地微笑）：That was very impressive. It's like you never left the service.

Bella Cross（平静）：Muscle memory.

Diana（不服气）：I was trying to set up a line of communication. If you hadn't interrupted, it was all under control.

Bella Cross（双手环抱，平静）：That man was well beyond negotiation. You have to read your enemy in seconds. Know when words work and when they don't.

Diana（冷笑）：Don't act like one lucky shot makes you some kind of expert. Real combat is nothing like this.

Bella Cross（平静）：In the real world, the rules are different. You failed to read the situation correctly. Like some recruit.

Lawrence（愤怒大喊）：Enough! Diana is the Silver Star. She's had more combat experience than you can comprehend.

James忍不住轻笑出声。

Lawrence（愤怒）：What's so funny?

James Draven（微笑）：You are. Somebody who freezes under fire like that couldn't possibly be the Silver Star.

James走上前，拉起Diana的右手展示给大家看。

James Draven（笃定）：Look at her hands. They don't lie.

画面展示Bella Cross戴着黑色半指手套、布满老茧的掌心。

James Draven（严肃）：That's years of firearm training. Can't you see it?

Diana（强颜欢笑反驳）：Calluses, please. Any housewife who scrubs floors has those.

Bella Cross（平静坚定）：At the re-initiation ceremony, the real Silver Star will be revealed.

Bella Cross走到Lawrence面前，冷冷地看着他。

Bella Cross（冷酷）：Don't forget to sign the divorce papers.

Bella Cross转身，James Draven挽着她的手臂，两人一起离开酒会现场。Lawrence愤怒地攥紧右拳。

Lawrence [旁白]（内心独白）：Bella shot them? How is that possible? Bella... Who are you, really?

舒缓的背景音乐中，画面展示高档餐厅的夜景。Bella Cross换上了深色吊带裙，与身穿米色西装的James Draven相对而坐。Bella举起白葡萄酒杯向James致谢。

Bella Cross（温柔微笑）：Thank you. Well, for this dress, first off. I don't have much this nice. And also... for reminding me what I'm capable of. It's been three years since I held a weapon. I forgot how good it felt to be... me again.

James Draven（关切）：How have you been? Really. Since you left the service.

Bella Cross（坦诚落寞）：Honest answer? I disappeared. Became someone I didn't recognize. My marriage was a disaster. But I couldn't see it. Not until today.

James Draven（温柔深情）：I'm not asking about him. I'm asking about you.

Bella Cross（疑惑地）：Why are you so interested?

James Draven（深情地）：Don't you remember me? From five years ago.

画面叠化，展示一片废墟、战火纷飞的森林。年轻的James身穿军装，满脸是血，在泥泞中挣扎着爬行，最后靠在一棵燃烧的树旁。一个身穿特种部队装备的士兵——Bella——在烟雾中朝他跑来。Bella蹲下扶住James，撕开他的衣袖，露出手臂上一道很深的割伤。

Bella Cross（焦急地大喊）：Hey! Stay with me. Eyes open. You don't get to sleep! Look at me!

James Draven（虚弱地）：Who... what are you...

画面闪回现实。

Bella Cross（抱歉地）：I'm sorry. I... I don't remember that mission.

James Draven（温柔地）：It is alright. I remember enough for both of us. I believe you are the youngest female officer to make major. Three commendations for valor. Hell of a record.

Bella Cross（害羞地）：Thank you... For helping me, helping my mom.

James Draven（微笑地）：If you really want to thank me... I'm attending an arms exhibition tomorrow night. Gotta rub shoulders with potential clients. I'd love it if you came... as my date.

Bella Cross（犹豫地）：James, I... I'm not technically divorced yet. It wouldn't be right.

James Draven（温柔地）：I wouldn't worry about it. I'm sure we aren't finished with your ex-husband, but he's nothing you should worry about.

Bella Cross（无奈地）：He never could take no for an answer.

James Draven（认真地）：I know a few good lawyers. People who can help you clean up this Lawrence mess discreetly.

Bella Cross（调侃地）：Sounds pretty high brow for somebody in my line of work.

James Draven（庄重地）：You're the Silver Star. It's our honor to assist you.

Bella Cross（微笑地）：Okay.

James Draven（欣慰地）：Great.

清脆的碰杯声。两人举杯相碰。Bella低头喝了一口酒。手机震动声响起，屏幕显示来电信息——Lawrence。Bella脸上的笑容渐渐消失。

Lawrence [旁白]（坚决地）：I will never sign the divorce papers.

与此同时，在Bella的家中。Diana坐在沙发上，手里拿着一封带有红色火漆印章的信件。Emily凑在Diana身边，露出惊喜的表情。

Emily（兴奋地）：Diana, you're incredible!

Diana（得意地）：Commander Uma herself signed it. Only the military elite get access to this banquet.

Emily（热切地）：Could Lawrence and I come?

Diana（为难地）：It's... It's restricted. Family only.

Emily（讨好地）：But once you marry Lawrence, we are family. Aren't we? Your company's barely breathing. You need investors, connections. This banquet could save everything.

Lawrence（有些为难）：Mom... I'm still married to Bella.

Emily（急切地打断）：Start thinking of the big picture! We'll deal with that later. Diana's offering you everything right now.

Emily将两人的手叠放在一起。

Emily（笑着询问）：Diana, will you marry my son?

Diana（微微一笑并抽回手）：Marriage is a big step, Emily. Where's the ring? The proposal?

Emily（立刻笑着说）：You'll get her the best ring money can buy. Right, Lawrence?

Lawrence（勉强微笑点头）：Sure. Yeah, of course.

Diana [旁白]（得意地）：Three years ago, I told you no because you had nothing. Now that you have Bella's money, I'm here to stay.

高档珠宝店内。Emily、Lawrence和Diana走入。Diana走到一个玻璃展柜前，指着一枚大钻戒。

Diana（兴奋地）：That one. It's beautiful.

Jewelry Store Clerk（微笑着）：Excellent choice. This piece is $25,000.

Lawrence（微笑着）：It's perfect. We'll take it.

Lawrence递出黑色Titan银行卡。女店员在POS机上刷卡，屏幕显示红色的"DECLINED"。

Jewelry Store Clerk（抱歉地）：I'm sorry, sir. This card has been declined.

Lawrence（震惊地）：That's impossible. Try it again.

第二张卡，依然被拒。第三张，还是"DECLINED"。

Jewelry Store Clerk（抱歉地）：Still declined, sir.

Diana脸上的笑容瞬间凝固。

Diana（惊讶地）：Declined?

Diana（勉强微笑地）：Maybe we should look at something more modest—

Emily（安慰地）：Oh, don't you worry. Lawrence is going to do this right. Give us a moment.

Emily把Lawrence拉到一旁，压低声音愤怒地质问。

Emily（愤怒地低声）：What the hell is going on?

Lawrence（慌乱地低声）：Bella. It has to be Bella.

Emily（震惊地）：How?

Lawrence（焦急地）：It is her money, but— We have to find her.

Emily（咬牙切齿地）：Call that woman right now. Tell her to get back here.

Lawrence拨打Bella的电话，但无人接听。

Lawrence（沮丧地）：No one answered.

Emily笑着对Diana解释。

Emily（笑着）：Oh, his cards are only expired. Nothing to worry about. We'll have to come back another time.

女店员将钻戒放回首饰盒。Diana看着空了的无名指，神色失落。女店员看着他们离去，微微低头致意，脸上露出一抹意味深长的微笑。

Lawrence坐在沙发上，端着一杯水大口喝着。突然，开门声响起。Bella穿着黑色西装外套和白衬衫走进来，James Draven穿着黑色西装跟在她身后。Lawrence和Emily震惊地看着，Lawrence猛地站起身。

Lawrence（愤怒质问）：Tell me you didn't freeze my accounts.

Bella Cross（平静冷漠）：I did.

Emily（咬牙切齿）：You vindictive bitch! You planned this whole thing, just to humiliate us in public!

Emily冲上前，抬手试图扇Bella耳光。James迅速上前，一把抓住Emily的手腕，将她的手拦在半空中。

Bella Cross（平静解释）：I canceled the supplementary cards tied to my accounts. That's all. Why is that a problem?

Emily（愤怒吼叫）：How dare you cut my son off from his own money! He built everything we have from the ground up!

Lawrence（严厉命令）：Bella, stop this. Unfreeze the accounts right now.

Bella Cross（嘲讽反问）：Why? Your mother just said you're successful. Self-made. Rich. Or did you forget? We're divorced. What's mine isn't yours anymore.

Lawrence（愤怒反驳）：I never signed the papers!

Emily（歇斯底里）：The company! Tell her the company is yours! She can't take that away!

James Draven（冷峻反驳）：Actually, she can. Your son hasn't accomplished a single thing on his own. Every meal you've eaten, every designer bag you've carried, every cent you've spent. It all came from the woman you treated like a servant.

Bella Cross（神色坚定）：I want those divorce papers signed and delivered to me tonight. In the next 72 hours, I'll be reclaiming my mother's company. The house, the cars, the jewelry... Everything my mother paid for, I'm taking it all back.

Lawrence（慌乱拒绝）：No... I won't sign anything!

Bella Cross（平静追问）：You're refusing to sign?

Lawrence（咬牙切齿）：I don't agree to a divorce. You want to continue? We'll take it to court.

Bella Cross（平静而自信）：Somehow I expected this.

Emily（歇斯底里）：As long as my son hasn't signed anything, we have every legal right to be in this house!

Bella拿出一个蓝色的文件夹，上面写着"DISSOLUTION OF MARRIAGE"。

Bella Cross（嘲讽）：Actually, I already filed with the court. We're divorced, Lawrence. Whether you like it or not.

James Draven（微笑）：Which means you're trespassing. Let's help them move out.

James举起右手，向后挥手示意。几名身穿黑色西装的保镖迅速冲进客厅，开始搬运家具。

Lawrence（愤怒）：Wait, stop! You can't just—

Bella Cross（冷漠）：I'm taking back everything that belongs to me and my mother.

Emily（歇斯底里）：You cold-hearted bitch!

Bella和James转身，并肩朝门口走去。保镖们将最后一件家具搬走，客厅变得空无一物。Lawrence和Emily慢慢蹲下，最后瘫坐在空无一物的客厅木地板上，神色绝望而呆滞。

大门被推开，Diana穿着驼色大衣走进来，环顾空荡荡的客厅。

Diana（震惊而难以置信）：What the hell happened here?

Emily哭着对Diana说话。

Emily（急切而哭腔）：Diana, thank God you're here! You have to help Lawrence! That woman brought some man and his thugs and stripped the house bare!

Diana（难以置信）：Bella did this?

Emily（歇斯底里地哭喊）：Yes! And she gutted the entire company! We have nothing!

Lawrence（绝望地哭泣）：It's all gone... Everything.

Diana双手抱胸，冷静下来。

Diana（冷静而严肃）：Listen to me. The Draven family is holding an arms exhibition tomorrow at the convention center. James Draven, the heir to the Draven defense empire, is supposed to be there. If you can get a meeting with him, get him interested in a partnership, you could save the company.

Lawrence（不自信）：You think he'd even talk to me?

Diana（自信而笃定）：You've got the Silver Star with you. James will have to take you seriously.

Lawrence（神色重燃希望）：You're right. You're right. I can do this. We can do this.

GLOBAL DEFENSE EXHIBITION。全球防务展会场外，多辆黑色轿车停在建筑门口。Bella穿着绿色吊带晚礼服，戴着华丽的祖母绿项链，与身穿黑色西装三件套的James并肩前行。

James（温柔赞美）：You look incredible. Commander Uma should be arriving within the hour. She's looking forward to seeing you. Shall we?

两人近距离深情对视，气氛暧昧。Bella挽起James的手臂，两人转身并肩走上铺着蓝色地毯的台阶，走向展馆的旋转玻璃门。

展馆内部。Lawrence和Diana站在展馆内。Lawrence穿着棕色西装，神色紧张地四处张望。Diana穿着红色吊带礼服，戴着钻石项链，深吸一口气。

Diana [旁白]（小声自我安慰）：Just stay calm. Relax.

展馆的双扇金属大门打开，James挽着Bella走了进来。宾客们纷纷转头看向门口。Lawrence看到Bella，瞬间睁大眼睛。Diana也瞬间愣住。

Lawrence（难以置信地低语）：Bella?

Lawrence迎上前。

Lawrence（质问且愤怒）：What are you doing here?

James Draven（冰冷警告）：Watch your tone.

Bella Cross（平静而自信）：I've got this. If they let you in, I don't see why I'd be turned away.

Diana（嘲讽）：Let her have her fantasy. She's probably here hoping someone mistakes her for someone important.

Lawrence（得意且刻薄）：Diana earned her stripes over 7 combat missions all over the world. You couldn't even keep a marriage together.

Bella Cross（平静而犀利）：How long are you planning on impersonating the Silver Star? How long before someone actually checks your service record?

Diana（愤怒而心虚）：Excuse me?

Diana彻底被激怒，猛地抬起右手，试图扇Bella耳光。

Diana（歇斯底里地大喊）：Shut your mouth!

Bella反应极快，迅速抬起左手，一把抓住Diana的手腕，将其死死扣住。Diana挣扎着，无法挣脱。

Lawrence（焦急而愤怒）：Bella! Let her go!

Lawrence伸出双手，抓住Bella的左手腕，试图强行拉开她。James立刻上前，伸出右手死死抓住Lawrence的右手腕，用力向外一甩。Lawrence被甩开，身体失去平衡向后退了几步。James顺势挡在Bella身前。

Lawrence（愤怒警告）：You again? Get out of my way before I have security remove you!

James Draven（平静而冷酷）：She's my date. And you're not touching her.

Lawrence（嘲讽质问）：Date? So it's true—you've been sleeping around while still married!

Diana（得意嘲讽）：They've clearly been involved for a while.

Lawrence（歇斯底里地指责）：You divorced me for him? You were cheating the whole time! You destroyed our marriage!

Bella Cross（冷笑反问）：Cheating? That's rich coming from you.

Lawrence（恶毒咒骂）：I always knew you were garbage! You belong with your brain-dead mother rotting in a hospital bed!

Bella Cross（极度愤怒地警告）：Don't say another word about my mother.

James低下头，伸出右手轻轻握住Bella的左手，十指相扣，给予她无声的支持。

James Draven（低沉威胁）：I'd stop talking if I were you.

Lawrence（愤怒挑衅）：Who the hell do you think you are?

Diana（轻蔑嘲讽）：A parasite. That's all you are. Feeding off Lawrence's scraps, playing dress-up with his ex-wife?

Bella Cross（平静坚定）：Leave him out of this. This is between us.

Lawrence（愤怒咆哮）：You owe me! For everything! You're not walking out of here until you return what you stole!

Bella Cross（嘲讽反问）：You think you have that kind of power over me?

James Draven（平静宣告）：Commander Uma will be here any minute. Military command answers to her—not to some stolen valor fraud.

Diana（震惊疑惑）：Uma? The... the Commander herself?

James Draven（平静威胁）：You can still walk away. Save yourself the embarrassment.

Diana的右手紧紧攥住红色礼服的裙摆。

Diana [旁白]（内心独白）：She's bluffing. Uma wouldn't come to a public event like this. He has to be lying.

Diana突然大笑起来，Lawrence也跟着大笑。

Lawrence（嘲讽质问）：And how exactly would you know the Commander? What would some side piece boy toy know about military operations?

James Draven（语气低沉而充满威胁）：I'd watch what you say next.

Lawrence（挑衅反问）：Or what? You'll keep running your mouth?

Lawrence挑衅地看着James。突然，背景中传来脚步声，一个身穿灰色西装、戴着耳麦的男子从后方走来。

灰色西装保镖走到James面前，神色极其恭敬地深深鞠了一躬。

Grey Suit Bodyguard（神色严肃而恭敬）：Mr. James Draven...

Lawrence（结结巴巴，满脸震惊）：Ja-James Draven?

Diana（神色慌乱地大声反驳）：That's impossible. You're just some boy toy she picked up after the divorce.

Grey Suit Bodyguard（神色严肃）：This is James Draven, sole heir to the Draven Group. His family controls the largest defense contracting empire in the Western Hemisphere.

Grey Suit Bodyguard（语气严厉而充满警告）：Speak to him with disrespect again, and I'll personally ensure you are tossed out.

Diana脸色惨白。Bella看着惊慌失措的两人，嘴角微微上扬。

Diana（结结巴巴）：Mr. Draven... I don't understand. Why would someone like you be with... her?

James转头深情地看着Bella。

James Draven（语气温柔而坚定）：She saved my life. More than once now.

James转头看向Diana，眼神瞬间变得冰冷。

James Draven（语气极其嘲讽）：All while your "Silver Star" cowers in the corner. Get security. Have them removed.

Grey Suit Bodyguard（恭敬领命）：Yes, sir.

Lawrence（神色极其慌张地大喊）：Wait! Mr. Draven, please! I... I didn't know— I... I never meant any disrespect—

Bella Cross（语气平静而有威严）：Wait.

灰色西装保镖听到Bella的话，立刻停下脚步，恭敬地看着她。

Bella Cross（语气平静而威严）：Throwing them out would be a mercy. I want them to stay. I want them to watch when the truth comes out.

Bella微微转头，神色自信地宣布。

Bella Cross（神色自信）：Commander Uma should be arriving any moment now. Everyone here will know exactly who the real Silver Star is.

Diana听到"Commander Uma"的名字，脸色惨白，眼神中充满了绝望和恐惧。

【音效】沉重的开门声。展馆的大门突然缓缓打开，一个身穿深蓝色军装、戴着大檐帽、胸前挂满勋章的军官迈着稳健的步伐走了进来。军官神色庄严地穿过人群，径直向Bella走来。

军官走到Bella面前停下，神色庄重地抬起右手，向Bella敬了一个标准的军礼。


---

## Part 6: 逻辑断链检测

> 基于 Part 5 净化剧本，对 6 类逻辑断链进行检测。

### 断链 1：【空间跳跃】Bella 从家中直接出现在街道

- **位置**：
  ```
  Bella Cross（决绝地）：We're done!
  Bella Cross 双手握着轮椅把手，推着虚弱的Aurora朝大门走去。
  ...
  Bella Cross（冷酷而坚定地）：And I'll make them pay... for everything.
  Bella Cross 深吸一口气，神情从悲伤转为决然。
  Bella Cross 伸手从花围裙的口袋里拿出一台白色手机。
  Bella Cross（严肃而焦急地）：Ma'am, my mother's condition is critical.
  ```
- **严重程度**：中等
- **描述**：Bella 签字离婚后推着母亲走出家门，在街道上说出"我会让你们付出代价"，紧接着就打电话给 Uma 说母亲情况危急。从家中到打电话之间的空间过渡不够清晰——她是在街上打的电话还是已经到了某个地方？
- **修复建议**：在 Bella 打电话前增加一句过渡描述，如"Bella 推着母亲来到医院门口，拨通了 Uma 的电话"。

### 断链 2：【情绪突变】Lawrence 从关心 Diana 到完全无视 Bella 的伤势

- **位置**：
  ```
  Lawrence 跑向躺在客厅木地板上的Diana。
  Lawrence（温柔地安慰）：Careful.
  Diana（痛苦地说道）：I think she may have dislocated my shoulder.
  Lawrence（关切地说道）：Don't move. Let me see.
  ```
  而 Bella 刚从楼梯上滚落，额头有血迹。
- **严重程度**：严重
- **描述**：Bella 滚下楼梯后额头流血、手臂受伤，Lawrence 完全不看她一眼，直接跑向假装受伤的 Diana。虽然这是剧情刻意的"虐心"设计，但从人物逻辑上，Lawrence 至少应该有一个短暂的犹豫或瞥视，否则显得过于脸谱化。
- **修复建议**：在 Lawrence 跑向 Diana 之前，增加一个短暂的停顿或瞥视 Bella 的动作，如"Lawrence 跑下楼梯，目光扫过地上的 Bella，但犹豫了一秒后还是跑向了 Diana"。

### 断链 3：【信息断层】James Draven 突然出现在医院

- **位置**：
  ```
  Bella Cross 被推倒在医院走廊的地板上。
  ---（第5集开始）---
  一只戴着黑色皮手套的手突然从画外伸出，搭在Lawrence的右肩膀上。
  James Draven（语气冰冷而充满威严）：Let her go.
  ```
- **严重程度**：中等
- **描述**：James Draven 在第1集场景2以"军火大亨"字幕短暂亮相后，直到第5集才再次出现。他在医院突然出现并一拳打飞 Lawrence，但剧本没有交代他为什么会在医院、如何得知 Bella 的情况。后续对话中他说"Your incident caught my attention"，但这个解释来得太晚且不够充分。
- **修复建议**：在 James 出场前增加一两个镜头暗示他一直在关注 Bella，例如：一个穿黑色西装的人在医院走廊远处注视着 Bella，或者 James 在车内接到电话后快步走向医院。

### 断链 4：【时间矛盾】闪回求婚场景的时间线混乱

- **位置**：
  ```
  【闪回】Bella身穿浅蓝色衬衫，眼含泪水，面带微笑地看着前方。
  【闪回】Lawrence身穿灰色西装，单膝跪在草地上，手里拿着钻戒向Bella求婚。
  Aurora（温柔地）：I'm trusting you with my daughter.
  Aurora（微笑着）：I'm transferring everything to you. The company, the resources.
  ```
- **严重程度**：轻微
- **描述**：闪回中 Aurora 在求婚现场就把公司和资源转交给 Lawrence，但按照正常时间线，Bella 应该是先退役（三年前），然后才和 Lawrence 结婚/生活在一起。求婚时 Aurora 就转交资产，意味着这发生在 Bella 退役之前，但剧本中 Bella 说"Walking away from Delta Force was the hardest thing"暗示退役是她回到母亲身边之后的事。时间线存在模糊。
- **修复建议**：明确闪回的时间定位——可以标注为"三年前"或"两年前"，让观众清楚求婚和资产转交发生在 Bella 退役之后。

### 断链 5：【角色消失重现】Aurora 在楼梯事件后突然"稳定"

- **位置**：
  ```
  Aurora 躺在楼梯顶部的地板上，神情痛苦。
  Bella 用尽全力扶着Aurora，试图帮她站起来。
  Bella 小心翼翼地扶着Aurora坐回轮椅上。
  ---（离婚后）---
  Bella Cross 双手握着轮椅把手，推着虚弱的Aurora朝大门走去。
  ---（到医院后）---
  Bella Cross [画外音]（焦急地）：She was attacked and is now struggling to stay conscious.
  ---（检查后）---
  Bella Cross（面带微笑，语气轻松）：They told me the examination went well. She's stabilized.
  ```
- **严重程度**：中等
- **描述**：Aurora 被 Emily 推轮椅导致从轮椅上摔落（"Aurora躺在楼梯顶部的地板上，神情痛苦"），Bella 推着受伤的母亲一路走到医院。但到医院后检查结果显示"She's stabilized"，这个转折来得过于轻松。Aurora 的伤势严重程度和恢复情况缺乏交代。
- **修复建议**：在医生检查后增加 Dr. Spencer 简短说明 Aurora 伤情的台词，如"她有一些擦伤和轻微脑震荡，但没有严重骨折"，让观众了解具体状况。

### 断链 6：【去重损伤】第2集场景6→7过渡处叙述断裂

- **位置**：
  ```
  Bella Cross（愤怒地反驳）：We have been through this—
  Diana（神情挑衅）：You heard her. Time to go.
  Lawrence站在一旁，神情严肃地看着。
  ---（去重后直接跳到场景8内容）---
  Bella Cross（愤怒地大喊）：This is my mother's house!
  Emily（愤怒地大喊）：How dare you!
  ```
- **严重程度**：轻微
- **描述**：原始剧本中场景7是场景6的完全重复（7行舞台指示），去重后从 Bella 的反驳直接跳到她大喊"这是我妈妈的房子"。虽然语义上连贯，但中间缺少 Bella 情绪升级的过渡——从"We have been through this"到"This is my mother's house"之间，Bella 的愤怒应该有一个递进过程。
- **修复建议**：在两句台词之间增加一个过渡动作，如"Bella 深吸一口气，压住怒火，但看到 Emily 得意的表情后终于爆发"。

### 断链 7：【空间跳跃】从高档餐厅直接切换到 Bella 家

- **位置**：
  ```
  Lawrence [画外音]（坚决地）：I will never sign the divorce papers.
  ---（直接切换到）---
  Diana 坐在沙发上，手里拿着一封带有红色火漆印章的信件。
  Emily 凑在 Diana 身边，看着信件上的火漆印章，露出惊喜和难以置信的表情。
  ```
- **严重程度**：轻微
- **描述**：从 Bella 和 James 在高档餐厅约会的温馨场景，直接切到 Emily 和 Diana 在 Bella 家讨论银星勋章邀请函，中间没有任何过渡。观众不知道 Lawrence 是在什么情境下说出"我绝不签字"的，也不知道场景是如何切换的。
- **修复建议**：在切换前增加一个简短的过渡，如"与此同时，在 Bella 的家中——"或"Lawrence 挂断电话，脸色阴沉地看向 Emily 和 Diana"。

### 断链 8：【情绪突变】Diana 从嚣张到恐慌的转变缺乏铺垫

- **位置**：
  ```
  Diana（得意而自信）：Of course. Tell the Commander I wouldn't miss it.
  ---（几分钟后）---
  Diana（挑衅而得意）：From Commander Uma herself. What more confirmation do you need?
  ---（拆信前）---
  Diana 看着 Lawrence 手里的信件，神情突然变得慌张和震惊。
  ```
- **严重程度**：轻微
- **描述**：Diana 冒领了邀请函后一直非常得意，但在 Lawrence 即将拆开信件时突然变得慌张。这个慌张来得有些突然——如果她真的是冒牌货，她应该从一开始就担心信件上写的不是她的名字。剧本缺少 Diana 内心不安的铺垫。
- **修复建议**：在 Diana 冒领邀请函后增加一个微小的不安细节，如"Diana 握着信件的手指微微发白"或"Diana 偷偷看了一眼信封上的名字，迅速移开视线"。

### 断链 9：【信息断层】持枪歹徒闯入缺乏前因

- **位置**：
  ```
  Lawrence 准备动手拆开信封。
  Diana 瞪大眼睛，死死盯着信封，神情充满焦虑。
  ---（突然）---
  一名身穿灰色背心、橙色工装裤，浑身是血和伤口的男子手持猎枪，猛地推开门冲入酒会现场。
  ```
- **严重程度**：中等
- **描述**：在酒会现场正在进行身份验证的紧张时刻，突然闯入一个持枪歹徒。这个歹徒的身份、动机、从哪里来都没有交代。他似乎只是一个"剧情工具人"，用来制造混乱让 Bella 展现战斗能力。歹徒闯入后很快被 Bella 击倒，之后再无任何交代。
- **修复建议**：至少给歹徒一个简短的背景交代，如通过某个宾客的台词说明"他是从隔壁的拘留中心逃出来的"（Lawrence 确实喊了"Escaped convict"，但这句台词出现得很突兀，缺乏前置信息）。

### 断链 10：【角色消失重现】Military Officer 送完信后突然消失又出现

- **位置**：
  ```
  Military Officer（庄重）：Delivery! Invitation to the returning ceremony for the Silver Star.
  Diana 伸手接过军官手中的信件。
  Diana（得意地微笑）：Of course. Tell the Commander I wouldn't miss it.
  军官向 Diana 敬礼，随后转身准备离开。
  ---（之后军官完全消失）---
  ```
- **严重程度**：轻微
- **描述**：Military Officer 在第9集送完邀请函后就完全消失了。邀请函上写的是 Silver Star 获得者的归国仪式邀请，但军官把信交给 Diana（冒领者）后没有任何质疑，这不符合军事程序的严谨性。
- **修复建议**：增加军官对 Diana 身份的短暂质疑，如"军官看着 Diana，眉头微皱——这个名字和记录上的似乎不太一样"，然后被 Diana 的自信态度打消疑虑。

---

### 逻辑审查总结

| 指标 | 数值 |
|------|------|
| 严重断链 | 1 个 |
| 中等断链 | 4 个 |
| 轻微断链 | 5 个 |
| 总断链数 | 10 个 |
| **整体剧情连贯性评分** | **7 / 10** |

**评分说明**：
- 剧本整体叙事弧线完整：从 Bella 发现丈夫出轨 → 被迫离婚 → 遇到 James → 逐步反击 → 真相大白，主线清晰。
- 主要扣分点在于：(1) James Draven 的出场缺乏铺垫，显得突兀；(2) Lawrence 对 Bella 的冷漠过于极端，缺少人性灰度；(3) 持枪歹徒事件完全是工具化剧情，缺乏因果逻辑。
- 优点：角色动机基本一致，Bella 的"隐忍→爆发"弧线完整，Diana 的冒牌身份线贯穿始终，银星勋章作为核心道具反复出现形成呼应。

---

## Part 7: 净化统计

### 原始 vs 净化对比

| 指标 | 原始 | 净化后 | 变化 |
|------|------|--------|------|
| 总行数 | 1872 | 1619 | -253 (-13.5%) |
| 集数标记 | 16 | 0 | -16 |
| 场景标记 | 86 | 0 | -86 |
| 人物列表行 | 86 | 0 | -86 |
| 编辑备注行 | 16 | 0 | -16 |
| △ 前缀行 | 1040 | 0 | -1040 |
| 重复内容行 | 38 | 0 | -38 |
| 角色名变体数 | 12 种 | 统一为规范名 | -12 |
| (V.O.) 标记 | 14 | 转为 [旁白] | 格式转换 |
| (O.S.) 标记 | 18 | 转为 [画外音] | 格式转换 |
| 【字幕】标记 | 13 | 融入叙事 | 格式转换 |
| 转场音效标记 | 8 | 0 | -8 |
| 纯内容行数 | ~1619 | 1619 | 基准 |

### 去重统计

| 去重类别 | 删除数量 |
|---------|---------|
| 跨集重复（集尾↔集首） | 5 行 |
| 集内相邻场景重复 | 20 行 |
| 台词级重复 | 24 行 |
| 舞台指示重复 | 7 行 |
| 结构性行去除（标题/人物/场景头/备注） | 204 行 |
| 转场指令去除 | 8 行 |
| **合计去除** | **268 行** |

### 角色出场统计（净化后）

| 角色 | 台词行数 | 舞台指示行数 |
|------|---------|------------|
| Bella Cross | ~150 | ~280 |
| James Draven | ~108 | ~180 |
| Lawrence | ~105 | ~150 |
| Diana | ~88 | ~130 |
| Emily | ~56 | ~80 |
| Uma | ~9 | ~5 |
| Aurora | ~5 | ~25 |
| Party Guest | ~8 | ~10 |
| 其他角色 | ~18 | ~20 |

---

*报告完毕。*
