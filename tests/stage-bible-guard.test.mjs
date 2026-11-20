import assert from "node:assert/strict";
import test from "node:test";
import { validateStoryBible } from "../scripts/stage-bible-guard.mjs";

const validBible = `# STORY BIBLE v1

## 1. 制作命题
LOG LINE: 周岚为了确认母亲留下的钥匙去问哥哥，却必须先面对两人的旧账。
DRAMATIC QUESTION: 两人会不会一起走？
THEATRICAL PREMISE: 所有关系变化通过谁触碰柜台上的物件呈现。

## 2. 因果脊柱
SPINE_01: 开场失衡
SPINE_02: 第一次反噬
SPINE_03: 中点变化
SPINE_04: 最大代价
SPINE_05: 主动选择
SPINE_06: 结尾状态

## 3. 主角
CHARACTER: C01 / 周岚 / 周岚
WANT: 去母亲旧屋
NEED: 承认自己也在逃避
OBSTACLE: 哥哥不肯放她轻易离开
STAKES: 推断：再次错过面对母亲的机会
TACTICS: 展示布袋, 解释, 逼近
ARC: 回避→面对→选择现在出发
VOICE: 短句, 回避称谓, 被逼问时改用事实

## 4. 对手与关系动力
FORCE: 周启明
POWER: 他掌握铺子的日常秩序
DEPENDENCY: 两人共同继承母亲留下的空间
RELATION_TURNS:
- RT01: 开始互相试探

## 5. 舞台世界
TIME_SPACE_CONTRACT: 全程发生在修表铺。
SCENIC_RULE: 物件被谁拿起，谁就暂时掌握谈话。
TRANSITION_GRAMMAR: 以关灯和雨声完成结尾转场。
VISIBLE_SYSTEM: 布袋、怀表、钥匙
NARRATION_POLICY: 无叙述者

## 6. 人物表与兼任
CASTING
C01 | 周岚 | 周岚 | 主角 | 35 | 短句/事实/回避 | S001 | S012
C02 | 周启明 | 周启明 | 对手 | 40 | 命令句/反问 | S002 | S012

DOUBLING_PLAN
A01：演员A 饰 C01
A02：演员B 饰 C02

DOUBLING_GUARDS
- 无

## 7. 母题与兑现
MOTIF
M01 | 首次 S003 | 布袋 | 被拿出又收起 | 最终兑现 S012

## 8. 改编变更账
CHANGE LEDGER
AD01 | T1 | 来源 S001–S002 | 内省改动作 | 不改变事实

## 9. 缺席与风险
OMITTED
- 无

OPEN_QUESTIONS
- Q01 | 无 | 按默认值
`;

test("故事圣经：完整版本通过", () => {
  assert.deepEqual(validateStoryBible(validBible, { castMax: 3 }), []);
});

test("故事圣经：模板占位和原文名残留被拦下", () => {
  const broken = validBible
    .replace("周岚 | 周岚", "周岚 | 原文名")
    .replace("A01：演员A 饰 C01", "A01：<演员> 饰 C01");
  const codes = validateStoryBible(broken, { castMax: 3 }).map((issue) => issue.code);
  assert.ok(codes.includes("BIBLE_PLACEHOLDER_LEFT"));
  assert.ok(codes.includes("BIBLE_ORIGINAL_NAME_PLACEHOLDER"));
});

test("故事圣经：演员足够却强行兼任被拦下", () => {
  const broken = validBible
    .replace("A01：演员A 饰 C01", "A01：演员A 饰 C01 / C02")
    .replace("A02：演员B 饰 C02\n", "");
  const codes = validateStoryBible(broken, { castMax: 3 }).map((issue) => issue.code);
  assert.ok(codes.includes("BIBLE_UNNECESSARY_DOUBLING"));
});

test("故事圣经：无出处引语和缺失兼任表被拦下", () => {
  const broken = validBible
    .replace(
      "AD01 | T1 | 来源 S001–S002 | 内省改动作",
      'AD01 | T1 | 来源 S001 | 从 “她瞬间回到十年前” 到 舞台动作',
    )
    .replace("DOUBLING_GUARDS\n- 无\n", "");
  const codes = validateStoryBible(broken, {
    castMax: 3,
    source: "周岚站在门外。布袋上绣着“岚”字。",
  }).map((issue) => issue.code);
  assert.ok(codes.includes("BIBLE_QUOTE_UNVERIFIED"));
  assert.ok(codes.includes("BIBLE_DOUBLING_GUARDS_MISSING"));
});
