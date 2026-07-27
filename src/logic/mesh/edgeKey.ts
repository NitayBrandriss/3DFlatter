import type { EdgeKey, VertexIndex } from "./types";

/** Build a stable undirected edge key from two vertex indices (sorted min,max). */
export function makeEdgeKey(a: VertexIndex, b: VertexIndex): EdgeKey {
  return (a < b ? `${a},${b}` : `${b},${a}`) as EdgeKey;
}

/** Inverse of `makeEdgeKey` — parse `"a,b"` into vertex indices (not re-sorted). */
export function parseEdgeKey(key: EdgeKey): [VertexIndex, VertexIndex] {
  const comma = key.indexOf(",");
  const a = Number.parseInt(key.slice(0, comma), 10);
  const b = Number.parseInt(key.slice(comma + 1), 10);
  return [a, b];
}
