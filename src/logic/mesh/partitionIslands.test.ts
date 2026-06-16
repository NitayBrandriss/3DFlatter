import { describe, expect, it } from "vitest";
import { parseObj } from "../io/obj/parseObj";
import { buildTopology } from "./buildTopology";
import { makeEdgeKey } from "./edgeKey";
import { partitionIslands } from "./partitionIslands";
import { createSeamRegistry, toggleSeam } from "../seams/seamRegistry";

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

describe("partitionIslands", () => {
  it("returns one island with no seams on a closed cube", () => {
    const { mesh } = parseObj(CUBE_OBJ);
    const topo = buildTopology(mesh);
    const seams = createSeamRegistry();
    const islands = partitionIslands(mesh, topo, seams);
    expect(islands).toHaveLength(1);
    expect(islands[0]).toHaveLength(mesh.faceCount);
  });

  it("splits into multiple islands when a seam cuts the mesh", () => {
    const { mesh } = parseObj(CUBE_OBJ);
    const topo = buildTopology(mesh);
    let seams = createSeamRegistry();

    let addedSeams = 0;
    for (const key of topo.edgeToFaces.keys()) {
      if (topo.edgeToFaces.get(key)!.length === 2) {
        seams = toggleSeam(seams, key);
        addedSeams++;
        if (addedSeams >= 4) break;
      }
    }

    const islands = partitionIslands(mesh, topo, seams);
    expect(islands.length).toBeGreaterThan(1);
    const totalFaces = islands.reduce((sum, isl) => sum + isl.length, 0);
    expect(totalFaces).toBe(mesh.faceCount);
  });

  it("splits a diamond into two islands when the shared edge is seamed", () => {
    const mesh = {
      vertices: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, -1, 0, 0]),
      faces: new Uint32Array([0, 1, 2, 0, 2, 3]),
      vertexCount: 4,
      faceCount: 2,
    };
    const topo = buildTopology(mesh);
    let seams = createSeamRegistry();
    seams = toggleSeam(seams, makeEdgeKey(0, 2));

    const islands = partitionIslands(mesh, topo, seams);
    expect(islands).toHaveLength(2);
    expect(islands.map((isl) => isl.length).sort((a, b) => a - b)).toEqual([1, 1]);
  });
});
