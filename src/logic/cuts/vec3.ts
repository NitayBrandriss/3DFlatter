import { WELD_EPSILON } from "../geom2d/tolerances";
import type { MeshModel } from "../mesh/types";
import type { Vec3 } from "./types";

export function vec3(x: number, y: number, z: number): Vec3 {
  return { x, y, z };
}

export function readVertex(positions: ArrayLike<number>, vi: number): Vec3 {
  const base = 3 * vi;
  return { x: positions[base]!, y: positions[base + 1]!, z: positions[base + 2]! };
}

export function distSq(a: Vec3, b: Vec3): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
}

export function dist(a: Vec3, b: Vec3): number {
  return Math.sqrt(distSq(a, b));
}

export function lerp(a: Vec3, b: Vec3, t: number): Vec3 {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
  };
}

export function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function scale(a: Vec3, s: number): Vec3 {
  return { x: a.x * s, y: a.y * s, z: a.z * s };
}

export function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

export function length(a: Vec3): number {
  return Math.sqrt(dot(a, a));
}

export function normalize(a: Vec3): Vec3 | null {
  const len = length(a);
  if (len < WELD_EPSILON) return null;
  return scale(a, 1 / len);
}

/** Closest point on segment ab to p; returns point and t in [0,1]. */
export function closestOnSegment(
  p: Vec3,
  a: Vec3,
  b: Vec3,
): { point: Vec3; t: number; distSq: number } {
  const ab = sub(b, a);
  const lenSq = dot(ab, ab);
  if (lenSq < WELD_EPSILON * WELD_EPSILON) {
    return { point: a, t: 0, distSq: distSq(p, a) };
  }
  let t = dot(sub(p, a), ab) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const point = lerp(a, b, t);
  return { point, t, distSq: distSq(p, point) };
}

/** Barycentric weights (u,v,w) for p w.r.t. triangle abc. */
export function barycentric(
  p: Vec3,
  a: Vec3,
  b: Vec3,
  c: Vec3,
): { u: number; v: number; w: number } | null {
  const v0 = sub(b, a);
  const v1 = sub(c, a);
  const v2 = sub(p, a);
  const d00 = dot(v0, v0);
  const d01 = dot(v0, v1);
  const d11 = dot(v1, v1);
  const d20 = dot(v2, v0);
  const d21 = dot(v2, v1);
  const denom = d00 * d11 - d01 * d01;
  // Relative degeneracy: absolute WELD² rejects valid tiny triangles
  const scale = Math.max(d00 * d11, d00 * d00, d11 * d11, Number.EPSILON);
  if (Math.abs(denom) <= Math.max(Number.EPSILON * scale, 1e-300)) return null;
  const v = (d11 * d20 - d01 * d21) / denom;
  const w = (d00 * d21 - d01 * d20) / denom;
  const u = 1 - v - w;
  return { u, v, w };
}

export function meshBBoxDiagonal(mesh: MeshModel): number {
  const { vertices, vertexCount } = mesh;
  if (vertexCount === 0) return 0;
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < vertexCount; i++) {
    const base = 3 * i;
    const x = vertices[base]!;
    const y = vertices[base + 1]!;
    const z = vertices[base + 2]!;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (z < minZ) minZ = z;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    if (z > maxZ) maxZ = z;
  }
  return Math.hypot(maxX - minX, maxY - minY, maxZ - minZ);
}

/** Scale-aware snap epsilon (ADR 0100). Floor only when bbox is degenerate. */
export function snapEpsilonForMesh(mesh: MeshModel): number {
  const d = meshBBoxDiagonal(mesh);
  if (d <= WELD_EPSILON) return WELD_EPSILON;
  return d * 1e-4;
}

/**
 * On-surface / plane-distance gate (tighter than snap).
 * Relative to bbox so large meshes reject far off-plane samples.
 */
export function surfaceEpsilonForMesh(mesh: MeshModel): number {
  const d = meshBBoxDiagonal(mesh);
  if (d <= WELD_EPSILON) return WELD_EPSILON;
  return Math.max(WELD_EPSILON * 1e-2, d * 1e-6);
}

/** Dimensionless barycentric boundary slack (scale-invariant). */
export const BARY_SLACK = 1e-4;

/** Dimensionless open-interval epsilon for edge split parameters. */
export const PARAM_EPS = 1e-9;
