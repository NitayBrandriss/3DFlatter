import { describe, expect, it } from "vitest";
import {
  CUT_DRAW_MAX_STROKE_POINTS,
  CUT_DRAW_MIN_SAMPLE_DIST_SQ,
  isAtCutStrokePointCap,
  shouldAppendCutSample,
} from "./cutDrawSampling";

describe("cutDrawSampling", () => {
  it("always accepts the first sample", () => {
    expect(shouldAppendCutSample(undefined, { x: 1, y: 0, z: 0 })).toBe(true);
  });

  it("rejects samples closer than min distance", () => {
    const prev = { x: 0, y: 0, z: 0 };
    const close = { x: 0.001, y: 0, z: 0 };
    expect(shouldAppendCutSample(prev, close)).toBe(false);
  });

  it("accepts samples at or beyond min distance", () => {
    const prev = { x: 0, y: 0, z: 0 };
    const far = { x: 0.02, y: 0, z: 0 };
    expect(shouldAppendCutSample(prev, far)).toBe(true);
  });

  it("uses exported min distance constant", () => {
    expect(CUT_DRAW_MIN_SAMPLE_DIST_SQ).toBeCloseTo(0.000225, 8);
  });

  it("detects point cap", () => {
    expect(isAtCutStrokePointCap(CUT_DRAW_MAX_STROKE_POINTS - 1)).toBe(false);
    expect(isAtCutStrokePointCap(CUT_DRAW_MAX_STROKE_POINTS)).toBe(true);
  });
});
