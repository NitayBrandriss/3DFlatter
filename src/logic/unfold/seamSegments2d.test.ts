import { describe, expect, it } from "vitest";
import { parseObj } from "../io/obj/parseObj";
import { buildTopology } from "../mesh/buildTopology";
import { makeEdgeKey } from "../mesh/edgeKey";
import { createSeamRegistry, toggleSeam } from "../seams/seamRegistry";
import { distance3d } from "./placeTriangle2d";
import { listSeamSegments2d } from "./seamSegments2d";
import { unfoldMesh } from "./unfoldMesh";

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

function segmentLength(seg: { x0: number; y0: number; x1: number; y1: number }): number {
  const dx = seg.x1 - seg.x0;
  const dy = seg.y1 - seg.y0;
  return Math.hypot(dx, dy);
}

describe("listSeamSegments2d", () => {
  it("returns two segments per manifold seam on a seamed cube", () => {
    const { mesh, topo, seams } = seamTopFaceFromCube();
    const result = unfoldMesh(mesh, topo, seams);

    expect(result.seamSegments).toHaveLength(8);
    expect(result.seamSegments.every((s) => Number.isFinite(segmentLength(s)))).toBe(true);
  });

  it("each segment 2D length matches a seam edge 3D length", () => {
    const { mesh, topo, seams } = seamTopFaceFromCube();
    const result = unfoldMesh(mesh, topo, seams);

    for (const seg of result.seamSegments) {
      const len2d = segmentLength(seg);
      const matchesSomeSeam = [...seams.seams].some((key) => {
        const [a, b] = key.split(",").map((s) => Number.parseInt(s, 10)) as [
          number,
          number,
        ];
        return Math.abs(len2d - distance3d(mesh, a, b)) < 1e-4;
      });
      expect(matchesSomeSeam).toBe(true);
    }
  });

  it("returns empty array when there are no seams", () => {
    const { mesh, topo } = seamTopFaceFromCube();
    const result = unfoldMesh(mesh, topo, createSeamRegistry());
    expect(result.seamSegments).toHaveLength(0);
  });
});

describe("listSeamSegments2d direct", () => {
  it("matches unfoldMesh seamSegments on layouted islands", () => {
    const { mesh, topo, seams } = seamTopFaceFromCube();
    const result = unfoldMesh(mesh, topo, seams);
    const direct = listSeamSegments2d(mesh, topo, seams, result.islands);
    expect(direct).toEqual(result.seamSegments);
  });
});
