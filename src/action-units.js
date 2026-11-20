const ACTION_BOUNDARY = /[，,；;。！？!?]/g;

const trimSpan = (raw, start, end) => {
  const source = raw.slice(start, end);
  const leading = source.match(/^\s*/)?.[0].length || 0;
  const trailing = source.match(/\s*$/)?.[0].length || 0;
  const actualStart = start + leading;
  const actualEnd = Math.max(actualStart, end - trailing);
  const sourceText = raw.slice(actualStart, actualEnd);
  return {
    start: actualStart,
    end: actualEnd,
    source: sourceText,
    text: sourceText.replace(/^△\s*/, "").trim(),
  };
};

/**
 * 按标点把一条动作原文切成可追溯的动作微单元。
 * 这里只建立索引，不改剧本文本；所有 start/end 都对应原字符串。
 */
export function splitActionUnitText(raw) {
  const source = String(raw ?? "");
  const spans = [];
  let cursor = 0;
  for (const match of source.matchAll(ACTION_BOUNDARY)) {
    const end = (match.index || 0) + match[0].length;
    spans.push(trimSpan(source, cursor, end));
    cursor = end;
  }
  if (cursor < source.length) spans.push(trimSpan(source, cursor, source.length));

  const units = [];
  for (const span of spans) {
    if (!span.text && units.length) {
      const previous = units.at(-1);
      previous.end = span.end;
      previous.source += span.source;
      continue;
    }
    if (!span.text) continue;
    units.push(span);
  }
  return units.length ? units : [trimSpan(source, 0, source.length)];
}

export function buildActionUnits(raw, blockId) {
  return splitActionUnitText(raw).map((unit, index) => ({
    id: `${blockId}.${index + 1}`,
    blockId,
    start: unit.start,
    end: unit.end,
    text: unit.text,
    source: unit.source,
  }));
}
