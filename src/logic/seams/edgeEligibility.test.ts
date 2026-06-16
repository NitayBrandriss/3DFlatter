import { describe, expect, it } from "vitest";
import { buildTopology } from "../mesh/buildTopology";
import { makeEdgeKey } from "../mesh/edgeKey";
import type { EdgeKey, MeshModel } from "../mesh/types";
import { canSelectAsSeam } from "./edgeEligibility";

function makeMesh(vertices: number[], faces: number[]): MeshModel {
  return {
    vertices: new Float32Array(vertices),
    faces: new Uint32Array(faces),
    vertexCount: vertices.length / 3,
    faceCount: faces.length / 3,
  };
}

describe("canSelectAsSeam", () => {
  it("allows manifold interior edges", () => {
    const mesh = makeMesh(
      [0, 0, 0, 1, 0, 0, 0, 1, 0, -1, 0, 0],
      [0, 1, 2, 0, 2, 3],
    );
    const topo = buildTopology(mesh);
    const key = makeEdgeKey(0, 2);
    expect(canSelectAsSeam(topo, key)).toEqual({ ok: true });
  });

  it("rejects boundary edges", () => {
    const mesh = makeMesh([0, 0, 0, 1, 0, 0, 0, 1, 0], [0, 1, 2]);
    const topo = buildTopology(mesh);
    const key = makeEdgeKey(0, 1);
    const result = canSelectAsSeam(topo, key);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/boundary/i);
    }
  });

  it("rejects unknown edges", () => {
    const mesh = makeMesh([0, 0, 0, 1, 0, 0, 0, 1, 0], [0, 1, 2]);
    const topo = buildTopology(mesh);
    const result = canSelectAsSeam(topo, "99,100" as EdgeKey);
    expect(result.ok).toBe(false);
  });
});
