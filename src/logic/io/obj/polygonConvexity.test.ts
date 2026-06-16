import { describe, expect, it } from "vitest";
import { isConcaveNgons } from "./polygonConvexity";

function verts(coords: number[]): Float32Array {
  return new Float32Array(coords);
}

describe("isConcaveNgons", () => {
  it("returns false for a triangle", () => {
    const v = verts([0, 0, 0, 1, 0, 0, 0, 1, 0]);
    expect(isConcaveNgons(v, [0, 1, 2])).toBe(false);
  });

  it("returns false for a convex quad", () => {
    const v = verts([0, 0, 0, 2, 0, 0, 2, 2, 0, 0, 2, 0]);
    expect(isConcaveNgons(v, [0, 1, 2, 3])).toBe(false);
  });

  it("returns true for a concave L-shaped quad", () => {
    const v = verts([
      0, 0, 0,
      2, 0, 0,
      2, 1, 0,
      1, 1, 0,
      1, 2, 0,
      0, 2, 0,
    ]);
    expect(isConcaveNgons(v, [0, 1, 2, 3, 4, 5])).toBe(true);
  });

  it("returns true for a concave quad with an interior notch vertex", () => {
    const v = verts([0, 0, 0, 4, 0, 0, 1, 1, 0, 0, 4, 0]);
    expect(isConcaveNgons(v, [0, 1, 2, 3])).toBe(true);
  });

  it("returns false for a convex pentagon", () => {
    const v = verts([
      0, 2, 0,
      1.9, 0.6, 0,
      1.2, -1.6, 0,
      -1.2, -1.6, 0,
      -1.9, 0.6, 0,
    ]);
    expect(isConcaveNgons(v, [0, 1, 2, 3, 4])).toBe(false);
  });

  it("returns true for a concave pentagon", () => {
    const v = verts([
      0, 0, 0,
      4, 0, 0,
      4, 4, 0,
      2, 1, 0,
      0, 4, 0,
    ]);
    expect(isConcaveNgons(v, [0, 1, 2, 3, 4])).toBe(true);
  });
});
