import { describe, expect, it } from "vitest";
import { parseObj } from "../io/obj/parseObj";
import { buildTopology } from "../mesh/buildTopology";
import { makeEdgeKey } from "../mesh/edgeKey";
import { partitionIslands } from "../mesh/partitionIslands";
import { createSeamRegistry, toggleSeam } from "../seams/seamRegistry";
import { buildUnfoldTreeEdges } from "./buildUnfoldTreeEdges";
import { detectTears } from "./detectTears";
import { unfoldIsland } from "./unfoldIsland";

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

function seamTopFaceFromCube() {
  const { mesh } = parseObj(CUBE_OBJ);
  const topo = buildTopology(mesh);
  let seams = createSeamRegistry();
  for (const key of [
    makeEdgeKey(4, 5),
    makeEdgeKey(5, 6),
    makeEdgeKey(6, 7),
    makeEdgeKey(4, 7),
  ]) {
    seams = toggleSeam(seams, key);
  }
  return { mesh, topo, seams };
}

function largestIsland(islands: number[][]) {
  return islands.reduce((a, b) => (a.length >= b.length ? a : b));
}

describe("detectTears", () => {
  it("reports many non-tree tears for a closed cube island", () => {
    const { mesh } = parseObj(CUBE_OBJ);
    const topo = buildTopology(mesh);
    const islandFaces = Array.from({ length: 12 }, (_, i) => i);
    const result = unfoldIsland(mesh, topo, islandFaces);
    expect(result.error).toBeUndefined();

    const treeEdges = buildUnfoldTreeEdges(mesh, topo, islandFaces);
    const tears = detectTears(mesh, topo, islandFaces, result, treeEdges);

    expect(tears.length).toBeGreaterThan(0);
    for (const t of tears) {
      expect(t.maxGap).toBeGreaterThan(0);
      expect(["gap", "overlap", "skew"]).toContain(t.kind);
    }
  });

  it("reports no tears for a two-triangle diamond (only tree edges)", () => {
    const mesh = {
      vertices: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, -1, 0, 0]),
      faces: new Uint32Array([0, 1, 2, 0, 2, 3]),
      vertexCount: 4,
      faceCount: 2,
    };
    const topo = buildTopology(mesh);
    const islandFaces = [0, 1];
    const result = unfoldIsland(mesh, topo, islandFaces);
    expect(result.error).toBeUndefined();

    const treeEdges = buildUnfoldTreeEdges(mesh, topo, islandFaces);
    const tears = detectTears(mesh, topo, islandFaces, result, treeEdges);
    expect(tears).toHaveLength(0);
  });

  it("reports fewer tears on shell island when top face is seamed free", () => {
    const { mesh, topo, seams } = seamTopFaceFromCube();
    const islands = partitionIslands(mesh, topo, seams);
    const shellFaces = largestIsland(islands);

    const closedFaces = Array.from({ length: 12 }, (_, i) => i);
    const closedResult = unfoldIsland(mesh, topo, closedFaces);
    const shellResult = unfoldIsland(mesh, topo, shellFaces);

    const closedTears = detectTears(
      mesh,
      topo,
      closedFaces,
      closedResult,
      buildUnfoldTreeEdges(mesh, topo, closedFaces),
    );
    const shellTears = detectTears(
      mesh,
      topo,
      shellFaces,
      shellResult,
      buildUnfoldTreeEdges(mesh, topo, shellFaces),
    );

    expect(closedTears.length).toBeGreaterThan(shellTears.length);
  });
});
