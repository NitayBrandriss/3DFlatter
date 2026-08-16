import type { MeshModel } from "../mesh/types";
import type { CutStroke, Vec3 } from "./types";
import {
  findExitEdgeAtPoint,
  incidentFaces,
  thirdVertexOnFace,
} from "./cutSurfaceWalk";
import {
  distSq,
  snapEpsilonForMesh,
  surfaceEpsilonForMesh,
} from "./vec3";
import { WorkingMesh, type PointLocation } from "./workingMesh";

function cloneVec3(p: Vec3): Vec3 {
  return { x: p.x, y: p.y, z: p.z };
}

function pushDedupe(path: Vec3[], p: Vec3, epsSq: number): void {
  const last = path[path.length - 1];
  if (last && distSq(last, p) <= epsSq) return;
  path.push(cloneVec3(p));
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

function sharesIncidentFace(
  working: WorkingMesh,
  locA: PointLocation,
  locB: PointLocation,
): boolean {
  const facesB = incidentFaces(working, locB);
  if (facesB.length === 0) return false;
  const setB = new Set(facesB);
  for (const fi of incidentFaces(working, locA)) {
    if (setB.has(fi)) return true;
  }
  return false;
}

/**
 * Read-only surface path between two on-surface points (display / preview).
 * If the walk cannot reach `p1` on the surface, keep the last on-surface
 * sample — never a straight chord through the volume (POLYCUT-C-001).
 */
export function tessellateSurfaceSegment(
  mesh: MeshModel,
  p0: Vec3,
  p1: Vec3,
): Vec3[] {
  const eps = snapEpsilonForMesh(mesh);
  const epsSq = eps * eps;
  if (distSq(p0, p1) <= epsSq) return [cloneVec3(p0)];

  const working = new WorkingMesh(
    mesh,
    new Set(),
    eps,
    surfaceEpsilonForMesh(mesh),
  );

  const loc0 = working.locate(p0);
  const loc1 = working.locate(p1);
  if (loc0.kind === "none") {
    return [cloneVec3(p0)];
  }

  const path: Vec3[] = [cloneVec3(p0)];
  let current = cloneVec3(p0);
  let currentLoc: PointLocation = loc0;
  let prev: number | null = null;
  const maxHops = Math.max(8, working.faces.length * 2 + 4);

  const finishIfOnFace = (): Vec3[] => {
    if (loc1.kind !== "none" && sharesIncidentFace(working, currentLoc, loc1)) {
      pushDedupe(path, p1, epsSq);
    }
    return path;
  };

  for (let hop = 0; hop < maxHops; hop++) {
    if (distSq(current, p1) <= epsSq) {
      pushDedupe(path, p1, epsSq);
      return path;
    }

    const exit = findExitEdgeAtPoint(working, current, currentLoc, p1, prev);
    if (!exit) {
      return finishIfOnFace();
    }

    pushDedupe(path, exit.hitPoint, epsSq);

    if (distSq(exit.hitPoint, p1) <= epsSq) {
      pushDedupe(path, p1, epsSq);
      return path;
    }

    prev = prevAfterHop(working, currentLoc, exit.faceIndex, exit.a, exit.b);
    current = exit.hitPoint;
    currentLoc = working.locate(current);
    if (currentLoc.kind === "none") {
      return path;
    }
  }

  return finishIfOnFace();
}

/** Dense surface path for an entire cut stroke (canonical mesh space). */
export function tessellateCutStroke(mesh: MeshModel, stroke: CutStroke): Vec3[] {
  if (stroke.points.length === 0) return [];
  if (stroke.points.length === 1) return [cloneVec3(stroke.points[0]!)];

  const out: Vec3[] = [];
  for (let i = 0; i < stroke.points.length - 1; i++) {
    const segment = tessellateSurfaceSegment(
      mesh,
      stroke.points[i]!,
      stroke.points[i + 1]!,
    );
    for (let j = 0; j < segment.length; j++) {
      if (j === 0 && out.length > 0) continue;
      out.push(segment[j]!);
    }
  }
  return out;
}
