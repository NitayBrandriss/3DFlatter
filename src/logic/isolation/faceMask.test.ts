import { describe, expect, it } from "vitest";
import {
  cloneFaceMask,
  combineFloodIntoMask,
  countMaskedFaces,
  createFaceMask,
  maskFromFaces,
} from "./faceMask";

describe("faceMask", () => {
  it("createFaceMask is all zeros", () => {
    const mask = createFaceMask(4);
    expect(mask).toHaveLength(4);
    expect(countMaskedFaces(mask)).toBe(0);
  });

  it("maskFromFaces ignores out-of-range ids", () => {
    const mask = maskFromFaces(3, [0, 2, 9, -1]);
    expect([...mask]).toEqual([1, 0, 1]);
  });

  it("cloneFaceMask is a copy", () => {
    const mask = maskFromFaces(2, [1]);
    const cloned = cloneFaceMask(mask);
    cloned[0] = 1;
    expect(mask[0]).toBe(0);
  });

  it("combineFloodIntoMask replace does not mutate the input", () => {
    const mask = maskFromFaces(3, [0]);
    const next = combineFloodIntoMask(mask, [1, 2], "replace");
    expect([...mask]).toEqual([1, 0, 0]);
    expect([...next]).toEqual([0, 1, 1]);
  });
});
