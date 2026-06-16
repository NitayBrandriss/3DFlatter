import { describe, expect, it } from "vitest";
import { parseObj } from "../io/obj/parseObj";
import { buildTopology } from "../mesh/buildTopology";
import { makeEdgeKey } from "../mesh/edgeKey";
import { partitionIslands } from "../mesh/partitionIslands";
import type {
  EdgeSlot,
  FaceIndex,
  MeshModel,
  Topology,
  UnfoldIslandResult,
} from "../mesh/types";
import { getNeighborAcrossEdge } from "../mesh/types";
import { unweldedIcosahedronObj } from "../io/obj/testMeshes";
import { createSeamRegistry, toggleSeam } from "../seams/seamRegistry";
import { EPS, distance3d, signedArea2d } from "./placeTriangle2d";
import { unfoldIsland } from "./unfoldIsland";

function makeMesh(vertices: number[], faces: number[]): MeshModel {
  return {
    vertices: new Float32Array(vertices),
    faces: new Uint32Array(faces),
    vertexCount: vertices.length / 3,
    faceCount: faces.length / 3,
  };
}

const CUBE_OBJ = `
v -1 -1 -1
v 1 -1 -1
v 1 1 -1
v -1 1 -1
v -1 -1 1
v 1 -1 1
v 1 1 1
v -1 1 1
f 1 2 3
f 1 3 4
f 5 6 7
f 5 7 8
f 1 5 8
f 1 8 4
f 2 6 7
f 2 7 3
f 4 3 7
f 4 7 8
f 1 2 6
f 1 6 5
`;

function distance2d(x0: number, y0: number, x1: number, y1: number): number {
  const dx = x1 - x0;
  const dy = y1 - y0;
  return Math.sqrt(dx * dx + dy * dy);
}

function getFace2d(result: UnfoldIslandResult, indexInResult: number): Float32Array {
  const off = 6 * indexInResult;
  return result.positions2d.subarray(off, off + 6);
}

function assertTriangleCCW(face2d: Float32Array): void {
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

function assertTriangleEdgeLengthsPreserved(
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

function findFaceIndexInResult(result: UnfoldIslandResult, faceId: FaceIndex): number {
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

function assertSharedEdgeMatches(
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
function assertUnfoldTreeHingesMatch(
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

/** Seam the four boundary edges of the top face (z = +1) to detach it from the shell. */
function seamTopFaceFromCube(mesh: MeshModel, topo: ReturnType<typeof buildTopology>) {
  let seams = createSeamRegistry();
  const topEdges = new Set([
    makeEdgeKey(4, 5),
    makeEdgeKey(5, 6),
    makeEdgeKey(6, 7),
    makeEdgeKey(4, 7),
  ]);

  for (const key of topEdges) {
    const incidents = topo.edgeToFaces.get(key);
    expect(incidents?.length).toBe(2);
    seams = toggleSeam(seams, key);
  }

  return seams;
}

describe("unfoldIsland", () => {
  it("unfolds a single triangle with CCW winding and preserved edge lengths", () => {
    const mesh = makeMesh([0, 0, 0, 1, 0, 0, 0, 1, 0], [0, 1, 2]);
    const topo = buildTopology(mesh);
    const result = unfoldIsland(mesh, topo, [0]);

    expect(result.error).toBeUndefined();
    expect(result.faces).toEqual([0]);
    expect(result.positions2d).toHaveLength(6);
    expect(result.positions2d.every((v) => Number.isFinite(v))).toBe(true);

    const face2d = getFace2d(result, 0);
    assertTriangleCCW(face2d);
    assertTriangleEdgeLengthsPreserved(mesh, 0, face2d);
  });

  it("unfolds a diamond (two triangles) with matching shared edge in soup", () => {
    const mesh = makeMesh(
      [0, 0, 0, 1, 0, 0, 0, 1, 0, -1, 0, 0],
      [0, 1, 2, 0, 2, 3],
    );
    const topo = buildTopology(mesh);
    const islands = partitionIslands(mesh, topo, createSeamRegistry());
    expect(islands).toHaveLength(1);

    const result = unfoldIsland(mesh, topo, islands[0]!);
    expect(result.error).toBeUndefined();
    expect(result.faces).toHaveLength(2);
    expect(result.positions2d).toHaveLength(12);

    for (let i = 0; i < result.faces.length; i++) {
      assertTriangleCCW(getFace2d(result, i));
      assertTriangleEdgeLengthsPreserved(mesh, result.faces[i]!, getFace2d(result, i));
    }

    assertSharedEdgeMatches(mesh, result, 0, 2, 1, 0);
  });

  it("unfolds each single-face island when the diamond shared edge is seamed", () => {
    const mesh = makeMesh(
      [0, 0, 0, 1, 0, 0, 0, 1, 0, -1, 0, 0],
      [0, 1, 2, 0, 2, 3],
    );
    const topo = buildTopology(mesh);
    let seams = createSeamRegistry();
    seams = toggleSeam(seams, makeEdgeKey(0, 2));

    const islands = partitionIslands(mesh, topo, seams);
    expect(islands).toHaveLength(2);

    for (const island of islands) {
      const result = unfoldIsland(mesh, topo, island);
      expect(result.error).toBeUndefined();
      expect(result.positions2d).toHaveLength(6);
      assertTriangleCCW(getFace2d(result, 0));
      assertTriangleEdgeLengthsPreserved(mesh, island[0]!, getFace2d(result, 0));
    }
  });

  it("unfolds an open box island after seaming the top face free", () => {
    const { mesh } = parseObj(CUBE_OBJ);
    const topo = buildTopology(mesh);
    const seams = seamTopFaceFromCube(mesh, topo);
    const islands = partitionIslands(mesh, topo, seams);

    expect(islands).toHaveLength(2);
    const openBoxIsland = islands.find((isl) => isl.length === 10);
    expect(openBoxIsland).toBeDefined();

    const result = unfoldIsland(mesh, topo, openBoxIsland!);
    expect(result.error).toBeUndefined();
    expect(result.faces).toHaveLength(10);
    expect(result.positions2d).toHaveLength(60);

    for (let i = 0; i < result.faces.length; i++) {
      assertTriangleEdgeLengthsPreserved(mesh, result.faces[i]!, getFace2d(result, i));
    }

    assertUnfoldTreeHingesMatch(mesh, topo, openBoxIsland!, result);
  });

  it("unfolds a welded icosahedron as one island without errors", () => {
    const { mesh } = parseObj(unweldedIcosahedronObj());
    const topo = buildTopology(mesh);
    const islands = partitionIslands(mesh, topo, createSeamRegistry());

    expect(islands).toHaveLength(1);
    expect(islands[0]).toHaveLength(20);

    const result = unfoldIsland(mesh, topo, islands[0]!);
    expect(result.error).toBeUndefined();
    expect(result.faces).toHaveLength(20);
    expect(result.positions2d).toHaveLength(120);
    expect(result.positions2d.every((v) => Number.isFinite(v))).toBe(true);

    for (let i = 0; i < result.faces.length; i++) {
      assertTriangleEdgeLengthsPreserved(mesh, result.faces[i]!, getFace2d(result, i));
    }

    assertUnfoldTreeHingesMatch(mesh, topo, islands[0]!, result);
  });

  it("completes on a closed cube with no seams (overlap not checked)", () => {
    const { mesh } = parseObj(CUBE_OBJ);
    const topo = buildTopology(mesh);
    const islands = partitionIslands(mesh, topo, createSeamRegistry());
    expect(islands).toHaveLength(1);

    const result = unfoldIsland(mesh, topo, islands[0]!);
    expect(result.error).toBeUndefined();
    expect(result.positions2d).toHaveLength(12 * 6);

    for (let i = 0; i < result.faces.length; i++) {
      assertTriangleEdgeLengthsPreserved(mesh, result.faces[i]!, getFace2d(result, i));
    }
  });

  it("returns an error for an empty island", () => {
    const mesh = makeMesh([0, 0, 0, 1, 0, 0, 0, 1, 0], [0, 1, 2]);
    const topo = buildTopology(mesh);
    const result = unfoldIsland(mesh, topo, []);

    expect(result.error).toMatch(/empty/i);
    expect(result.positions2d).toHaveLength(0);
  });
});
