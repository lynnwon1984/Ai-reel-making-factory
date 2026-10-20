export const SOURCE_SAMPLE = `第1集
△暴雨夜，快递货车停在比弗利山庄别墅门口。艾略特抱着纸箱下车。
【音效】门铃叮当响起。
【字幕】Varus Quintilius。瓦鲁斯举着金杯……
△艾略特低头看纸箱面单，地址栏墨迹晕开，只剩 "Beverly" 可辨。
艾略特："This one... wrong address?"
△别墅门开了。克洛伊站在门内，穿着紫色礼服。
克洛伊（低声）："You're late."
△艾略特把纸箱递过去，雨水顺着下巴滴下来。
艾略特："I got lost."

第2集
△别墅大厅。水晶灯下，瓦鲁斯举着金杯，看着门口。
【音效】酒杯轻碰声。
瓦鲁斯（高声宣布）："Gentlemen, the games are not over yet."
△克洛伊把纸箱放在长桌上，手指按住面单。
克洛伊："It's from her."
△瓦鲁斯的手停住，金杯倾斜，酒液洒在地毯上。
【字幕】To be continued
`;

// 整理 · 第一轮输出：《统一确认清单》
export const CHECKLIST = [
  ["拟合并场次", "3 组"],
  ["拟删除【音效】【字幕】标记", "42 处"],
  ["拟删除着装描述", "18 处"],
  ["拟修改人物名", "5 个"],
  ["拟合并群像", "4 组"],
  ["拟删除重复内容 / 空无效场", "2 场"],
  ["拟重排集数（原 → 新）", "24 → 26 集"],
  ["拟统一道具名（取首次出现名）", "6 项"],
  ["拟明确动作主语", "11 处"],
  ["拟补充 / 拟定着装", "9 项"],
  ["其他需决策项", "无"],
];

// 整理 · 第二轮输出：整理后的剧本
export const ORGANIZED_SCRIPT = `第1集：花环落入乞写手

1-1  尼克蒂利乌斯府邸露台  外  晴朗

人物：朱莉娅（Julia Quintilia，着装：白色长裙）、瓦鲁斯（Varus Quintilius，着装：深红长袍）、侍女群像（Maids，着装：侍女服）

△露台栏杆边，朱莉娅背对宴会厅，手里攥着一只花环。
△瓦鲁斯从长廊尽头走来，举起金杯。侍女群像在栏杆两侧站定。
瓦鲁斯（高声宣布）：Gentlemen, the games are not over yet.
朱莉娅（V.O.）（内心独白）：I should not be here.

1-2  府邸大厅  内  夜

人物：克洛伊（Chloe Quintilia，着装：紫色礼服）、瓦鲁斯（着装：深红长袍）

△克洛伊站在大厅中央，抬头看着楼梯方向。
克洛伊（低声）：He never looks at me like that.
`;

// 修改逻辑 · 第一轮输出：《逻辑诊断清单》
export const DIAGNOSIS = [
  {
    id: "L1",
    where: "1-3",
    type: "道具连续性",
    level: "A",
    problem: "下一场金杯已在克洛伊手中，中间没有传递动作",
    fix: "在 1-3 结尾补：瓦鲁斯将金杯递给克洛伊",
    risk: "L3",
  },
  {
    id: "L2",
    where: "2-1",
    type: "人物动线",
    level: "B",
    problem: "上一场朱莉娅已经离场，本场没有入场动作",
    fix: "补：朱莉娅从露台门进入大厅",
    risk: "L3",
  },
  {
    id: "L3",
    where: "3-5",
    type: "动作逻辑",
    level: "B",
    problem: "瓦鲁斯一手举杯、一手拥抱朱莉娅，双手占用矛盾",
    fix: "改为：瓦鲁斯放下金杯，拥抱朱莉娅",
    risk: "L2",
  },
];

// 修改逻辑 · 第二轮输出：标准化剧本
export const FINAL_SCRIPT = `第1集：花环落入乞写手

1-1  尼克蒂利乌斯府邸露台  外  晴朗

人物：朱莉娅（Julia Quintilia，着装：白色长裙）、瓦鲁斯（Varus Quintilius，着装：深红长袍）、侍女群像（Maids，着装：侍女服）

△露台栏杆边，朱莉娅背对宴会厅，手里攥着一只花环。
△瓦鲁斯从长廊尽头走来，举起金杯。侍女群像在栏杆两侧站定。
瓦鲁斯（高声宣布）：Gentlemen, the games are not over yet.
朱莉娅（V.O.）（内心独白）：I should not be here.

1-2  府邸大厅  内  夜

人物：克洛伊（Chloe Quintilia，着装：紫色礼服）、瓦鲁斯（着装：深红长袍）

△克洛伊站在大厅中央，抬头看着楼梯方向。
克洛伊（低声）：He never looks at me like that.

1-3  府邸长廊  内  夜

人物：瓦鲁斯（着装：深红长袍）、克洛伊（着装：紫色礼服）

△瓦鲁斯走到克洛伊面前，将手中的金杯递给她。
△克洛伊接过金杯，手指收紧。
克洛伊（低声）：You kept it.
`;
