/**
 * Index-degenerate triangle: two or more corners share the same vertex index.
 * Shared by weld, topology, and island partition (LOGIC-001 / LOGIC-003).
 */
export function isIndexDegenerateFace(v0: number, v1: number, v2: number): boolean {
  return v0 === v1 || v1 === v2 || v2 === v0;
}
