import { describe, expect, it } from "vitest";
import { maskFromFaces } from "./faceMask";
import {
  isolateDisplayBounds,
  originalFaceIdForHit,
  splitIsolationIndexBuffers,
} from "./maskGeometry";
import { openTube } from "./testMeshes";

function faceCorners(mesh: ReturnType<typeof openTube>, faceId: number): number[] {
  const base = faceId * 3;
  return [
    mesh.faces[base]!,
    mesh.faces[base + 1]!,
    mesh.faces[base + 2]!,
  ];
}

describe("splitIsolationIndexBuffers", () => {
  it("splits openTube(2, 4) so faces 0 and 1 are isolate and 2 through 7 are ghost", () => {
    const mesh = openTube(2, 4);
    expect(mesh.faceCount).toBe(8);
    const mask = maskFromFaces(mesh.faceCount, [0, 1]);
    expect(Array.from(mask)).toEqual([1, 1, 0, 0, 0, 0, 0, 0]);

    const split = splitIsolationIndexBuffers(mesh, mask);

    expect(split.isolateFaceIds).toEqual([0, 1]);
    expect(Array.from(split.isolateIndices)).toEqual([
      ...faceCorners(mesh, 0),
      ...faceCorners(mesh, 1),
    ]);
    expect(Array.from(split.ghostIndices)).toEqual([
      ...faceCorners(mesh, 2),
      ...faceCorners(mesh, 3),
      ...faceCorners(mesh, 4),
      ...faceCorners(mesh, 5),
      ...faceCorners(mesh, 6),
      ...faceCorners(mesh, 7),
    ]);
  });

  it("maps an isolate-buffer hit through ascending original face ids", () => {
    const mesh = openTube(2, 4);
    const mask = maskFromFaces(mesh.faceCount, [2, 5]);
    const split = splitIsolationIndexBuffers(mesh, mask);

    expect(split.isolateFaceIds).toEqual([2, 5]);
    expect(Array.from(split.isolateIndices)).toEqual([
      ...faceCorners(mesh, 2),
      ...faceCorners(mesh, 5),
    ]);
    expect(originalFaceIdForHit(0, split.isolateFaceIds)).toBe(2);
    expect(originalFaceIdForHit(1, split.isolateFaceIds)).toBe(5);
    expect(originalFaceIdForHit(2, split.isolateFaceIds)).toBeNull();
    expect(originalFaceIdForHit(5, null)).toBe(5);
  });
});

describe("isolateDisplayBounds", () => {
  it("uses only vertices referenced by the isolate index buffer", () => {
    const positions = new Float32Array([
      0, 0, 0, 2, 0, 0, 0, 2, 0, 10, 10, 10,
    ]);
    const bounds = isolateDisplayBounds(positions, new Uint32Array([0, 1, 2]));
    expect(bounds).not.toBeNull();
    expect(bounds!.centerX).toBeCloseTo(1);
    expect(bounds!.centerY).toBeCloseTo(1);
    expect(bounds!.centerZ).toBeCloseTo(0);
    expect(bounds!.radius).toBeCloseTo(Math.sqrt(2));
  });
});
