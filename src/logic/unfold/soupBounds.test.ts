import { describe, expect, it } from "vitest";
import {
  boundsFromSoup,
  polygonPointsString,
  translateSoup,
} from "./soupBounds";

describe("soupBounds", () => {
  it("computes bounds from a single triangle", () => {
    const soup = new Float32Array([0, 0, 2, 0, 0, 2]);
    expect(boundsFromSoup(soup)).toEqual({
      minX: 0,
      minY: 0,
      maxX: 2,
      maxY: 2,
    });
  });

  it("translates soup coordinates", () => {
    const soup = new Float32Array([0, 0, 1, 0, 0, 1]);
    const out = translateSoup(soup, 3, -2);
    expect(Array.from(out)).toEqual([3, -2, 4, -2, 3, -1]);
  });

  it("formats polygon points for SVG", () => {
    const soup = new Float32Array([0, 0, 2, 0, 1, 1]);
    expect(polygonPointsString(soup, 0)).toBe("0,0 2,0 1,1");
  });
});
