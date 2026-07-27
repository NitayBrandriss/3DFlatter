import { describe, expect, it } from "vitest";
import { parseObj } from "../logic/io/obj/parseObj";
import { buildTopology } from "../logic/mesh/buildTopology";
import { makeEdgeKey } from "../logic/mesh/edgeKey";
import {
  createSeamRegistry,
  toggleSeam,
} from "../logic/seams/seamRegistry";
import {
  computeSessionStats,
  seamsContentKey,
  type MeshSession,
} from "./meshSessionStore";

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

function cubeSession(seams = createSeamRegistry()): MeshSession {
  const { mesh } = parseObj(CUBE_OBJ);
  const topology = buildTopology(mesh);
  return { mesh, topology, seams, fileName: "cube.obj" };
}

describe("seamsContentKey", () => {
  it("is empty for an empty registry", () => {
    expect(seamsContentKey(createSeamRegistry())).toBe("");
  });

  it("is order-independent and stable across registry identity", () => {
    const a = makeEdgeKey(0, 1);
    const b = makeEdgeKey(2, 3);
    const forward = toggleSeam(toggleSeam(createSeamRegistry(), a), b);
    const reverse = toggleSeam(toggleSeam(createSeamRegistry(), b), a);
    const clone = { seams: new Set(forward.seams) };

    expect(seamsContentKey(forward)).toBe(seamsContentKey(reverse));
    expect(seamsContentKey(forward)).toBe(seamsContentKey(clone));
    expect(seamsContentKey(forward)).not.toBe("");
  });

  it("changes when seam membership changes", () => {
    const a = makeEdgeKey(0, 1);
    const empty = createSeamRegistry();
    const withA = toggleSeam(empty, a);
    expect(seamsContentKey(withA)).not.toBe(seamsContentKey(empty));
  });
});

describe("computeSessionStats", () => {
  it("reports a single island for a closed cube with no seams", () => {
    const stats = computeSessionStats(cubeSession());
    expect(stats).not.toBeNull();
    expect(stats!.faceCount).toBe(12);
    expect(stats!.seamCount).toBe(0);
    expect(stats!.islandCount).toBe(1);
  });

  it("updates seam count after a seam toggle", () => {
    const key = makeEdgeKey(0, 1);
    const stats = computeSessionStats(cubeSession(toggleSeam(createSeamRegistry(), key)));
    expect(stats!.seamCount).toBe(1);
    expect(stats!.islandCount).toBe(1);
  });
});
