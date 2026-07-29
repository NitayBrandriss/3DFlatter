import { isIndexDegenerateFace } from "../mesh/faceDegeneracy";
import { makeEdgeKey } from "../mesh/edgeKey";
import type { MeshModel } from "../mesh/types";
import { readV } from "./cutTestFixtures";

export function faceArea3(mesh: MeshModel, fi: number): number {
  const a = readV(mesh, mesh.faces[3 * fi]!);
  const b = readV(mesh, mesh.faces[3 * fi + 1]!);
  const c = readV(mesh, mesh.faces[3 * fi + 2]!);
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const abz = b.z - a.z;
  const acx = c.x - a.x;
  const acy = c.y - a.y;
  const acz = c.z - a.z;
  const cx = aby * acz - abz * acy;
  const cy = abz * acx - abx * acz;
  const cz = abx * acy - aby * acx;
  return 0.5 * Math.hypot(cx, cy, cz);
}

export function totalArea(mesh: MeshModel): number {
  let s = 0;
  for (let fi = 0; fi < mesh.faceCount; fi++) s += faceArea3(mesh, fi);
  return s;
}

export function hasIndexDegenerateFaces(mesh: MeshModel): boolean {
  for (let fi = 0; fi < mesh.faceCount; fi++) {
    const a = mesh.faces[3 * fi]!;
    const b = mesh.faces[3 * fi + 1]!;
    const c = mesh.faces[3 * fi + 2]!;
    if (isIndexDegenerateFace(a, b, c)) return true;
  }
  return false;
}

export function maxEdgeIncidence(mesh: MeshModel): number {
  const counts = new Map<string, number>();
  for (let fi = 0; fi < mesh.faceCount; fi++) {
    const a = mesh.faces[3 * fi]!;
    const b = mesh.faces[3 * fi + 1]!;
    const c = mesh.faces[3 * fi + 2]!;
    for (const key of [makeEdgeKey(a, b), makeEdgeKey(b, c), makeEdgeKey(c, a)]) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  let max = 0;
  for (const n of counts.values()) if (n > max) max = n;
  return max;
}

export function seamEdgesExistOnMesh(mesh: MeshModel, seams: Set<string>): boolean {
  const present = new Set<string>();
  for (let fi = 0; fi < mesh.faceCount; fi++) {
    const a = mesh.faces[3 * fi]!;
    const b = mesh.faces[3 * fi + 1]!;
    const c = mesh.faces[3 * fi + 2]!;
    present.add(makeEdgeKey(a, b));
    present.add(makeEdgeKey(b, c));
    present.add(makeEdgeKey(c, a));
  }
  for (const s of seams) {
    if (!present.has(s)) return false;
  }
  return true;
}
