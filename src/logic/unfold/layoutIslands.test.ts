import { describe, expect, it } from "vitest";
import type { UnfoldIslandResult } from "../mesh/types";
import { ISLAND_GAP, layoutIslands } from "./layoutIslands";
import { bboxWidth, boundsFromSoup } from "./soupBounds";

function islandFromBounds(
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): UnfoldIslandResult {
  return {
    faces: [0],
    positions2d: new Float32Array([
      minX,
      minY,
      maxX,
      minY,
      minX,
      maxY,
    ]),
  };
}

function bboxesOverlap(
  a: ReturnType<typeof boundsFromSoup>,
  b: ReturnType<typeof boundsFromSoup>,
): boolean {
  const gap = ISLAND_GAP - 1e-6;
  const separatedX = a.maxX + gap <= b.minX || b.maxX + gap <= a.minX;
  const separatedY = a.maxY + gap <= b.minY || b.maxY + gap <= a.minY;
  return !(separatedX || separatedY);
}

describe("layoutIslands", () => {
  it("anchors a single island at the pack origin", () => {
    const input = [islandFromBounds(1, 2, 4, 5)];
    const out = layoutIslands(input);
    expect(out).toHaveLength(1);
    expect(boundsFromSoup(out[0]!.positions2d)).toEqual({
      minX: 0,
      minY: 0,
      maxX: 3,
      maxY: 3,
    });
  });

  it("wraps islands into multiple rows when row width is limited", () => {
    const input = [
      islandFromBounds(0, 0, 2, 1),
      islandFromBounds(0, 0, 2, 1),
      islandFromBounds(0, 0, 2, 1),
    ];
    const out = layoutIslands(input, { maxRowWidth: 5 });
    expect(out).toHaveLength(3);

    const ys = out.map((isl) => isl.bounds.minY);
    expect(new Set(ys).size).toBeGreaterThan(1);

    for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        expect(bboxesOverlap(out[i]!.bounds, out[j]!.bounds)).toBe(false);
      }
    }
  });

  it("packs islands left-to-right within a row", () => {
    const input = [
      islandFromBounds(0, 0, 2, 1),
      islandFromBounds(0, 0, 2, 1),
    ];
    const out = layoutIslands(input, { maxRowWidth: 100 });
    expect(out[0]!.bounds.minX).toBe(0);
    expect(out[1]!.bounds.minX).toBeGreaterThan(out[0]!.bounds.maxX);
    expect(bboxWidth(out[0]!.bounds)).toBeCloseTo(2, 5);
  });

  it("does not overlap when a wrapped island is taller than the row above", () => {
    // Regression: old cursorY -= rowHeight + gap placed a tall island too high.
    const input = [
      islandFromBounds(0, 0, 8, 2),
      islandFromBounds(0, 0, 8, 5),
      islandFromBounds(0, 0, 8, 5),
    ];
    const out = layoutIslands(input, { maxRowWidth: 9 });

    expect(out).toHaveLength(3);
    for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        expect(bboxesOverlap(out[i]!.bounds, out[j]!.bounds)).toBe(false);
      }
    }
    expect(out[1]!.bounds.maxY).toBeLessThanOrEqual(out[0]!.bounds.minY - ISLAND_GAP + 1e-6);
  });
});
