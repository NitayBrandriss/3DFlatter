import type { Vec3 } from "./types";
import {
  barycentric,
  cross,
  dot,
  lerp,
  normalize,
  scale,
  sub,
} from "./vec3";
import { BARY_SLACK, PARAM_EPS } from "./vec3";
import type { PointLocation, WorkingMesh } from "./workingMesh";

type Vec2 = { x: number; y: number };

export type FaceFrame = {
  origin: Vec3;
  u: Vec3;
  v: Vec3;
  normal: Vec3;
};

export type SurfaceExitEdge = {
  a: number;
  b: number;
  t: number;
  hitPoint: Vec3;
  faceIndex: number;
};

/**
 * Among faces incident to `current`, find the opposite-edge intersection with
 * the surface-walk chord current→goal that has the smallest forward parameter.
 * Uses face-local 2D clip + plane projection (ADR 0100), not 3D proximity.
 */
export function findExitEdgeSurfaceWalk(
  working: WorkingMesh,
  current: number,
  goal: Vec3,
  prev: number | null,
): { a: number; b: number; t: number } | null {
  const origin = working.getVertex(current);
  const exit = findExitEdgeAtPoint(
    working,
    origin,
    { kind: "vertex", vi: current },
    goal,
    prev,
  );
  if (!exit) return null;
  return { a: exit.a, b: exit.b, t: exit.t };
}

/**
 * Read-only exit-edge discovery from an arbitrary on-surface point (preview path).
 */
export function findExitEdgeAtPoint(
  working: WorkingMesh,
  current: Vec3,
  loc: PointLocation,
  goal: Vec3,
  prev: number | null,
): SurfaceExitEdge | null {
  let best: (SurfaceExitEdge & { tSeg: number }) | null = null;
  const incident = incidentFaces(working, loc);

  for (const fi of incident) {
    const frame = buildFaceFrameAtPoint(working, fi, current);
    const goal2d = mapGoalToFacePlane(working, fi, goal, frame);
    if (!goal2d) continue;

    const origin2d = to2d(current, frame);
    const [x, y, z] = working.faces[fi]!;

    for (const [u, v] of [
      [x, y],
      [y, z],
      [z, x],
    ] as const) {
      if (loc.kind === "vertex" && (u === loc.vi || v === loc.vi)) continue;
      if (prev !== null && (u === prev || v === prev)) continue;

      const hit = segment2dIntersect(
        origin2d,
        goal2d,
        to2d(working.getVertex(u), frame),
        to2d(working.getVertex(v), frame),
      );
      if (!hit) continue;
      if (hit.tSeg <= PARAM_EPS || hit.tSeg > 1 + PARAM_EPS) continue;
      if (hit.tEdge < -PARAM_EPS || hit.tEdge > 1 + PARAM_EPS) continue;

      const t = Math.max(PARAM_EPS, Math.min(1 - PARAM_EPS, hit.tEdge));
      const hitPoint = lerp(working.getVertex(u), working.getVertex(v), t);
      if (best === null || hit.tSeg < best.tSeg) {
        best = { a: u, b: v, t, hitPoint, faceIndex: fi, tSeg: hit.tSeg };
      }
    }
  }

  if (!best) return null;
  return {
    a: best.a,
    b: best.b,
    t: best.t,
    hitPoint: best.hitPoint,
    faceIndex: best.faceIndex,
  };
}

export function incidentFaces(
  working: WorkingMesh,
  loc: PointLocation,
): readonly number[] {
  if (loc.kind === "vertex") return working.facesOfVertex(loc.vi);
  if (loc.kind === "edge") return working.faceIndicesWithEdge(loc.a, loc.b);
  if (loc.kind === "face") return [loc.faceIndex];
  return [];
}

export function buildFaceFrameAtPoint(
  working: WorkingMesh,
  faceIndex: number,
  origin: Vec3,
): FaceFrame {
  const [ia, ib, ic] = working.faces[faceIndex]!;
  const a = working.getVertex(ia);
  const b = working.getVertex(ib);
  const c = working.getVertex(ic);
  const uRaw = sub(b, a);
  const wRaw = sub(c, a);
  const u = normalize(uRaw)!;
  const normal = normalize(cross(uRaw, wRaw))!;
  const v = normalize(cross(normal, u))!;

  return { origin, u, v, normal };
}

function to2d(p: Vec3, frame: FaceFrame): Vec2 {
  const d = sub(p, frame.origin);
  return { x: dot(d, frame.u), y: dot(d, frame.v) };
}

function faceNormal(working: WorkingMesh, faceIndex: number): Vec3 | null {
  const [ia, ib, ic] = working.faces[faceIndex]!;
  const a = working.getVertex(ia);
  const b = working.getVertex(ib);
  const c = working.getVertex(ic);
  return normalize(cross(sub(b, a), sub(c, a)));
}

function pointOnFace(
  working: WorkingMesh,
  faceIndex: number,
  p: Vec3,
): boolean {
  const [ia, ib, ic] = working.faces[faceIndex]!;
  const bary = barycentric(
    p,
    working.getVertex(ia),
    working.getVertex(ib),
    working.getVertex(ic),
  );
  if (!bary) return false;
  const { u, v, w } = bary;
  const slack = BARY_SLACK;
  if (u < -slack || v < -slack || w < -slack) return false;
  const n = faceNormal(working, faceIndex);
  if (!n) return false;
  const planeOrigin = working.getVertex(ia);
  const planeDist = Math.abs(dot(sub(p, planeOrigin), n));
  return planeDist <= working.surfaceEps;
}

/** Map goal into face F's plane as 2D coords in `frame`. */
function mapGoalToFacePlane(
  working: WorkingMesh,
  faceIndex: number,
  goal: Vec3,
  frame: FaceFrame,
): Vec2 | null {
  if (pointOnFace(working, faceIndex, goal)) {
    return to2d(goal, frame);
  }

  const projected = projectToPlane(goal, frame.origin, frame.normal);
  return to2d(projected, frame);
}

function projectToPlane(p: Vec3, origin: Vec3, normal: Vec3): Vec3 {
  const ap = sub(p, origin);
  const dist = dot(ap, normal);
  return sub(p, scale(normal, dist));
}

function segment2dIntersect(
  a: Vec2,
  b: Vec2,
  c: Vec2,
  d: Vec2,
): { tSeg: number; tEdge: number } | null {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const cdx = d.x - c.x;
  const cdy = d.y - c.y;
  const denom = abx * cdy - aby * cdx;
  if (Math.abs(denom) < 1e-30) return null;

  const acx = c.x - a.x;
  const acy = c.y - a.y;
  const tSeg = (acx * cdy - acy * cdx) / denom;
  const tEdge = (acx * aby - acy * abx) / denom;
  return { tSeg, tEdge };
}

/** Vertex of triangle face not on edge (u,v). */
export function thirdVertexOnFace(
  working: WorkingMesh,
  faceIndex: number,
  u: number,
  v: number,
): number | null {
  const [a, b, c] = working.faces[faceIndex]!;
  if (a !== u && a !== v) return a;
  if (b !== u && b !== v) return b;
  if (c !== u && c !== v) return c;
  return null;
}
