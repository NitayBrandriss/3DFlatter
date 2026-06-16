import { describe, expect, it } from "vitest";
import type { Bbox2d } from "../../mesh/types";
import { computeSvgViewBox, SVG_VIEW_PADDING_RATIO, viewBoxAttribute } from "./viewBox";
import { yFlipGroupTransform } from "./yFlip";

describe("computeSvgViewBox", () => {
  it("adds proportional padding around bounds", () => {
    const bounds: Bbox2d = { minX: 0, minY: 0, maxX: 10, maxY: 20 };
    const vb = computeSvgViewBox(bounds);

    expect(vb.pad).toBeCloseTo(20 * SVG_VIEW_PADDING_RATIO);
    expect(vb.x).toBeCloseTo(0 - vb.pad);
    expect(vb.y).toBeCloseTo(0 - vb.pad);
    expect(vb.width).toBeCloseTo(10 + 2 * vb.pad);
    expect(vb.height).toBeCloseTo(20 + 2 * vb.pad);
    expect(viewBoxAttribute(vb)).toBe(`${vb.x} ${vb.y} ${vb.width} ${vb.height}`);
  });

  it("uses unit span when bounds are degenerate", () => {
    const bounds: Bbox2d = { minX: 5, minY: 5, maxX: 5, maxY: 5 };
    const vb = computeSvgViewBox(bounds);

    expect(vb.width).toBeCloseTo(1 + 2 * vb.pad);
    expect(vb.height).toBeCloseTo(1 + 2 * vb.pad);
  });
});

describe("yFlipGroupTransform", () => {
  it("mirrors Y around the layout bbox midline", () => {
    expect(yFlipGroupTransform(0, 10)).toBe("translate(0, 10) scale(1, -1)");
    expect(yFlipGroupTransform(-2, 8)).toBe("translate(0, 6) scale(1, -1)");
  });
});
