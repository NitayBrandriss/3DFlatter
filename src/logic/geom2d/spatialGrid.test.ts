import { describe, expect, it } from "vitest";
import {
  buildSoupItems,
  buildUniformGrid,
  forEachCandidatePair,
  type TriangleSoupItem,
} from "./spatialGrid";
import { tri } from "./testHelpers";
import { isDegenerateTriangle } from "./triangle2d";

describe("spatialGrid", () => {
  it("distant pair is not emitted as candidate", () => {
    const triangles = [
      tri(0, 0, 1, 0, 0, 1),
      tri(100, 100, 101, 100, 100, 101),
    ];
    const items = buildSoupItems(triangles);
    const grid = buildUniformGrid(items);
    const pairs: [number, number][] = [];
    forEachCandidatePair(grid, items, (i, j) => pairs.push([i, j]));
    expect(pairs).toHaveLength(0);
  });

  it("co-located cluster emits all unique pairs", () => {
    const triangles = [
      tri(0, 0, 2, 0, 1, 2),
      tri(0, 0, 2, 0, 1, -2),
      tri(1, 0, 3, 0, 2, 1.5),
    ];
    const items = buildSoupItems(triangles);
    const grid = buildUniformGrid(items);
    const pairs: [number, number][] = [];
    forEachCandidatePair(grid, items, (i, j) => pairs.push([i, j]));
    expect(pairs).toHaveLength(3);
    expect(pairs).toContainEqual([0, 1]);
    expect(pairs).toContainEqual([0, 2]);
    expect(pairs).toContainEqual([1, 2]);
  });

  it("skips degenerate triangles in soup items", () => {
    const triangles = [
      tri(0, 0, 2, 0, 4, 0),
      tri(0, 0, 2, 0, 1, 1),
    ];
    expect(isDegenerateTriangle(triangles[0]!)).toBe(true);
    const items = buildSoupItems(triangles);
    expect(items).toHaveLength(1);
    expect(items[0]!.soupIndex).toBe(1);
  });

  it("deduplicates pairs across cells", () => {
    const items: TriangleSoupItem[] = [
      { soupIndex: 0, tri: tri(0, 0, 1, 0, 0.5, 1), aabb: { minX: 0, minY: 0, maxX: 1, maxY: 1 } },
      { soupIndex: 1, tri: tri(0.5, 0, 1.5, 0, 1, 1), aabb: { minX: 0.5, minY: 0, maxX: 1.5, maxY: 1 } },
    ];
    const grid = buildUniformGrid(items);
    const pairs: [number, number][] = [];
    forEachCandidatePair(grid, items, (i, j) => pairs.push([i, j]));
    expect(pairs).toEqual([[0, 1]]);
  });
});
