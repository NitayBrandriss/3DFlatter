import { expect } from "vitest";
import type {
  EdgeSlot,
  FaceIndex,
  MeshModel,
  Topology,
  UnfoldIslandResult,
  UnfoldMeshResult,
} from "../mesh/types";
import { getNeighborAcrossEdge } from "../mesh/types";
import { EPS, distance3d, signedArea2d } from "./placeTriangle2d";

type IslandSoup = {
  faces: readonly FaceIndex[];
  positions2d: Float32Array;
};

export function distance2d(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): number {
  const dx = x1 - x0;
  const dy = y1 - y0;
  return Math.sqrt(dx * dx + dy * dy);
}

export function getFace2d(result: IslandSoup, indexInResult: number): Float32Array {
  const off = 6 * indexInResult;
  return result.positions2d.subarray(off, off + 6);
}

export function assertTriangleCCW(face2d: Float32Array): void {
  const area = signedArea2d(
    face2d[0]!,
    face2d[1]!,
    face2d[2]!,
    face2d[3]!,
    face2d[4]!,
    face2d[5]!,
  );
  expect(area).toBeGreaterThan(EPS);
}

export function assertTriangleEdgeLengthsPreserved(
  mesh: MeshModel,
  faceId: FaceIndex,
  face2d: Float32Array,
  eps = 1e-4,
): void {
  const base = 3 * faceId;
  const v0 = mesh.faces[base]!;
  const v1 = mesh.faces[base + 1]!;
  const v2 = mesh.faces[base + 2]!;

  const d01 = distance3d(mesh, v0, v1);
  const d12 = distance3d(mesh, v1, v2);
  const d20 = distance3d(mesh, v2, v0);

  const d01_2d = distance2d(face2d[0]!, face2d[1]!, face2d[2]!, face2d[3]!);
  const d12_2d = distance2d(face2d[2]!, face2d[3]!, face2d[4]!, face2d[5]!);
  const d20_2d = distance2d(face2d[4]!, face2d[5]!, face2d[0]!, face2d[1]!);

  expect(Math.abs(d01_2d - d01)).toBeLessThan(eps);
  expect(Math.abs(d12_2d - d12)).toBeLessThan(eps);
  expect(Math.abs(d20_2d - d20)).toBeLessThan(eps);
}

function findFaceIndexInResult(result: IslandSoup, faceId: FaceIndex): number {
  const idx = result.faces.indexOf(faceId);
  expect(idx).toBeGreaterThanOrEqual(0);
  return idx;
}

function cornerForVertex(
  face2d: Float32Array,
  mesh: MeshModel,
  faceId: FaceIndex,
  vi: number,
): [number, number] {
  const base = 3 * faceId;
  for (let i = 0; i < 3; i++) {
    if (mesh.faces[base + i] === vi) {
      return [face2d[2 * i]!, face2d[2 * i + 1]!];
    }
  }
  throw new Error(`Vertex ${vi} not on face ${faceId}`);
}

export function assertSharedEdgeMatches(
  mesh: MeshModel,
  result: UnfoldIslandResult,
  faceA: FaceIndex,
  slotA: EdgeSlot,
  faceB: FaceIndex,
  slotB: EdgeSlot,
  eps = 1e-4,
): void {
  const idxA = findFaceIndexInResult(result, faceA);
  const idxB = findFaceIndexInResult(result, faceB);
  const soupA = getFace2d(result, idxA);
  const soupB = getFace2d(result, idxB);

  const baseA = 3 * faceA;
  const vertsA = [mesh.faces[baseA]!, mesh.faces[baseA + 1]!, mesh.faces[baseA + 2]!];
  const edgeA =
    slotA === 0
      ? [vertsA[0], vertsA[1]]
      : slotA === 1
        ? [vertsA[1], vertsA[2]]
        : [vertsA[2], vertsA[0]];

  const baseB = 3 * faceB;
  const vertsB = [mesh.faces[baseB]!, mesh.faces[baseB + 1]!, mesh.faces[baseB + 2]!];
  const edgeB =
    slotB === 0
      ? [vertsB[0], vertsB[1]]
      : slotB === 1
        ? [vertsB[1], vertsB[2]]
        : [vertsB[2], vertsB[0]];

  const [aA, bA] = edgeA as [number, number];
  const [aB, bB] = edgeB as [number, number];

  const pA0 = cornerForVertex(soupA, mesh, faceA, aA);
  const pA1 = cornerForVertex(soupA, mesh, faceA, bA);
  const pB0 = cornerForVertex(soupB, mesh, faceB, aB);
  const pB1 = cornerForVertex(soupB, mesh, faceB, bB);

  const matchDirect =
    distance2d(pA0[0], pA0[1], pB0[0], pB0[1]) < eps &&
    distance2d(pA1[0], pA1[1], pB1[0], pB1[1]) < eps;
  const matchSwap =
    distance2d(pA0[0], pA0[1], pB1[0], pB1[1]) < eps &&
    distance2d(pA1[0], pA1[1], pB0[0], pB0[1]) < eps;

  expect(matchDirect || matchSwap).toBe(true);
}

function slotTowardNeighbor(
  topology: Topology,
  faceId: FaceIndex,
  targetNeighbor: FaceIndex,
): EdgeSlot {
  for (const slot of [0, 1, 2] as EdgeSlot[]) {
    if (getNeighborAcrossEdge(topology, faceId, slot) === targetNeighbor) {
      return slot;
    }
  }
  throw new Error(`No edge from face ${faceId} to neighbor ${targetNeighbor}`);
}

/**
 * Assert shared-edge soup coords match along the unfold BFS tree (parent → child).
 * Only tree edges are guaranteed to align; sibling faces may duplicate the same
 * 3D vertex at different 2D positions until a future global layout pass.
 */
export function assertUnfoldTreeHingesMatch(
  mesh: MeshModel,
  topo: Topology,
  islandFaces: FaceIndex[],
  result: UnfoldIslandResult,
): void {
  const islandSet = new Set(islandFaces);
  const rootFaceId = islandFaces[0]!;
  const unfolded = new Set<FaceIndex>([rootFaceId]);
  const queue: FaceIndex[] = [rootFaceId];
  let treeEdgeCount = 0;

  while (queue.length > 0) {
    const faceId = queue.shift()!;

    for (const slot of [0, 1, 2] as EdgeSlot[]) {
      const neighbor = getNeighborAcrossEdge(topo, faceId, slot);
      if (neighbor === null || !islandSet.has(neighbor) || unfolded.has(neighbor)) {
        continue;
      }

      const slotB = slotTowardNeighbor(topo, neighbor, faceId);
      assertSharedEdgeMatches(mesh, result, faceId, slot, neighbor, slotB);
      treeEdgeCount++;

      unfolded.add(neighbor);
      queue.push(neighbor);
    }
  }

  expect(treeEdgeCount).toBe(islandFaces.length - 1);
}

/** ADR 0002 soup: length 6F, finite coords, 3D edge lengths preserved in 2D. */
export function assertUnfoldMeshSoupInvariants(
  result: UnfoldMeshResult,
  mesh: MeshModel,
  eps = 1e-4,
): void {
  expect(result.error).toBeUndefined();
  for (const island of result.islands) {
    expect(island.positions2d).toHaveLength(6 * island.faces.length);
    expect(island.positions2d.every((v) => Number.isFinite(v))).toBe(true);
    for (let i = 0; i < island.faces.length; i++) {
      assertTriangleEdgeLengthsPreserved(
        mesh,
        island.faces[i]!,
        getFace2d(island, i),
        eps,
      );
    }
  }
}
