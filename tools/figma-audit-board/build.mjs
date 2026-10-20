// 把 ./images 下的截图编成 base64，生成可直接运行的 code.js
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const imgDir = join(root, 'images');

const cards = [
  {
    key: '01-entry.png',
    step: '1 · 进入页面',
    health: '过重',
    tone: 'warn',
    notes: [
      '标题下先来四行「功能说明」，再一排 5 个步骤药丸，再来「这一步就三件事」。',
      '三块讲的是同一件事，占掉首屏 620px，输入框还在折线以下。',
      '5 个药丸折了行，「5 可选·机读层」单独掉到第二排。',
    ],
  },
  {
    key: '02-input.png',
    step: '2 · 步骤 01 输入',
    health: '好 · 可作基准',
    tone: 'ok',
    notes: [
      '拖拽区 → 识别结果（3 集 → 1 批）→ 每批集数 → 开始生成，一条线，没有歧义。',
      '全页最好的一屏，其余部分都该向这个密度看齐。',
    ],
  },
  {
    key: '03-prompt.png',
    step: '3 · 步骤 02 提示词',
    health: '名不副实',
    tone: 'bad',
    notes: [
      '卡片写着「默认提示词 · 4178 字」，按钮叫「查看 / 替换」，点开是空输入框。',
      '全页没有第二个入口能读到那 4178 字——「查看」做不到，只有「替换」做到了。',
      '「使用默认」是静态文字，长得像禁用按钮，实际不可点。',
    ],
  },
  {
    key: '04-generate.png',
    step: '4 · 步骤 03 生成',
    health: '能用但失焦',
    tone: 'warn',
    notes: [
      '19,058 字塞进 520px 高的框，内容实际 16,908px，约 33 屏。',
      '想看第 40 个分镜，要在小框里滚很久，且没有跳转或搜索。',
      '滚动区不可聚焦，键盘用户滚不进去。',
    ],
  },
  {
    key: '05-check.png',
    step: '5 · 步骤 04 校验',
    health: '好 · 但太薄',
    tone: 'ok',
    notes: [
      '「3 集 · 72 shot · 127 Clip，高 0 中 0，全部通过」一句话给结论。',
      '唯一一块扫一眼就知道结果的地方，可惜只有一行。',
    ],
  },
  {
    key: '06-l1.png',
    step: '6 · 步骤 05 机读层',
    health: '最重的一块',
    tone: 'bad',
    notes: [
      '46,624 字，32,727px 高，约 64 屏。',
      '「风格与约束」重复 127 次，每次 169 字，合计 21,463 字，占总量 46%。',
      '这部分是纯重复，不是内容——抽到段头写一次即可。',
    ],
  },
];

const images = {};
for (const f of readdirSync(imgDir).filter((f) => f.endsWith('.png'))) {
  images[f] = readFileSync(join(imgDir, f)).toString('base64');
}

const missing = cards.filter((c) => !images[c.key]);
if (missing.length) throw new Error('缺图: ' + missing.map((m) => m.key).join(', '));

const code = `// 由 build.mjs 生成，不要手改。
const CARDS = ${JSON.stringify(cards, null, 2)};
const IMAGES = {${Object.entries(images)
  .map(([k, v]) => `\n  ${JSON.stringify(k)}: "${v}"`)
  .join(',')}
};

const TONE = { ok: { bg: "#0f2a1a", fg: "#4ade80" }, warn: { bg: "#2a2410", fg: "#fbbf24" }, bad: { bg: "#2a1515", fg: "#f87171" } };
const PAGE_BG = "#0d1110";
const CARD_BG = "#141a17";
const LINE = "#25312c";
const TEXT = "#e8efea";
const MUTED = "#93a49b";

let FONT = { regular: { family: "Inter", style: "Regular" }, bold: { family: "Inter", style: "Bold" } };

async function loadFonts() {
  const candidates = [
    { regular: { family: "PingFang SC", style: "Regular" }, bold: { family: "PingFang SC", style: "Semibold" } },
    { regular: { family: "Inter", style: "Regular" }, bold: { family: "Inter", style: "Bold" } },
  ];
  for (const c of candidates) {
    try {
      await figma.loadFontAsync(c.regular);
      await figma.loadFontAsync(c.bold);
      FONT = c;
      return;
    } catch (e) {
      /* 试下一个 */
    }
  }
  throw new Error("没有可用字体");
}

function text(parent, chars, opts) {
  const t = figma.createText();
  t.fontName = opts.bold ? FONT.bold : FONT.regular;
  t.characters = chars;
  t.fontSize = opts.size || 14;
  t.fills = [{ type: "SOLID", color: hex(opts.color || TEXT) }];
  t.lineHeight = { unit: "PERCENT", value: opts.lineHeight || 160 };
  t.textAutoResize = "HEIGHT";
  if (opts.width) t.resize(opts.width, 10);
  parent.appendChild(t);
  return t;
}

function hex(h) {
  const n = parseInt(h.replace("#", ""), 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}

function b64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function frame(parent, name, x, y, w, h, fill) {
  const f = figma.createFrame();
  f.name = name;
  f.x = x; f.y = y; f.resize(w, h);
  f.cornerRadius = 12;
  f.fills = fill ? [{ type: "SOLID", color: hex(fill) }] : [];
  f.strokes = fill ? [{ type: "SOLID", color: hex(LINE) }] : [];
  f.clipsContent = false;
  parent.appendChild(f);
  return f;
}

async function main() {
  await loadFonts();
  figma.notify("正在生成审计板…");

  const CARD_W = 480;
  const GAP = 200;
  const TOTAL_W = CARDS.length * CARD_W + (CARDS.length - 1) * GAP;

  const root = figma.createFrame();
  root.name = "流程三 · 生成分镜 · 界面审计";
  root.resize(TOTAL_W + 160, 1600);
  root.x = 0; root.y = 0;
  root.fills = [{ type: "SOLID", color: hex(PAGE_BG) }];
  figma.currentPage.appendChild(root);

  // 标题区
  const head = figma.createFrame();
  head.name = "标题";
  head.x = 80; head.y = 60;
  head.resize(TOTAL_W, 250);
  head.fills = [];
  root.appendChild(head);
  text(head, "流程三「生成分镜」界面审计", { size: 40, bold: true, width: TOTAL_W }).y = 0;
  text(head, "AI 短剧剧本清洗机 · localhost:4190/#/storyboard · 2026-10-20", { size: 16, color: MUTED, width: TOTAL_W }).y = 64;
  text(head, "功能不多，是展示没做减法。要你动手的只有「载入 → 开始生成 → 下载」；剩下是三层讲同一件事的说明，加两块 1.9 万字和 4.7 万字的滚动区。", {
    size: 20, width: TOTAL_W, lineHeight: 170,
  }).y = 110;

  // 统计条
  const stats = [
    ["19,058 字", "分镜成稿，约 33 屏"],
    ["46,624 字", "机读层，约 64 屏"],
    ["46%", "机读层里重复的风格约束"],
    ["2 处 bug", "步骤条错位 / 查看失效"],
  ];
  const statBand = figma.createFrame();
  statBand.name = "关键数字";
  statBand.x = 80; statBand.y = 330;
  statBand.resize(TOTAL_W, 120);
  statBand.fills = [];
  root.appendChild(statBand);
  stats.forEach(([n, l], i) => {
    const b = frame(statBand, "stat-" + i, i * 300, 0, 280, 110, CARD_BG);
    const nText = text(b, n, { size: 26, bold: true, width: 240 });
    nText.x = 20; nText.y = 18;
    const lText = text(b, l, { size: 13, color: MUTED, width: 240 });
    lText.x = 20; lText.y = 62;
  });

  // 六张卡片
  const rowY = 520;
  for (let i = 0; i < CARDS.length; i++) {
    const c = CARDS[i];
    const x = 80 + i * (CARD_W + GAP);
    const card = frame(root, "step-" + (i + 1), x, rowY, CARD_W, 1180, CARD_BG);
    try {
    const img = figma.createImage(b64ToBytes(IMAGES[c.key]));
    const keyOk = IMAGES[c.key] ? "ok" : "missing";
    const rect = figma.createRectangle();
    rect.name = "screenshot";
    rect.resize(CARD_W - 32, Math.round((CARD_W - 32) * (849 / 788)));
    rect.x = 16; rect.y = 16;
    rect.cornerRadius = 8;
    rect.fills = [{ type: "IMAGE", imageHash: img.hash, scaleMode: "FILL" }];
    card.appendChild(rect);

    let y = rect.height + 40;
    const t1 = text(card, c.step, { size: 20, bold: true, width: CARD_W - 32 });
    t1.x = 16; t1.y = y; y += t1.height + 12;

    const tone = TONE[c.tone] || TONE.warn;
    const pill = figma.createFrame();
    pill.name = "health";
    pill.x = 16; pill.y = y;
    pill.resize(110, 28);
    pill.cornerRadius = 14;
    pill.fills = [{ type: "SOLID", color: hex(tone.bg) }];
    pill.strokes = [{ type: "SOLID", color: hex(tone.fg) }];
    card.appendChild(pill);
    const pt = text(pill, c.health, { size: 12, color: tone.fg });
    pt.x = 10; pt.y = 6;
    y += 44;

    for (const n of c.notes) {
      const t = text(card, "· " + n, { size: 14, color: "#c9d6cf", width: CARD_W - 32, lineHeight: 165 });
      t.x = 16; t.y = y;
      y += t.height + 10;
    }
    } catch (err) {
      const msg = "⚠ 卡片 " + (i + 1) + " 失败：" + (err && err.message ? err.message : String(err));
      const et = text(card, msg, { size: 13, color: "#f87171", width: CARD_W - 32, lineHeight: 160 });
      et.x = 16; et.y = 16;
    }
  }

  figma.currentPage.selection = [root];
  figma.viewport.scrollAndZoomIntoView([root]);
  figma.notify("审计板已生成 ✓");
  figma.closePlugin();
}

main().catch((e) => {
  console.error(e && e.stack ? e.stack : e);
  figma.notify("生成失败：" + (e && e.message ? e.message : String(e)), { error: true, timeout: 15000 });
  figma.closePlugin();
});
`;

writeFileSync(join(root, 'code.js'), code);
console.log('code.js 已生成：', Math.round(code.length / 1024), 'KB，图片', Object.keys(images).length, '张');
