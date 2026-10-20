import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

const UPSTREAM = "https://api.deepseek.com/responses";
const MODEL = "deepseek-flash";

function readKey(root) {
  const file = path.join(root, ".env");
  if (existsSync(file)) {
    const hit = readFileSync(file, "utf8").match(
      /^\s*DEEPSEEK_API_KEY\s*=\s*(.+?)\s*$/m,
    );
    if (hit) return hit[1].replace(/^["']|["']$/g, "");
  }
  return process.env.DEEPSEEK_API_KEY || "";
}

function send(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function writeRunLog(root, entry) {
  try {
    const dir = path.join(root, "runs");
    mkdirSync(dir, { recursive: true });
    appendFileSync(path.join(dir, "runs.jsonl"), `${JSON.stringify(entry)}\n`);
  } catch {
    /* 日志写不了不影响主流程 */
  }
}

/** 文件名里不能出现的字符统统换掉 */
export function safeSlug(text) {
  return (
    String(text || "run")
      .replace(/[\\/:*?"<>|\s]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "run"
  );
}

/**
 * 把这一次调用的「完整输入 + 完整输出」原样落盘。
 *
 * 为什么值得占这点磁盘：模型不是常量，它会自己漂。
 * 没有原始输出，就攒不出回归样本 —— 而回归样本是唯一能告诉你"模型什么时候变了"的东西。
 * 每跑一次自动攒一份，测试库自己会长大，不需要专门设计采集实验。
 */
export function writeArtifact(root, entry, instructions, input, output) {
  try {
    const dir = path.join(root, "runs", "artifacts");
    mkdirSync(dir, { recursive: true });
    const name = `${entry.at.replace(/[:.]/g, "-")}-${safeSlug(entry.label)}.json`;
    writeFileSync(
      path.join(dir, name),
      JSON.stringify({ ...entry, instructions, input, output }, null, 2),
    );
    return `runs/artifacts/${name}`;
  } catch {
    return "";
  }
}

const num = (value) => (typeof value === "number" ? value : "?");

async function readBody(req) {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  return raw;
}

/**
 * 本地开发中间件：POST /api/chat
 * 浏览器只发 {instructions, input}，Key 全程留在服务端。
 * 上游 SSE 会被归一化成 {t:"reason"|"text"|"done"|"error"} 再转发。
 */
export function apiMiddleware(root) {
  return async function handle(req, res, next) {
    if (!req.url || !req.url.startsWith("/api/chat")) return next();

    if (req.method !== "POST") {
      res.statusCode = 405;
      res.end();
      return;
    }

    const key = readKey(root);
    if (!key) {
      res.statusCode = 500;
      res.setHeader("content-type", "application/json; charset=utf-8");
      res.end(
        JSON.stringify({
          error: "缺少 DEEPSEEK_API_KEY：请在项目根目录的 .env 里配置",
        }),
      );
      return;
    }

    let body;
    try {
      body = JSON.parse((await readBody(req)) || "{}");
    } catch {
      res.statusCode = 400;
      res.setHeader("content-type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ error: "请求体不是合法 JSON" }));
      return;
    }

    const {
      instructions = "",
      input = "",
      effort = "low",
      maxOutputTokens = 64000,
      label = "",
      runId = "",
    } = body;

    const startedAt = Date.now();
    const inputChars = instructions.length + input.length;

    res.statusCode = 200;
    res.setHeader("content-type", "text/event-stream; charset=utf-8");
    res.setHeader("cache-control", "no-cache, no-transform");
    res.setHeader("connection", "keep-alive");
    if (typeof res.flushHeaders === "function") res.flushHeaders();

    try {
      const upstream = await fetch(UPSTREAM, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: MODEL,
          instructions,
          input,
          max_output_tokens: maxOutputTokens,
          reasoning: { effort },
          stream: true,
        }),
      });

      if (!upstream.ok || !upstream.body) {
        const detail = await upstream.text().catch(() => "");
        send(res, {
          t: "error",
          message: `上游返回 ${upstream.status}：${detail.slice(0, 400)}`,
        });
        res.end();
        return;
      }

      const reader = upstream.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let chars = 0;
      let out = "";
      let reasoningChars = 0;
      let status = "completed";
      let usage = null;

      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";

        for (const frame of frames) {
          const line = frame
            .split("\n")
            .find((item) => item.startsWith("data:"));
          if (!line) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;

          let event;
          try {
            event = JSON.parse(payload);
          } catch {
            continue;
          }

          if (event.type === "response.output_text.delta" && event.delta) {
            chars += event.delta.length;
            out += event.delta;
            send(res, { t: "text", d: event.delta });
          } else if (
            event.type === "response.reasoning_text.delta" &&
            event.delta
          ) {
            reasoningChars += event.delta.length;
            send(res, { t: "reason", n: reasoningChars });
          } else if (
            event.type === "response.completed" ||
            event.type === "response.incomplete" ||
            event.type === "response.failed"
          ) {
            status = event.type.replace("response.", "");
            usage = event.response?.usage ?? usage;
          }
        }
      }

      const entry = {
        at: new Date().toISOString(),
        runId,
        label,
        ms: Date.now() - startedAt,
        status,
        inputChars,
        outputChars: chars,
        reasoningChars,
        model: MODEL,
        effort,
        usage,
      };
      entry.artifact = writeArtifact(root, entry, instructions, input, out);
      writeRunLog(root, entry);

      const inTok = num(usage?.input_tokens);
      const outTok = num(usage?.output_tokens);
      const thinkTok = num(usage?.output_tokens_details?.reasoning_tokens);
      const cachedTok = num(usage?.input_tokens_details?.cached_tokens);
      console.log(
        `[run] ${label || "(no label)"} | ${entry.ms}ms | 输出${chars}字 | in=${inTok} out=${outTok} 思考=${thinkTok} 缓存命中=${cachedTok} | ${status}`,
      );

      send(res, { t: "done", status, usage, chars, ms: entry.ms });
      res.end();
    } catch (error) {
      send(res, { t: "error", message: String(error?.message || error) });
      res.end();
    }
  };
}
