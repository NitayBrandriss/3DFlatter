import { describe, expect, it } from "vitest";
import {
  CUT_DRAW_MAX_STROKE_POINTS,
  shouldAppendCutSample,
} from "../cutDrawSampling";
import {
  CUT_POLYLINE_CLOSE_RADIUS,
  canFinalizeDraft,
  isClosedClick,
  stripDblClickDuplicate,
} from "./cutPolylineHelpers";

describe("cutPolylineHelpers", () => {
  it("isClosedClick detects clicks within close radius of first vertex", () => {
    const first = { x: 0, y: 0, z: 0 };
    expect(isClosedClick({ x: 0.01, y: 0, z: 0 }, first)).toBe(true);
    expect(
      isClosedClick(
        { x: CUT_POLYLINE_CLOSE_RADIUS, y: 0, z: 0 },
        first,
      ),
    ).toBe(true);
    expect(
      isClosedClick(
        { x: CUT_POLYLINE_CLOSE_RADIUS + 0.001, y: 0, z: 0 },
        first,
      ),
    ).toBe(false);
  });

  it("shouldAppendCutSample rejects samples closer than min distance", () => {
    const prev = { x: 0, y: 0, z: 0 };
    expect(shouldAppendCutSample(prev, { x: 0.001, y: 0, z: 0 })).toBe(false);
    expect(shouldAppendCutSample(prev, { x: 0.02, y: 0, z: 0 })).toBe(true);
  });

  it("canFinalizeDraft requires at least two points", () => {
    expect(canFinalizeDraft(0)).toBe(false);
    expect(canFinalizeDraft(1)).toBe(false);
    expect(canFinalizeDraft(2)).toBe(true);
    expect(canFinalizeDraft(CUT_DRAW_MAX_STROKE_POINTS)).toBe(true);
  });

  it("stripDblClickDuplicate removes last point only when last pointerup added", () => {
    const display = [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 1.02, y: 0, z: 0 },
    ];
    const canonical = [
      { x: 0, y: 0, z: 0 },
      { x: 10, y: 0, z: 0 },
      { x: 10.2, y: 0, z: 0 },
    ];

    const stripped = stripDblClickDuplicate(display, canonical, true);
    expect(stripped.display).toHaveLength(2);
    expect(stripped.canonical).toHaveLength(2);
    expect(stripped.display[1]).toEqual({ x: 1, y: 0, z: 0 });
    expect(stripped.canonical[1]).toEqual({ x: 10, y: 0, z: 0 });

    const kept = stripDblClickDuplicate(display, canonical, false);
    expect(kept.display).toHaveLength(3);
    expect(kept.canonical).toHaveLength(3);
  });

  it("stripDblClickDuplicate does not mutate inputs", () => {
    const display = [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }];
    const canonical = [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
    ];
    const stripped = stripDblClickDuplicate(display, canonical, true);
    stripped.display[0]!.x = 99;
    expect(display[0]!.x).toBe(0);
  });
});
