import { describe, expect, it } from "vitest";
import { weldVertices } from "./weldVertices";

describe("weldVertices", () => {
  it("merges coincident positions and remaps face indices", () => {
    const vertices = new Float32Array([
      0, 0, 0, 1, 0, 0, 0, 1, 0,
      0, 0, 0, 1, 0, 0, 0, -1, 0,
    ]);
    const faces = new Uint32Array([0, 1, 2, 3, 4, 5]);

    const { mesh, removedDegenerateFaceCount } = weldVertices(vertices, faces);

    expect(removedDegenerateFaceCount).toBe(0);
    expect(mesh.vertexCount).toBe(4);
    expect(mesh.faceCount).toBe(2);
    expect(Array.from(mesh.faces)).toEqual([0, 1, 2, 0, 1, 3]);
  });

  it("returns the same mesh when vertices are already shared", () => {
    const vertices = new Float32Array([
      0, 0, 0, 1, 0, 0, 0, 1, 0, -1, 0, 0,
    ]);
    const faces = new Uint32Array([0, 1, 2, 0, 2, 3]);

    const { mesh, removedDegenerateFaceCount } = weldVertices(vertices, faces);

    expect(removedDegenerateFaceCount).toBe(0);
    expect(mesh.vertexCount).toBe(4);
    expect(Array.from(mesh.faces)).toEqual(Array.from(faces));
  });

  it("drops index-degenerate faces created by welding", () => {
    // Three corners at the same position → one vertex after weld → (0,0,0) face
    const vertices = new Float32Array([
      0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 1, 0, 0, 0, 1, 0,
    ]);
    const faces = new Uint32Array([0, 1, 2, 3, 4, 5]);

    const { mesh, removedDegenerateFaceCount } = weldVertices(vertices, faces);

    expect(removedDegenerateFaceCount).toBe(1);
    expect(mesh.faceCount).toBe(1);
    expect(Array.from(mesh.faces)).toEqual([0, 1, 2]);
    expect(mesh.vertexCount).toBe(3);
  });
});
