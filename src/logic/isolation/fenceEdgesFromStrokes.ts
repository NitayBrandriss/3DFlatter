import { makeEdgeKey } from "../mesh/edgeKey";
import type { EdgeKey, FaceIndex, MeshModel } from "../mesh/types";
import {
  findExitEdgeAtPoint,
  incidentFaces,
  thirdVertexOnFace,
} from "../cuts/cutSurfaceWalk";
import { MAX_SURFACE_TESSELLATE_HOPS } from "../cuts/surfacePath";
import type { CutStroke, Vec3 } from "../cuts/types";
import { distSq, snapEpsilonForMesh, surfaceEpsilonForMesh } from "../cuts/vec3";
import { WorkingMesh, type PointLocation } from "../cuts/workingMesh";
import type { FenceFromStrokesResult } from "./types";

export type StrokeSurfaceTrace = {
  exitEdges: Set<EdgeKey>;
  faces: Set<FaceIndex>;
  warnings: string[];
};

function cloneVec3(p: Vec3): Vec3 {
  return { x: p.x, y: p.y, z: p.z };
}

function prevAfterHop(
  working: WorkingMesh,
  loc: PointLocation,
  exitFaceIndex: number,
  exitA: number,
  exitB: number,
): number | null {
  if (loc.kind === "vertex") return loc.vi;
  return thirdVertexOnFace(working, exitFaceIndex, exitA, exitB);
}

function locAfterExit(
  working: WorkingMesh,
  exit: { a: number; b: number; t: number; hitPoint: Vec3 },
): PointLocation {
  if (distSq(exit.hitPoint, working.getVertex(exit.a)) <= working.epsSq) {
    return { kind: "vertex", vi: exit.a };
  }
  if (distSq(exit.hitPoint, working.getVertex(exit.b)) <= working.epsSq) {
    return { kind: "vertex", vi: exit.b };
  }
  return { kind: "edge", a: exit.a, b: exit.b, t: exit.t };
}

/** Record exit edge + walked face only (not dual neighbor — ISO-S1-004). */
function recordExit(
  exit: { a: number; b: number; faceIndex: number },
  edges: Set<EdgeKey>,
  faces: Set<FaceIndex>,
): void {
  edges.add(makeEdgeKey(exit.a, exit.b));
  faces.add(exit.faceIndex);
}

/**
 * When a segment rides a mesh edge (vertex-ring bracelet), record that
 * EdgeKey — findExitEdgeAtPoint skips edges incident to a vertex origin.
 */
function recordOnEdgeSegment(
  working: WorkingMesh,
  loc0: PointLocation,
  loc1: PointLocation,
  edges: Set<EdgeKey>,
  faces: Set<FaceIndex>,
): boolean {
  let a: number | null = null;
  let b: number | null = null;

  if (loc0.kind === "vertex" && loc1.kind === "vertex") {
    a = loc0.vi;
    b = loc1.vi;
  } else if (loc0.kind === "edge" && loc1.kind === "edge") {
    const k0 = makeEdgeKey(loc0.a, loc0.b);
    const k1 = makeEdgeKey(loc1.a, loc1.b);
    if (k0 === k1) {
      a = loc0.a;
      b = loc0.b;
    }
  } else if (loc0.kind === "vertex" && loc1.kind === "edge") {
    if (loc1.a === loc0.vi || loc1.b === loc0.vi) {
      a = loc1.a;
      b = loc1.b;
    }
  } else if (loc0.kind === "edge" && loc1.kind === "vertex") {
    if (loc0.a === loc1.vi || loc0.b === loc1.vi) {
      a = loc0.a;
      b = loc0.b;
    }
  }

  if (a === null || b === null || a === b) return false;
  if (!working.hasEdge(a, b)) return false;

  edges.add(makeEdgeKey(a, b));
  for (const fi of working.faceIndicesWithEdge(a, b)) {
    // Walked-face set for classify — only the faces of this edge; hybrid
    // still does not put them in blockerFaces when exits exist.
    faces.add(fi);
  }
  return true;
}

function recordLocationFaces(
  working: WorkingMesh,
  loc: PointLocation,
  faces: Set<FaceIndex>,
): void {
  for (const fi of incidentFaces(working, loc)) {
    faces.add(fi);
  }
}

/**
 * Read-only surface walk for one segment: crossed `EdgeKey`s and faces.
 * Reuses `findExitEdgeAtPoint` (ADR 0101) — does not materialize.
 *
 * ISO-S1-013: hop helpers (`prevAfterHop` / `locAfterExit` / hop cap) mirror
 * `tessellateSurfaceSegment` in surfacePath.ts; full shared walker is parked
 * (path samples vs exit edges/faces diverge enough that a merge is non-trivial).
 */
export function traceSurfaceSegmentFences(
  working: WorkingMesh,
  p0: Vec3,
  p1: Vec3,
  strokeId?: string,
): StrokeSurfaceTrace {
  const exitEdges = new Set<EdgeKey>();
  const faces = new Set<FaceIndex>();
  const warnings: string[] = [];
  const epsSq = working.epsSq;
  const label = strokeId ? `Cut stroke "${strokeId}"` : "Cut stroke";

  const loc0 = working.locate(p0);
  const loc1 = working.locate(p1);
  if (loc0.kind === "none") {
    warnings.push(`${label}: segment start is off-surface (locate none).`);
    return { exitEdges, faces, warnings };
  }
  if (loc1.kind === "none") {
    warnings.push(`${label}: segment end is off-surface (locate none).`);
  }

  if (distSq(p0, p1) <= epsSq) {
    recordLocationFaces(working, loc0, faces);
    return { exitEdges, faces, warnings };
  }

  // Vertex-ring / edge-riding segment: record the mesh edge as a fence key.
  if (recordOnEdgeSegment(working, loc0, loc1, exitEdges, faces)) {
    return { exitEdges, faces, warnings };
  }

  let current = cloneVec3(p0);
  let currentLoc: PointLocation = loc0;
  let prev: number | null = null;
  const maxHops = Math.min(
    MAX_SURFACE_TESSELLATE_HOPS,
    Math.max(8, working.faces.length * 2 + 4),
  );
  let hopped = false;
  let hopExhausted = false;

  for (let hop = 0; hop < maxHops; hop++) {
    if (distSq(current, p1) <= epsSq) break;

    const exit = findExitEdgeAtPoint(working, current, currentLoc, p1, prev);
    if (!exit) break;

    hopped = true;
    recordExit(exit, exitEdges, faces);

    if (distSq(exit.hitPoint, p1) <= epsSq) break;

    prev = prevAfterHop(working, currentLoc, exit.faceIndex, exit.a, exit.b);
    current = exit.hitPoint;
    currentLoc = locAfterExit(working, exit);

    if (hop === maxHops - 1 && distSq(current, p1) > epsSq) {
      hopExhausted = true;
    }
  }

  if (hopExhausted) {
    warnings.push(
      `${label}: surface walk hit hop cap; fence may be gapped.`,
    );
  }

  if (!hopped) {
    recordLocationFaces(working, loc0, faces);
    if (loc1.kind !== "none") {
      const loc1Faces = new Set(incidentFaces(working, loc1));
      for (const fi of incidentFaces(working, loc0)) {
        if (loc1Faces.has(fi)) faces.add(fi);
      }
    }
  } else if (loc1.kind !== "none") {
    const loc1Faces = new Set(incidentFaces(working, loc1));
    for (const fi of incidentFaces(working, currentLoc)) {
      if (loc1Faces.has(fi)) faces.add(fi);
    }
  }

  return { exitEdges, faces, warnings };
}

/** Concatenate segment traces for a full stroke polyline (one WorkingMesh). */
export function traceStrokeFences(
  mesh: MeshModel,
  stroke: CutStroke,
  working?: WorkingMesh,
): StrokeSurfaceTrace {
  const exitEdges = new Set<EdgeKey>();
  const faces = new Set<FaceIndex>();
  const warnings: string[] = [];
  if (stroke.points.length === 0) return { exitEdges, faces, warnings };

  const wm =
    working ??
    new WorkingMesh(
      mesh,
      new Set(),
      snapEpsilonForMesh(mesh),
      surfaceEpsilonForMesh(mesh),
    );

  if (stroke.points.length === 1) {
    return traceSurfaceSegmentFences(
      wm,
      stroke.points[0]!,
      stroke.points[0]!,
      stroke.id,
    );
  }

  for (let i = 0; i < stroke.points.length - 1; i++) {
    const part = traceSurfaceSegmentFences(
      wm,
      stroke.points[i]!,
      stroke.points[i + 1]!,
      stroke.id,
    );
    for (const key of part.exitEdges) exitEdges.add(key);
    for (const fi of part.faces) faces.add(fi);
    for (const w of part.warnings) warnings.push(w);
  }
  return { exitEdges, faces, warnings };
}

/**
 * Virtual flood seams from committed overlay strokes (ADR 0101).
 * Does not call `materializeCutStrokes`.
 * Hybrid: blockers only when a stroke has no exit edges (fallback).
 */
export function fenceEdgesFromStrokes(
  mesh: MeshModel,
  strokes: readonly CutStroke[],
): FenceFromStrokesResult {
  const fenceEdges = new Set<EdgeKey>();
  const blockerFaces = new Set<FaceIndex>();
  const walkedFaces = new Set<FaceIndex>();
  const warnings: string[] = [];

  const working =
    strokes.length > 0
      ? new WorkingMesh(
          mesh,
          new Set(),
          snapEpsilonForMesh(mesh),
          surfaceEpsilonForMesh(mesh),
        )
      : null;

  for (const stroke of strokes) {
    const trace = traceStrokeFences(mesh, stroke, working ?? undefined);
    for (const key of trace.exitEdges) fenceEdges.add(key);
    for (const fi of trace.faces) walkedFaces.add(fi);
    for (const w of trace.warnings) warnings.push(w);

    if (trace.exitEdges.size === 0 && trace.faces.size > 0) {
      for (const fi of trace.faces) blockerFaces.add(fi);
      warnings.push(
        `Cut stroke "${stroke.id}" has no exit edges; fence is approximate (blocked faces only).`,
      );
    } else if (
      stroke.points.length > 0 &&
      trace.exitEdges.size === 0 &&
      trace.faces.size === 0
    ) {
      warnings.push(
        `Cut stroke "${stroke.id}" produced an empty fence (no exits, no faces).`,
      );
    }
  }

  return { fenceEdges, blockerFaces, walkedFaces, warnings };
}
