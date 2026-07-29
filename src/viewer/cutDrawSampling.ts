export const CUT_DRAW_MIN_SAMPLE_DIST_SQ = 0.015 * 0.015;
export const CUT_DRAW_MAX_STROKE_POINTS = 512;

export type Vec3Like = { x: number; y: number; z: number };

/** Whether a new cut sample should be appended (display space). */
export function shouldAppendCutSample(
  prev: Vec3Like | undefined,
  next: Vec3Like,
  minDistSq = CUT_DRAW_MIN_SAMPLE_DIST_SQ,
): boolean {
  if (!prev) return true;
  const dx = next.x - prev.x;
  const dy = next.y - prev.y;
  const dz = next.z - prev.z;
  return dx * dx + dy * dy + dz * dz >= minDistSq;
}

export function isAtCutStrokePointCap(
  count: number,
  max = CUT_DRAW_MAX_STROKE_POINTS,
): boolean {
  return count >= max;
}
