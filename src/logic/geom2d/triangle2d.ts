import type { Bbox2d } from "../mesh/types";
import type { Segment2d } from "./segment2d";
import { pointOnSegment } from "./segment2d";
import { DEGEN_AREA_EPS, SAT_EPS } from "./tolerances";
import type { Vec2 } from "./vec2";

export type { Vec2 };

/** Three vertices in CCW or CW order. */
export type Triangle2d = readonly [Vec2, Vec2, Vec2];

export function triangleSignedArea(tri: Triangle2d): number {
  const [a, b, c] = tri;
  return 0.5 * ((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
}

/** Return CCW-ordered copy; CW input is reversed so clipping half-planes face inward. */
export function normalizeTriangleCCW(tri: Triangle2d): Triangle2d {
  if (triangleSignedArea(tri) < 0) {
    return [tri[0], tri[2], tri[1]] as Triangle2d;
  }
  return tri;
}

export function isDegenerateTriangle(tri: Triangle2d): boolean {
  return Math.abs(triangleSignedArea(tri)) < DEGEN_AREA_EPS;
}

export function triangleAabb(tri: Triangle2d): Bbox2d {
  const [a, b, c] = tri;
  return {
    minX: Math.min(a.x, b.x, c.x),
    minY: Math.min(a.y, b.y, c.y),
    maxX: Math.max(a.x, b.x, c.x),
    maxY: Math.max(a.y, b.y, c.y),
  };
}

export function aabbsSeparated(a: Bbox2d, b: Bbox2d, eps = SAT_EPS): boolean {
  return (
    a.maxX < b.minX - eps ||
    b.maxX < a.minX - eps ||
    a.maxY < b.minY - eps ||
    b.maxY < a.minY - eps
  );
}

function edgeNormal(ax: number, ay: number, bx: number, by: number): Vec2 | null {
  const ex = bx - ax;
  const ey = by - ay;
  const len = Math.sqrt(ex * ex + ey * ey);
  if (len < SAT_EPS) return null;
  return { x: -ey / len, y: ex / len };
}

function axesParallel(a: Vec2, b: Vec2, eps = SAT_EPS): boolean {
  const cross = Math.abs(a.x * b.y - a.y * b.x);
  return cross <= eps;
}

/** Perpendicular axes for SAT (unique up to parallelism). */
export function triangleAxes(tri: Triangle2d): Vec2[] {
  const axes: Vec2[] = [];
  const verts = tri;
  for (let i = 0; i < 3; i++) {
    const a = verts[i]!;
    const b = verts[(i + 1) % 3]!;
    const n = edgeNormal(a.x, a.y, b.x, b.y);
    if (!n) continue;
    if (!axes.some((existing) => axesParallel(existing, n))) {
      axes.push(n);
    }
  }
  return axes;
}

export function projectTriangleOntoAxis(
  tri: Triangle2d,
  axis: Vec2,
): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (const v of tri) {
    const p = v.x * axis.x + v.y * axis.y;
    if (p < min) min = p;
    if (p > max) max = p;
  }
  return { min, max };
}

function intervalsSeparated(
  a: { min: number; max: number },
  b: { min: number; max: number },
  eps = SAT_EPS,
): boolean {
  return a.min > b.max + eps || b.min > a.max + eps;
}

/** Collect unique SAT axes from both triangles (up to 6). */
export function satAxesForPair(t1: Triangle2d, t2: Triangle2d): Vec2[] {
  const axes: Vec2[] = [];
  for (const n of [...triangleAxes(t1), ...triangleAxes(t2)]) {
    if (!axes.some((existing) => axesParallel(existing, n))) {
      axes.push(n);
    }
  }
  return axes;
}

/** 2D SAT overlap test for two triangles. */
export function satOverlap(t1: Triangle2d, t2: Triangle2d, eps = SAT_EPS): boolean {
  if (isDegenerateTriangle(t1) || isDegenerateTriangle(t2)) return false;
  const aabb1 = triangleAabb(t1);
  const aabb2 = triangleAabb(t2);
  if (aabbsSeparated(aabb1, aabb2, eps)) return false;

  for (const axis of satAxesForPair(t1, t2)) {
    const p1 = projectTriangleOntoAxis(t1, axis);
    const p2 = projectTriangleOntoAxis(t2, axis);
    if (intervalsSeparated(p1, p2, eps)) return false;
  }
  return true;
}

function cross2(ax: number, ay: number, bx: number, by: number): number {
  return ax * by - ay * bx;
}

/** Inside half-plane left of directed edge (a→b) for CCW clipping polygon. */
function insideHalfPlane(
  p: Vec2,
  edgeStart: Vec2,
  edgeEnd: Vec2,
  eps = SAT_EPS,
): boolean {
  const ex = edgeEnd.x - edgeStart.x;
  const ey = edgeEnd.y - edgeStart.y;
  return cross2(ex, ey, p.x - edgeStart.x, p.y - edgeStart.y) >= -eps;
}

/** Line-segment intersection for Sutherland–Hodgman; null when nearly parallel. */
function intersectSegments(
  p1: Vec2,
  p2: Vec2,
  edgeStart: Vec2,
  edgeEnd: Vec2,
): Vec2 | null {
  const r = { x: p2.x - p1.x, y: p2.y - p1.y };
  const s = { x: edgeEnd.x - edgeStart.x, y: edgeEnd.y - edgeStart.y };
  const denom = cross2(r.x, r.y, s.x, s.y);
  if (Math.abs(denom) < SAT_EPS) {
    return null;
  }
  const t = cross2(edgeStart.x - p1.x, edgeStart.y - p1.y, s.x, s.y) / denom;
  return { x: p1.x + t * r.x, y: p1.y + t * r.y };
}

/** Sutherland–Hodgman clip of `subject` against convex CCW `clip` triangle. */
export function clipPolygonByTriangle(subject: Vec2[], clip: Triangle2d): Vec2[] {
  const clipCCW = normalizeTriangleCCW(clip);
  let output = subject.slice();
  for (let i = 0; i < 3; i++) {
    if (output.length === 0) return [];
    const edgeStart = clipCCW[i]!;
    const edgeEnd = clipCCW[(i + 1) % 3]!;
    const input = output;
    output = [];
    for (let j = 0; j < input.length; j++) {
      const current = input[j]!;
      const previous = input[(j + input.length - 1) % input.length]!;
      const currInside = insideHalfPlane(current, edgeStart, edgeEnd);
      const prevInside = insideHalfPlane(previous, edgeStart, edgeEnd);
      if (currInside) {
        if (!prevInside) {
          const hit = intersectSegments(previous, current, edgeStart, edgeEnd);
          if (hit) output.push(hit);
        }
        output.push(current);
      } else if (prevInside) {
        const hit = intersectSegments(previous, current, edgeStart, edgeEnd);
        if (hit) output.push(hit);
      }
    }
  }
  return output;
}

/** Intersection polygon of two triangles (may be empty). */
export function clipTriangleIntersection(t1: Triangle2d, t2: Triangle2d): Vec2[] {
  if (!satOverlap(t1, t2)) return [];
  const subject = normalizeTriangleCCW(t1);
  const clip = normalizeTriangleCCW(t2);
  return clipPolygonByTriangle([...subject], clip);
}

function polygonArea(verts: Vec2[]): number {
  if (verts.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < verts.length; i++) {
    const a = verts[i]!;
    const b = verts[(i + 1) % verts.length]!;
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) * 0.5;
}

export function polygonCentroid(verts: Vec2[]): Vec2 {
  if (verts.length === 0) return { x: 0, y: 0 };
  let cx = 0;
  let cy = 0;
  let area2 = 0;
  for (let i = 0; i < verts.length; i++) {
    const a = verts[i]!;
    const b = verts[(i + 1) % verts.length]!;
    const cross = a.x * b.y - b.x * a.y;
    area2 += cross;
    cx += (a.x + b.x) * cross;
    cy += (a.y + b.y) * cross;
  }
  if (Math.abs(area2) < DEGEN_AREA_EPS) {
    let sx = 0;
    let sy = 0;
    for (const v of verts) {
      sx += v.x;
      sy += v.y;
    }
    return { x: sx / verts.length, y: sy / verts.length };
  }
  const f = 1 / (3 * area2);
  return { x: cx * f, y: cy * f };
}

/** Intersection area of two overlapping triangles. */
export function clipTriangleArea(t1: Triangle2d, t2: Triangle2d): number {
  const poly = clipTriangleIntersection(t1, t2);
  return polygonArea(poly);
}

/** Barycentric strict interior test (excludes boundary within eps). */
export function pointInTriangleStrict(
  p: Vec2,
  tri: Triangle2d,
  eps = SAT_EPS,
): boolean {
  const [a, b, c] = tri;
  const denom =
    (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);
  if (Math.abs(denom) < DEGEN_AREA_EPS) return false;
  const wA =
    ((b.y - c.y) * (p.x - c.x) + (c.x - b.x) * (p.y - c.y)) / denom;
  const wB =
    ((c.y - a.y) * (p.x - c.x) + (a.x - c.x) * (p.y - c.y)) / denom;
  const wC = 1 - wA - wB;
  return wA > eps && wB > eps && wC > eps;
}

/**
 * When triangles share a 3D edge mapped to `sharedSegment`, reject collision if
 * overlap is marginal and all intersection vertices lie on the shared segment.
 */
export function isEdgeOnlyContact(
  overlapPolygon: Vec2[],
  sharedSegment: Segment2d,
  overlapArea: number,
  areaThreshold: number,
  eps = SAT_EPS,
): boolean {
  if (overlapArea <= areaThreshold) return true;
  if (overlapPolygon.length === 0) return true;
  return overlapPolygon.every((v) => pointOnSegment(v.x, v.y, sharedSegment, eps));
}

/** Average 2D edge length of a triangle. */
export function triangleAvgEdgeLength(tri: Triangle2d): number {
  const [a, b, c] = tri;
  const e0 = Math.hypot(b.x - a.x, b.y - a.y);
  const e1 = Math.hypot(c.x - b.x, c.y - b.y);
  const e2 = Math.hypot(a.x - c.x, a.y - c.y);
  return (e0 + e1 + e2) / 3;
}
