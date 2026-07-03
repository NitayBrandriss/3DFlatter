import { describe, expect, it } from "vitest";
import { parseObj } from "../io/obj/parseObj";
import { unweldedIcosahedronObj } from "../io/obj/testMeshes";
import { buildTopology } from "../mesh/buildTopology";
import { makeEdgeKey } from "../mesh/edgeKey";
import { createSeamRegistry, toggleSeam } from "../seams/seamRegistry";
import { unfoldMesh } from "./unfoldMesh";
import { boundsFromSoup } from "./soupBounds";

function bboxesOverlap(
  a: ReturnType<typeof boundsFromSoup>,
  b: ReturnType<typeof boundsFromSoup>,
): boolean {
  const gap = 0.5 - 1e-6;
  const separatedX = a.maxX + gap <= b.minX || b.maxX + gap <= a.minX;
  const separatedY = a.maxY + gap <= b.minY || b.maxY + gap <= a.minY;
  return !(separatedX || separatedY);
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

describe("unfoldMesh", () => {
  it("lays out two islands separately when the cube top is seamed free", () => {
    const { mesh, topo, seams } = seamTopFaceFromCube();
    const result = unfoldMesh(mesh, topo, seams);

    expect(result.error).toBeUndefined();
    expect(result.islands).toHaveLength(2);
    expect(result.seamSegments).toHaveLength(8);
    expect(bboxesOverlap(result.islands[0]!.bounds, result.islands[1]!.bounds)).toBe(
      false,
    );
    expect(Array.isArray(result.collisions)).toBe(true);
    expect(Array.isArray(result.tears)).toBe(true);
  });

  it("unfolds a welded icosahedron as one layouted island", () => {
    const { mesh } = parseObj(unweldedIcosahedronObj());
    const topo = buildTopology(mesh);
    const result = unfoldMesh(mesh, topo, createSeamRegistry());

    expect(result.error).toBeUndefined();
    expect(result.islands).toHaveLength(1);
    expect(result.seamSegments).toHaveLength(0);
    expect(result.islands[0]!.positions2d).toHaveLength(120);
    expect(result.islands[0]!.positions2d.every((v) => Number.isFinite(v))).toBe(true);
    expect(result.bounds.maxX).toBeGreaterThan(result.bounds.minX);
    expect(Array.isArray(result.collisions)).toBe(true);
    expect(Array.isArray(result.tears)).toBe(true);
  });

  it("reports many collisions and tears for a closed cube with no seams", () => {
    const { mesh } = parseObj(CUBE_OBJ);
    const topo = buildTopology(mesh);
    const result = unfoldMesh(mesh, topo, createSeamRegistry());

    expect(result.error).toBeUndefined();
    expect(result.islands).toHaveLength(1);
    expect(result.collisions.length).toBeGreaterThan(0);
    expect(result.tears.length).toBeGreaterThan(0);
    for (const c of result.collisions) {
      expect(c.islandIndex).toBe(0);
      expect(c.overlapArea).toBeGreaterThan(0);
    }
    for (const t of result.tears) {
      expect(t.islandIndex).toBe(0);
      expect(t.maxGap).toBeGreaterThan(0);
    }
  });
});
