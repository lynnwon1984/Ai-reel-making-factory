export function flattenText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

export function bigramSimilarity(a, b) {
  const grams = (value) => {
    const text = flattenText(value);
    const out = new Set();
    for (let index = 0; index < text.length - 1; index += 1) {
      out.add(text.slice(index, index + 2));
    }
    return out;
  };
  const left = grams(a);
  const right = grams(b);
  if (!left.size || !right.size) return 0;
  let intersection = 0;
  for (const gram of left) {
    if (right.has(gram)) intersection += 1;
  }
  return intersection / (left.size + right.size - intersection);
}
