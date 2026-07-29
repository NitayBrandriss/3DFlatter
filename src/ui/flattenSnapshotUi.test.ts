import { describe, expect, it } from "vitest";
import {
  defaultQualityOverlayState,
  isFlattenSnapshotCurrent,
  resolveQualityOverlayState,
} from "./flattenSnapshotUi";

describe("flattenSnapshotUi", () => {
  it("resets quality overlay when mesh load version changes", () => {
    const prev = { meshVersion: 1, show: true, autoEnabled: true };
    const next = resolveQualityOverlayState(prev, 2);
    expect(next).toEqual(defaultQualityOverlayState(2));
  });

  it("preserves quality overlay when mesh load version matches", () => {
    const prev = { meshVersion: 3, show: true, autoEnabled: false };
    expect(resolveQualityOverlayState(prev, 3)).toBe(prev);
  });

  it("isFlattenSnapshotCurrent compares keys", () => {
    expect(isFlattenSnapshotCurrent("1:0:", "1:0:")).toBe(true);
    expect(isFlattenSnapshotCurrent("1:0:", "1:1:")).toBe(false);
    expect(isFlattenSnapshotCurrent(null, "1:0:")).toBe(false);
  });
});
