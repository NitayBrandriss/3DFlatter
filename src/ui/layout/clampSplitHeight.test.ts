import { describe, expect, it } from "vitest";
import { clampSplitHeight } from "./clampSplitHeight";

describe("clampSplitHeight", () => {
  it("returns proposed height when within bounds", () => {
    expect(clampSplitHeight(1000, 280)).toBe(280);
  });

  it("clamps below minimum", () => {
    expect(clampSplitHeight(1000, 50)).toBe(140);
  });

  it("clamps above maximum ratio", () => {
    expect(clampSplitHeight(1000, 800)).toBe(600);
  });

  it("returns minimum when viewport height is zero", () => {
    expect(clampSplitHeight(0, 280)).toBe(140);
  });
});
