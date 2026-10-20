/**
 * 与本地代理通信：浏览器只发 instructions / input，Key 不经过前端。
 * 服务端把上游 SSE 归一化成 { t: "reason" | "text" | "done" | "error" }。
 */
export async function runStream({
  instructions,
  input,
  effort = "low",
  label = "",
  runId = "",
  onReason,
  onText,
  signal,
}) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ instructions, input, effort, label, runId }),
    signal,
  });

  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    throw new Error(detail || `请求失败（HTTP ${res.status}）`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  let status = "completed";
  let usage = null;

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";

    for (const frame of frames) {
      const line = frame.split("\n").find((item) => item.startsWith("data:"));
      if (!line) continue;

      let event;
      try {
        event = JSON.parse(line.slice(5).trim());
      } catch {
        continue;
      }

      if (event.t === "text") {
        text += event.d;
        onText?.(event.d);
      } else if (event.t === "reason") {
        onReason?.(event.n);
      } else if (event.t === "done") {
        status = event.status;
        usage = event.usage;
      } else if (event.t === "error") {
        throw new Error(event.message);
      }
    }
  }

  return { text, status, usage };
}
