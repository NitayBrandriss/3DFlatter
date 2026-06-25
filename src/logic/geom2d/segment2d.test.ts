import { describe, expect, it } from "vitest";
import {
  areCollinear,
  collinearIntervalOverlap,
  pointToSegmentDistance,
  segmentParallelAngle,
  segmentSegmentDistance,
  type Segment2d,
} from "./segment2d";

describe("segment2d", () => {
  it("pointToSegmentDistance for interior and exterior points", () => {
    const seg: Segment2d = { x0: 0, y0: 0, x1: 4, y1: 0 };
    expect(pointToSegmentDistance(2, 0, seg)).toBeCloseTo(0, 6);
    expect(pointToSegmentDistance(2, 3, seg)).toBeCloseTo(3, 6);
    expect(pointToSegmentDistance(-1, 0, seg)).toBeCloseTo(1, 6);
  });

  it("segmentSegmentDistance for disjoint parallel segments", () => {
    const a: Segment2d = { x0: 0, y0: 0, x1: 2, y1: 0 };
    const b: Segment2d = { x0: 0, y0: 5, x1: 2, y1: 5 };
    expect(segmentSegmentDistance(a, b)).toBeCloseTo(5, 6);
  });

  it("areCollinear and interval overlap", () => {
    const a: Segment2d = { x0: 0, y0: 0, x1: 4, y1: 0 };
    const b: Segment2d = { x0: 2, y0: 0, x1: 6, y1: 0 };
    expect(areCollinear(a, b)).toBe(true);
    expect(collinearIntervalOverlap(a, b)).toBeCloseTo(2, 6);
  });

  it("segmentParallelAngle is ~0 for parallel segments", () => {
    const a: Segment2d = { x0: 0, y0: 0, x1: 1, y1: 0 };
    const b: Segment2d = { x0: 0, y0: 1, x1: -2, y1: 1 };
    expect(segmentParallelAngle(a, b)).toBeCloseTo(0, 6);
  });

  it("segmentParallelAngle is ~π/2 for perpendicular segments", () => {
    const a: Segment2d = { x0: 0, y0: 0, x1: 1, y1: 0 };
    const b: Segment2d = { x0: 0, y0: 0, x1: 0, y1: 1 };
    expect(segmentParallelAngle(a, b)).toBeCloseTo(Math.PI / 2, 6);
  });

  it("areCollinear is scale-aware on long segments", () => {
    const long: Segment2d = { x0: 0, y0: 0, x1: 1000, y1: 0 };
    const nearlyOnLine: Segment2d = { x0: 100, y0: 1e-9, x1: 200, y1: 1e-9 };
    const clearlyOffset: Segment2d = { x0: 100, y0: 0.01, x1: 200, y1: 0.01 };

    expect(areCollinear(long, nearlyOnLine)).toBe(true);
    expect(areCollinear(long, clearlyOffset)).toBe(false);
  });
});
