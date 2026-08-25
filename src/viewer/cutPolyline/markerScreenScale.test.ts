import { describe, expect, it } from "vitest";
import { markerScaleForScreenPixels } from "./markerScreenScale";

const BASE = {
  fovDeg: 50,
  viewportHeightPx: 800,
  geometryRadius: 0.028,
  parentScale: 1,
  targetRadiusPx: 10,
} as const;

describe("markerScaleForScreenPixels", () => {
  it("scales linearly with camera distance", () => {
    const near = markerScaleForScreenPixels({ ...BASE, distance: 2 });
    const far = markerScaleForScreenPixels({ ...BASE, distance: 4 });
    expect(far / near).toBeCloseTo(2, 5);
  });

  it("compensates parent group scale so world size stays constant", () => {
    const s1 = markerScaleForScreenPixels({ ...BASE, distance: 3, parentScale: 1 });
    const s2 = markerScaleForScreenPixels({ ...BASE, distance: 3, parentScale: 2 });
    expect(s2 * 2).toBeCloseTo(s1, 5);
  });

  it("is smaller when the viewport is taller (same world size → fewer relative pixels)", () => {
    const short = markerScaleForScreenPixels({
      ...BASE,
      distance: 3,
      viewportHeightPx: 400,
    });
    const tall = markerScaleForScreenPixels({
      ...BASE,
      distance: 3,
      viewportHeightPx: 800,
    });
    expect(tall / short).toBeCloseTo(0.5, 5);
  });

  it("returns 1 for non-positive inputs", () => {
    expect(markerScaleForScreenPixels({ ...BASE, distance: 0 })).toBe(1);
    expect(markerScaleForScreenPixels({ ...BASE, distance: 2, viewportHeightPx: 0 })).toBe(
      1,
    );
  });
});
