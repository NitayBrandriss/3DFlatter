import { describe, expect, it } from "vitest";
import { weldVertices } from "./weldVertices";

describe("weldVertices", () => {
  it("merges coincident positions and remaps face indices", () => {
    const vertices = new Float32Array([
      0, 0, 0, 1, 0, 0, 0, 1, 0,
      0, 0, 0, 1, 0, 0, 0, -1, 0,
    ]);
    const faces = new Uint32Array([0, 1, 2, 3, 4, 5]);

    const welded = weldVertices(vertices, faces);

    expect(welded.vertexCount).toBe(4);
    expect(welded.faceCount).toBe(2);
    expect(Array.from(welded.faces)).toEqual([0, 1, 2, 0, 1, 3]);
  });

  it("returns the same mesh when vertices are already shared", () => {
    const vertices = new Float32Array([
      0, 0, 0, 1, 0, 0, 0, 1, 0, -1, 0, 0,
    ]);
    const faces = new Uint32Array([0, 1, 2, 0, 2, 3]);

    const welded = weldVertices(vertices, faces);

    expect(welded.vertexCount).toBe(4);
    expect(Array.from(welded.faces)).toEqual(Array.from(faces));
  });
});
