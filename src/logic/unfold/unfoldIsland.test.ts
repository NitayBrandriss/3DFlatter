import { describe, expect, it } from "vitest";
import { parseObj } from "../io/obj/parseObj";
import { buildTopology } from "../mesh/buildTopology";
import { makeEdgeKey } from "../mesh/edgeKey";
import { partitionIslands } from "../mesh/partitionIslands";
import type { MeshModel } from "../mesh/types";
import { unweldedIcosahedronObj } from "../io/obj/testMeshes";
import { createSeamRegistry, toggleSeam } from "../seams/seamRegistry";
import { unfoldIsland } from "./unfoldIsland";
import {
  assertSharedEdgeMatches,
  assertTriangleCCW,
  assertTriangleEdgeLengthsPreserved,
  assertUnfoldTreeHingesMatch,
  getFace2d,
} from "./unfoldTestHelpers";

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
