import { describe, expect, it } from "vitest";
import { makeEdgeKey } from "../mesh/edgeKey";
import type { MeshModel } from "../mesh/types";
import { resolvePick } from "./resolvePick";

function makeMesh(vertices: number[], faces: number[]): MeshModel {
  return {
    vertices: new Float32Array(vertices),
    faces: new Uint32Array(faces),
    vertexCount: vertices.length / 3,
    faceCount: faces.length / 3,
  };
}

describe("resolvePick", () => {
  it("resolves a hit near edge v0-v1", () => {
    const mesh = makeMesh(
      [0, 0, 0, 1, 0, 0, 0, 1, 0],
      [0, 1, 2],
    );
    const result = resolvePick(mesh, 0, { x: 0.5, y: 0, z: 0 });
    expect(result).not.toBeNull();
    expect(result!.edgeKey).toBe(makeEdgeKey(0, 1));
    expect(result!.slot).toBe(0);
  });

  it("returns null for a face-center hit", () => {
    const mesh = makeMesh(
      [0, 0, 0, 1, 0, 0, 0, 1, 0],
      [0, 1, 2],
    );
    const result = resolvePick(mesh, 0, { x: 0.33, y: 0.33, z: 0 });
    expect(result).toBeNull();
  });

  it("returns null for out-of-range face index", () => {
    const mesh = makeMesh([0, 0, 0, 1, 0, 0, 0, 1, 0], [0, 1, 2]);
    expect(resolvePick(mesh, 5, { x: 0, y: 0, z: 0 })).toBeNull();
  });
});
