import { SAT_EPS } from "./tolerances";
import type { Vec2 } from "./vec2";

export type { Vec2 };

export type Segment2d = {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
};

export function segmentLength(seg: Segment2d): number {
  const dx = seg.x1 - seg.x0;
  const dy = seg.y1 - seg.y0;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Cross-product collinearity threshold scaled by reference segment length². */
function collinearCrossThreshold(lenSq: number, eps = SAT_EPS): number {
  return Math.max(eps * eps, eps * lenSq);
}

/** Squared distance from point to closed segment. */
export function pointToSegmentDistanceSq(
  px: number,
  py: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): number {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < SAT_EPS * SAT_EPS) {
    const ox = px - x0;
    const oy = py - y0;
    return ox * ox + oy * oy;
  }
  const t = Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / lenSq));
  const qx = x0 + t * dx;
  const qy = y0 + t * dy;
  const ox = px - qx;
  const oy = py - qy;
  return ox * ox + oy * oy;
}

export function pointToSegmentDistance(
  px: number,
  py: number,
  seg: Segment2d,
): number {
  return Math.sqrt(
    pointToSegmentDistanceSq(px, py, seg.x0, seg.y0, seg.x1, seg.y1),
  );
}

/** Minimum distance between two closed segments. */
export function segmentSegmentDistance(a: Segment2d, b: Segment2d): number {
  const candidates = [
    pointToSegmentDistanceSq(a.x0, a.y0, b.x0, b.y0, b.x1, b.y1),
    pointToSegmentDistanceSq(a.x1, a.y1, b.x0, b.y0, b.x1, b.y1),
    pointToSegmentDistanceSq(b.x0, b.y0, a.x0, a.y0, a.x1, a.y1),
    pointToSegmentDistanceSq(b.x1, b.y1, a.x0, a.y0, a.x1, a.y1),
  ];
  return Math.sqrt(Math.min(...candidates));
}

/** Unit direction of segment a→b, or null if degenerate. */
export function segmentDirection(x0: number, y0: number, x1: number, y1: number): Vec2 | null {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < SAT_EPS) return null;
  return { x: dx / len, y: dy / len };
}

/** Absolute angle between segment directions in [0, π/2]. */
export function segmentParallelAngle(a: Segment2d, b: Segment2d): number {
  const da = segmentDirection(a.x0, a.y0, a.x1, a.y1);
  const db = segmentDirection(b.x0, b.y0, b.x1, b.y1);
  if (!da || !db) return 0;
  const dot = Math.abs(da.x * db.x + da.y * db.y);
  return Math.acos(Math.min(1, dot));
}

/** True when both segments lie on the same infinite line (scale-aware eps). */
export function areCollinear(a: Segment2d, b: Segment2d, eps = SAT_EPS): boolean {
  const dx = a.x1 - a.x0;
  const dy = a.y1 - a.y0;
  const lenSq = dx * dx + dy * dy;
  const thresh = collinearCrossThreshold(lenSq, eps);
  const cross0 = dx * (b.y0 - a.y0) - dy * (b.x0 - a.x0);
  const cross1 = dx * (b.y1 - a.y0) - dy * (b.x1 - a.x0);
  return Math.abs(cross0) <= thresh && Math.abs(cross1) <= thresh;
}

/**
 * 1D interval overlap length after projecting both segments onto the line of `a`.
 * Returns 0 when not collinear.
 */
export function collinearIntervalOverlap(a: Segment2d, b: Segment2d, eps = SAT_EPS): number {
  if (!areCollinear(a, b, eps)) return 0;
  const dir = segmentDirection(a.x0, a.y0, a.x1, a.y1);
  if (!dir) return 0;
  const project = (x: number, y: number) => (x - a.x0) * dir.x + (y - a.y0) * dir.y;
  const a0 = 0;
  const a1 = project(a.x1, a.y1);
  const b0 = project(b.x0, b.y0);
  const b1 = project(b.x1, b.y1);
  const aMin = Math.min(a0, a1);
  const aMax = Math.max(a0, a1);
  const bMin = Math.min(b0, b1);
  const bMax = Math.max(b0, b1);
  return Math.max(0, Math.min(aMax, bMax) - Math.max(aMin, bMin));
}

/** True when point lies within eps of the closed segment. */
export function pointOnSegment(
  px: number,
  py: number,
  seg: Segment2d,
  eps = SAT_EPS,
): boolean {
  return pointToSegmentDistance(px, py, seg) <= eps;
}
