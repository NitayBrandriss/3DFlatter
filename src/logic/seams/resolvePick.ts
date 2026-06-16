import { makeEdgeKey } from "../mesh/edgeKey";
import type { EdgeKey, EdgeSlot, MeshModel } from "../mesh/types";

export type ResolvedPick = {
  edgeKey: EdgeKey;
  slot: EdgeSlot;
};

function readVertex(
  mesh: MeshModel,
  vi: number,
): { x: number; y: number; z: number } {
  const base = 3 * vi;
  return {
    x: mesh.vertices[base]!,
    y: mesh.vertices[base + 1]!,
    z: mesh.vertices[base + 2]!,
  };
}

function pointToSegmentDistanceSq(
  px: number,
  py: number,
  pz: number,
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
): number {
  const abx = bx - ax;
  const aby = by - ay;
  const abz = bz - az;
  const apx = px - ax;
  const apy = py - ay;
  const apz = pz - az;

  const abLenSq = abx * abx + aby * aby + abz * abz;
  if (abLenSq < 1e-20) {
    return apx * apx + apy * apy + apz * apz;
  }

  let t = (apx * abx + apy * aby + apz * abz) / abLenSq;
  t = Math.max(0, Math.min(1, t));

  const cx = ax + t * abx - px;
  const cy = ay + t * aby - py;
  const cz = az + t * abz - pz;
  return cx * cx + cy * cy + cz * cz;
}

function segmentLengthSq(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const dz = bz - az;
  return dx * dx + dy * dy + dz * dz;
}

const EDGE_SLOTS: readonly [EdgeSlot, number, number][] = [
  [0, 0, 1],
  [1, 1, 2],
  [2, 2, 0],
];

/**
 * Resolve a raycast hit on a triangle to the closest mesh edge.
 * Returns null when the hit is too far from all edges (e.g. face-center click).
 */
export function resolvePick(
  mesh: MeshModel,
  faceIndex: number,
  hitPoint: { x: number; y: number; z: number },
): ResolvedPick | null {
  if (!Number.isInteger(faceIndex) || faceIndex < 0 || faceIndex >= mesh.faceCount) {
    return null;
  }

  const base = 3 * faceIndex;
  const indices = [
    mesh.faces[base]!,
    mesh.faces[base + 1]!,
    mesh.faces[base + 2]!,
  ];

  const verts = indices.map((vi) => readVertex(mesh, vi));
  const { x: px, y: py, z: pz } = hitPoint;

  let bestSlot: EdgeSlot = 0;
  let bestDistSq = Number.POSITIVE_INFINITY;
  let shortestEdgeLenSq = Number.POSITIVE_INFINITY;

  for (const [slot, a, b] of EDGE_SLOTS) {
    const va = verts[a]!;
    const vb = verts[b]!;
    const edgeLenSq = segmentLengthSq(va.x, va.y, va.z, vb.x, vb.y, vb.z);
    shortestEdgeLenSq = Math.min(shortestEdgeLenSq, edgeLenSq);

    const distSq = pointToSegmentDistanceSq(
      px,
      py,
      pz,
      va.x,
      va.y,
      va.z,
      vb.x,
      vb.y,
      vb.z,
    );
    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      bestSlot = slot;
    }
  }

  const threshold = 0.15 * Math.sqrt(shortestEdgeLenSq);
  if (bestDistSq > threshold * threshold) {
    return null;
  }

  const [_, a, b] = EDGE_SLOTS[bestSlot]!;
  const edgeKey = makeEdgeKey(indices[a]!, indices[b]!);
  return { edgeKey, slot: bestSlot };
}
