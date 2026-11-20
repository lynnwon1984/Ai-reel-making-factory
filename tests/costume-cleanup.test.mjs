import { test } from "node:test";
import assert from "node:assert/strict";

import { cleanActionCostume } from "../src/costume-cleanup.js";
import { validateScript } from "../src/validate.js";

const SAMPLE = `第1集：测试

1-1 教堂 内 日
人物：亚瑟（Arthur，着装：白色礼服）、罗莎琳德（Rosalind，着装：白色婚纱）、莱昂（Leon，着装：银色盔甲）、侍卫群像（Guards，着装：黑色盔甲）
△两个穿着黑色皮革盔甲的卫兵快步走进房间。
△亚瑟和罗莎琳德身穿结婚礼服，背对镜头站在红地毯尽头。
△一名身穿黑色盔甲的守卫慌慌张张地跑进来。
△莱昂身穿华丽的银色盔甲，双手高举一把长剑。
△一个身穿灰色马甲和白色衬衫的年轻仆人跑过来。
△罗莎琳德穿着白色婚纱，神色担忧地站在台阶上。
△莱昂身穿银色盔甲，神色愤怒地用右手持长剑指向前方。
△画面特写两双穿着靴子的脚并排走在石板路上，一双是黑色皮靴，一双是白色长裙下的白鞋。
△几名穿着黑色盔甲的守卫站在门口。
△几名穿着华丽盔甲、手持发光长剑的骑士并排站立。
△特写一只穿着黑色皮靴的脚向前迈出一步。
△莱昂穿着华丽的银色盔甲，从金色魔法阵中缓缓降落。
亚瑟（平静）：Hold on!
`;

test("正文着装：动作保留，服装修饰移除", () => {
  const result = cleanActionCostume(SAMPLE);

  assert.equal(result.count, 12);
  assert.match(result.text, /△两个卫兵快步走进房间。/);
  assert.match(result.text, /△亚瑟和罗莎琳德背对镜头站在红地毯尽头。/);
  assert.match(result.text, /△莱昂双手高举一把长剑。/);
  assert.match(result.text, /△一个年轻仆人跑过来。/);
  assert.match(result.text, /△画面特写两双脚并排走在石板路上。/);
  assert.match(result.text, /△几名手持发光长剑的骑士并排站立。/);
  assert.match(result.text, /△特写一只脚向前迈出一步。/);
  assert.match(result.text, /△莱昂从金色魔法阵中缓缓降落。/);
});

test("正文着装清理：台词与人物行完全不动", () => {
  const result = cleanActionCostume(SAMPLE);

  assert.match(result.text, /人物：亚瑟（Arthur，着装：白色礼服）/);
  assert.match(result.text, /亚瑟（平静）：Hold on!/);
});

test("正文着装清理：幂等，清理后校验器不再报警", () => {
  const once = cleanActionCostume(SAMPLE);
  const twice = cleanActionCostume(once.text);
  const report = validateScript(once.text);
  const dress = report.checks.find((one) => one.title === "正文未见着装描述");

  assert.equal(twice.count, 0);
  assert.equal(twice.text, once.text);
  assert.equal(dress?.level, "ok");
});

test("裸上身等非服装动作不误删", () => {
  const input =
    "第1集：测试\n\n1-1 房间 内 夜\n人物：亚瑟（Arthur，着装：赤裸上身）\n△亚瑟赤裸着上身，靠在床头。\n";
  const result = cleanActionCostume(input);
  assert.equal(result.count, 0);
  assert.match(result.text, /△亚瑟赤裸着上身，靠在床头。/);
});
