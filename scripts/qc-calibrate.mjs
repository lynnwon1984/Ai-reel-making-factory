// 用一个已有产出做质检校准：把同一份输入跑两遍，测一致性并落盘。
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parseQc, countByLevel } from "../src/qc.js";

const ROOT = process.cwd();
const PROMPT = readFileSync(join(ROOT, "src/prompts/qc-storyboard.md"), "utf8");
const ART = readdirSync(join(ROOT, "runs/artifacts")).find((f) => f.includes("分镜-第1-3集"));
const art = JSON.parse(readFileSync(join(ROOT, "runs/artifacts", ART), "utf8"));
// 有的 artifact 把 input 二次转义了，先还原
if (typeof art.input === "string" && art.input.trimStart().startsWith('"')) {
  try { art.input = JSON.parse(art.input); } catch (e) { /* 保持原样 */ }
}

const splitEps = (t) => {
  const parts = String(t || "").split(/\n(?=第\s*\d+\s*集)/).map((s) => s.trim()).filter(Boolean);
  return parts.map((p) => ({ no: Number((p.match(/第\s*(\d+)\s*集/) || [])[1] || 0), text: p }));
};

const srcAll = splitEps(art.input).filter((e) => e.no >= 1 && e.no <= 3);
const outAll = splitEps(art.output);

import http from "node:http";
function post(body) {
  return new Promise((resolve, reject) => {
    const data = Buffer.from(JSON.stringify(body));
    const req = http.request(
      { host: "127.0.0.1", port: 4190, path: "/api/chat", method: "POST",
        headers: { "content-type": "application/json", "content-length": data.length } },
      (res) => {
        let buf = "";
        res.setEncoding("utf8");
        res.on("data", (d) => (buf += d));
        res.on("end", () => resolve(buf));
      },
    );
    req.on("error", reject);
    req.end(data);
  });
}

async function callQc(src, sb, label) {
  const raw = await post({
    instructions: PROMPT,
    input: `【本集原始剧本】\n${src}\n\n【生成的分镜头剧本】\n${sb}`,
    effort: "low",
    label,
  });
  let text = "";
  for (const frame of raw.split("\n\n")) {
    const line = frame.split("\n").find((l) => l.startsWith("data:"));
    if (!line) continue;
    try {
      const ev = JSON.parse(line.slice(5).trim());
      if (ev.t === "text") text += ev.d;
      if (ev.t === "error") throw new Error(ev.message);
    } catch (e) { /* skip */ }
  }
  return text;
}

const sig = (it) => `${it.where}|${it.rule}`;
const rounds = Number(process.argv[2] || 1);
const out = [];
for (const ep of outAll) {
  const src = srcAll.find((s) => s.no === ep.no);
  if (!src) continue;
  for (let r = 1; r <= rounds; r += 1) {
    const reply = await callQc(src.text, ep.text, `校准 第${ep.no}集 v1 r${r}`);
    const issues = parseQc(reply);
    out.push({ ep: ep.no, round: r, issues, rawLen: reply.length });
    writeFileSync(
      join(ROOT, `runs/qc-calib/ep${ep.no}-r${r}.json`),
      JSON.stringify({ ep: ep.no, round: r, issues, reply }, null, 2),
    );
    console.log(`EP${ep.no} r${r}: ${issues.length} 条 ${JSON.stringify(countByLevel(issues))}`);
    for (const it of issues.slice(0, 4)) console.log(`  · [${it.level}] ${it.where} | ${it.rule}`);
  }
}

if (rounds >= 2) {
  for (const ep of outAll) {
    const a = out.find((x) => x.ep === ep.no && x.round === 1)?.issues || [];
    const b = out.find((x) => x.ep === ep.no && x.round === 2)?.issues || [];
    const sa = new Set(a.map(sig));
    const sb = new Set(b.map(sig));
    const inter = [...sa].filter((x) => sb.has(x)).length;
    const union = new Set([...sa, ...sb]).size || 1;
    console.log(`EP${ep.no} 重合：${inter}/${union} = ${(inter / union * 100).toFixed(0)}%`);
  }
}
