import { describe, expect, it } from "vitest";
import { parseObj } from "../io/obj/parseObj";
import { buildTopology } from "../mesh/buildTopology";
import { makeEdgeKey } from "../mesh/edgeKey";
import { partitionIslands } from "../mesh/partitionIslands";
import { createSeamRegistry, toggleSeam } from "../seams/seamRegistry";
import { detectCollisions } from "./detectCollisions";
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

describe("detectCollisions", () => {
  it("reports no collisions for a single triangle", () => {
    const { mesh } = parseObj(CUBE_OBJ);
    const topo = buildTopology(mesh);
    const result = unfoldIsland(mesh, topo, [0]);
    expect(result.error).toBeUndefined();

    expect(detectCollisions(mesh, topo, result)).toHaveLength(0);
  });

  it("reports many collisions for a closed cube unfolded as one island", () => {
    const { mesh } = parseObj(CUBE_OBJ);
    const topo = buildTopology(mesh);
    const islandFaces = Array.from({ length: 12 }, (_, i) => i);
    const result = unfoldIsland(mesh, topo, islandFaces);
    expect(result.error).toBeUndefined();

    const collisions = detectCollisions(mesh, topo, result);
    expect(collisions.length).toBeGreaterThan(0);
    for (const c of collisions) {
      expect(c.overlapArea).toBeGreaterThan(0);
      expect(Number.isFinite(c.centroid.x)).toBe(true);
      expect(Number.isFinite(c.centroid.y)).toBe(true);
    }
  });

  it("reports fewer collisions when the top face is seamed free", () => {
    const { mesh, topo, seams } = seamTopFaceFromCube();
    const islands = partitionIslands(mesh, topo, seams);

    const shellFaces = largestIsland(islands);
    const shell = unfoldIsland(mesh, topo, shellFaces);
    const closed = unfoldIsland(mesh, topo, Array.from({ length: 12 }, (_, i) => i));

    const shellCollisions = detectCollisions(mesh, topo, shell);
    const closedCollisions = detectCollisions(mesh, topo, closed);
    expect(closedCollisions.length).toBeGreaterThan(shellCollisions.length);
  });
});
