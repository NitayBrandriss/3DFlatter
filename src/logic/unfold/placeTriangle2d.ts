import { SAT_EPS } from "../geom2d/tolerances";
import type { Vec2 } from "../geom2d/vec2";
import type { MeshModel, VertexIndex } from "../mesh/types";

/** Numeric tolerance — re-export of geom2d `SAT_EPS` (single source of truth). */
export const EPS = SAT_EPS;

export type { Vec2 };

export type PlacementResult =
  | { ok: true; point: Vec2 }
  | { ok: false; reason: string };

export type RootTriangleResult =
  | { ok: true; v0: Vec2; v1: Vec2; v2: Vec2 }
  | { ok: false; reason: string };

/** Read canonical xyz from packed MeshModel.vertices. */
export function readVertex3d(mesh: MeshModel, vi: VertexIndex): Vec2 & { z: number } {
  const base = 3 * vi;
  return {
    x: mesh.vertices[base]!,
    y: mesh.vertices[base + 1]!,
    z: mesh.vertices[base + 2]!,
  };
}

/** Euclidean distance between two mesh vertices in 3D. */
export function distance3d(mesh: MeshModel, va: VertexIndex, vb: VertexIndex): number {
  const a = readVertex3d(mesh, va);
  const b = readVertex3d(mesh, vb);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/** Twice the signed triangle area in 2D; positive => CCW winding (a → b → c). */
export function signedArea2d(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
): number {
  return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
}

/**
 * Intersect two circles in 2D: center A radius rA, center B radius rB.
 * Returns both candidate points (symmetric across line AB) or an error.
 *
 * Discriminant is clamped to >= 0 so float drift cannot produce NaN from sqrt.
 */
export function circleIntersection2d(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  rA: number,
  rB: number,
): { ok: true; p1: Vec2; p2: Vec2 } | { ok: false; reason: string } {
  const dx = bx - ax;
  const dy = by - ay;
  const d = Math.sqrt(dx * dx + dy * dy);

  if (d < EPS) {
    return { ok: false, reason: "Circle centers coincide." };
  }

  if (d > rA + rB + EPS) {
    return { ok: false, reason: "Circles too far apart (triangle inequality violated)." };
  }

  if (d < Math.abs(rA - rB) - EPS) {
    return { ok: false, reason: "One circle contains the other (degenerate hinge)." };
  }

  const a = (rA * rA - rB * rB + d * d) / (2 * d);
  const hSq = Math.max(0, rA * rA - a * a);
  const h = Math.sqrt(hSq);

  const mx = ax + (a * dx) / d;
  const my = ay + (a * dy) / d;

  const px = (-dy * h) / d;
  const py = (dx * h) / d;

  return {
    ok: true,
    p1: { x: mx + px, y: my + py },
    p2: { x: mx - px, y: my - py },
  };
}

/**
 * Pick the circle-intersection candidate that yields a CCW triangle (a → b → c).
 * Used for hinge unfolding: the shared edge a→b is already placed; c is the new corner.
 */
export function pickCCWCandidate(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  p1: Vec2,
  p2: Vec2,
): PlacementResult {
  const area1 = signedArea2d(ax, ay, bx, by, p1.x, p1.y);
  const area2 = signedArea2d(ax, ay, bx, by, p2.x, p2.y);

  if (area1 > EPS && area2 > EPS) {
    return { ok: true, point: area1 >= area2 ? p1 : p2 };
  }
  if (area1 > EPS) return { ok: true, point: p1 };
  if (area2 > EPS) return { ok: true, point: p2 };

  return { ok: false, reason: "Neither circle-intersection branch is CCW." };
}

/**
 * Place a root triangle in the XY plane.
 *
 * Hinge math: anchor v0 at origin, place v1 on +X at the 3D edge length |v0v1|,
 * then locate v2 by circle intersection (radii |v0v2| and |v1v2| from 3D).
 * Branch selection matches `mesh.faces` winding (CCW or CW), not a forced global CCW.
 */
export function placeRootTriangleCCW(
  mesh: MeshModel,
  v0: VertexIndex,
  v1: VertexIndex,
  v2: VertexIndex,
): RootTriangleResult {
  const len01 = distance3d(mesh, v0, v1);
  const len02 = distance3d(mesh, v0, v2);
  const len12 = distance3d(mesh, v1, v2);

  if (len01 < EPS) {
    return { ok: false, reason: "Degenerate root edge (v0 ≈ v1)." };
  }

  const origin: Vec2 = { x: 0, y: 0 };
  const onX: Vec2 = { x: len01, y: 0 };

  const hit = circleIntersection2d(origin.x, origin.y, onX.x, onX.y, len02, len12);
  if (!hit.ok) return { ok: false, reason: hit.reason };

  const area1 = signedArea2d(origin.x, origin.y, onX.x, onX.y, hit.p1.x, hit.p1.y);
  const area2 = signedArea2d(origin.x, origin.y, onX.x, onX.y, hit.p2.x, hit.p2.y);

  if (area1 > EPS) return { ok: true, v0: origin, v1: onX, v2: hit.p1 };
  if (area2 > EPS) return { ok: true, v0: origin, v1: onX, v2: hit.p2 };
  if (area1 < -EPS) return { ok: true, v0: origin, v1: onX, v2: hit.p1 };
  if (area2 < -EPS) return { ok: true, v0: origin, v1: onX, v2: hit.p2 };

  const picked = pickCCWCandidate(origin.x, origin.y, onX.x, onX.y, hit.p1, hit.p2);
  if (!picked.ok) return { ok: false, reason: picked.reason };

  return { ok: true, v0: origin, v1: onX, v2: picked.point };
}
