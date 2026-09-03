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

function recordExit(
  working: WorkingMesh,
  exit: { a: number; b: number; faceIndex: number },
  edges: Set<EdgeKey>,
  faces: Set<FaceIndex>,
): void {
  edges.add(makeEdgeKey(exit.a, exit.b));
  faces.add(exit.faceIndex);
  for (const fi of working.faceIndicesWithEdge(exit.a, exit.b)) {
    faces.add(fi);
  }
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
 */
export function traceSurfaceSegmentFences(
  mesh: MeshModel,
  p0: Vec3,
  p1: Vec3,
): StrokeSurfaceTrace {
  const exitEdges = new Set<EdgeKey>();
  const faces = new Set<FaceIndex>();
  const eps = snapEpsilonForMesh(mesh);
  const epsSq = eps * eps;

  const working = new WorkingMesh(
    mesh,
    new Set(),
    eps,
    surfaceEpsilonForMesh(mesh),
  );
  const loc0 = working.locate(p0);
  const loc1 = working.locate(p1);
  if (loc0.kind === "none") {
    return { exitEdges, faces };
  }

  if (distSq(p0, p1) <= epsSq) {
    recordLocationFaces(working, loc0, faces);
    return { exitEdges, faces };
  }

  let current = cloneVec3(p0);
  let currentLoc: PointLocation = loc0;
  let prev: number | null = null;
  const maxHops = Math.min(
    MAX_SURFACE_TESSELLATE_HOPS,
    Math.max(8, working.faces.length * 2 + 4),
  );
  let hopped = false;

  for (let hop = 0; hop < maxHops; hop++) {
    if (distSq(current, p1) <= epsSq) break;

    const exit = findExitEdgeAtPoint(working, current, currentLoc, p1, prev);
    if (!exit) break;

    hopped = true;
    recordExit(working, exit, exitEdges, faces);

    if (distSq(exit.hitPoint, p1) <= epsSq) break;

    prev = prevAfterHop(working, currentLoc, exit.faceIndex, exit.a, exit.b);
    current = exit.hitPoint;
    currentLoc = locAfterExit(working, exit);
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

  return { exitEdges, faces };
}

/** Concatenate segment traces for a full stroke polyline. */
export function traceStrokeFences(
  mesh: MeshModel,
  stroke: CutStroke,
): StrokeSurfaceTrace {
  const exitEdges = new Set<EdgeKey>();
  const faces = new Set<FaceIndex>();
  if (stroke.points.length === 0) return { exitEdges, faces };
  if (stroke.points.length === 1) {
    return traceSurfaceSegmentFences(mesh, stroke.points[0]!, stroke.points[0]!);
  }

  for (let i = 0; i < stroke.points.length - 1; i++) {
    const part = traceSurfaceSegmentFences(
      mesh,
      stroke.points[i]!,
      stroke.points[i + 1]!,
    );
    for (const key of part.exitEdges) exitEdges.add(key);
    for (const fi of part.faces) faces.add(fi);
  }
  return { exitEdges, faces };
}

/**
 * Virtual flood seams from committed overlay strokes (ADR 0101).
 * Does not call `materializeCutStrokes`.
 */
export function fenceEdgesFromStrokes(
  mesh: MeshModel,
  strokes: readonly CutStroke[],
): FenceFromStrokesResult {
  const fenceEdges = new Set<EdgeKey>();
  const blockerFaces = new Set<FaceIndex>();
  const warnings: string[] = [];

  for (const stroke of strokes) {
    const trace = traceStrokeFences(mesh, stroke);
    for (const key of trace.exitEdges) fenceEdges.add(key);
    for (const fi of trace.faces) blockerFaces.add(fi);

    if (trace.exitEdges.size === 0 && trace.faces.size > 0) {
      warnings.push(
        `Cut stroke "${stroke.id}" has no exit edges; fence is approximate (blocked faces only).`,
      );
    }
  }

  return { fenceEdges, blockerFaces, warnings };
}
