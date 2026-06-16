import type { EdgeKey, VertexIndex } from "./types";

/** Build a stable undirected edge key from two vertex indices (sorted min,max). */
export function makeEdgeKey(a: VertexIndex, b: VertexIndex): EdgeKey {
  return (a < b ? `${a},${b}` : `${b},${a}`) as EdgeKey;
}
