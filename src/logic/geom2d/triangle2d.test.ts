import { describe, expect, it } from "vitest";
import { collisionAreaThreshold } from "./tolerances";
import { tri } from "./testHelpers";
import {
  clipTriangleArea,
  clipTriangleIntersection,
  isDegenerateTriangle,
  isEdgeOnlyContact,
  normalizeTriangleCCW,
  pointInTriangleStrict,
  satOverlap,
  triangleAvgEdgeLength,
  triangleSignedArea,
  type Triangle2d,
  type Vec2,
} from "./triangle2d";

/** CW reorder of CCW triangle (same geometry, opposite winding). */
function triCW(ax: number, ay: number, bx: number, by: number, cx: number, cy: number): Triangle2d {
  return tri(ax, ay, cx, cy, bx, by);
}

describe("triangle2d", () => {
  it("disjoint triangles: SAT separated, zero overlap area", () => {
    const t1 = tri(0, 0, 2, 0, 1, 2);
    const t2 = tri(10, 0, 12, 0, 11, 2);
    expect(satOverlap(t1, t2)).toBe(false);
    expect(clipTriangleArea(t1, t2)).toBeCloseTo(0, 10);
  });

  it("shared-edge adjacent with identical hinge: edge-only contact, not material overlap", () => {
    const t1 = tri(0, 0, 4, 0, 2, 2);
    const t2 = tri(0, 0, 4, 0, 2, -2);
    const shared = { x0: 0, y0: 0, x1: 4, y1: 0 };
    const overlapPoly = clipTriangleIntersection(t1, t2);
    const area = clipTriangleArea(t1, t2);
    const threshold = collisionAreaThreshold(
      (triangleAvgEdgeLength(t1) + triangleAvgEdgeLength(t2)) / 2,
    );
    expect(satOverlap(t1, t2)).toBe(true);
    expect(isEdgeOnlyContact(overlapPoly, shared, area, threshold)).toBe(true);
    expect(area).toBeLessThanOrEqual(threshold);
  });

  it("adjacent fold-back: interior overlap beyond shared edge is a collision", () => {
    const t1 = tri(0, 0, 4, 0, 2, 2);
    const t2 = tri(0, 0, 4, 0, 2, 1);
    const shared = { x0: 0, y0: 0, x1: 4, y1: 0 };
    const overlapPoly = clipTriangleIntersection(t1, t2);
    const area = clipTriangleArea(t1, t2);
    const threshold = collisionAreaThreshold(triangleAvgEdgeLength(t1));
    expect(satOverlap(t1, t2)).toBe(true);
    expect(area).toBeGreaterThan(threshold);
    expect(isEdgeOnlyContact(overlapPoly, shared, area, threshold)).toBe(false);
    expect(area).toBeCloseTo(2, 6);
  });

  it("one triangle inside another", () => {
    const outer = tri(0, 0, 6, 0, 3, 6);
    const inner = tri(2, 1, 4, 1, 3, 3);
    expect(satOverlap(outer, inner)).toBe(true);
    const area = clipTriangleArea(outer, inner);
    expect(area).toBeCloseTo(triangleSignedArea(inner), 4);
  });

  it("partial overlap has known positive area", () => {
    const t1 = tri(0, 0, 4, 0, 0, 4);
    const t2 = tri(2, 0, 6, 0, 2, 4);
    const area = clipTriangleArea(t1, t2);
    expect(satOverlap(t1, t2)).toBe(true);
    expect(area).toBeCloseTo(2, 6);
  });

  it("CW-wound triangles produce the same overlap area as CCW", () => {
    const ccwA = tri(0, 0, 4, 0, 0, 4);
    const ccwB = tri(2, 0, 6, 0, 2, 4);
    const cwA = triCW(0, 0, 4, 0, 0, 4);
    const cwB = triCW(2, 0, 6, 0, 2, 4);

    expect(triangleSignedArea(cwA)).toBeLessThan(0);
    expect(triangleSignedArea(cwB)).toBeLessThan(0);
    expect(triangleSignedArea(normalizeTriangleCCW(cwA))).toBeGreaterThan(0);

    const ccwArea = clipTriangleArea(ccwA, ccwB);
    expect(clipTriangleArea(cwA, cwB)).toBeCloseTo(ccwArea, 6);
    expect(clipTriangleArea(cwA, ccwB)).toBeCloseTo(ccwArea, 6);
    expect(clipTriangleArea(ccwA, cwB)).toBeCloseTo(ccwArea, 6);
    expect(ccwArea).toBeCloseTo(2, 6);
  });

  it("degenerate collinear triangle is flagged and does not SAT-overlap nontrivial tri", () => {
    const degen = tri(0, 0, 2, 0, 4, 0);
    const solid = tri(0, 0, 2, 0, 1, 1);
    expect(isDegenerateTriangle(degen)).toBe(true);
    expect(isDegenerateTriangle(solid)).toBe(false);
    expect(satOverlap(degen, solid)).toBe(false);
  });

  it("pointInTriangleStrict excludes boundary", () => {
    const t = tri(0, 0, 4, 0, 2, 3);
    const inside: Vec2 = { x: 2, y: 1 };
    const onEdge: Vec2 = { x: 2, y: 0 };
    expect(pointInTriangleStrict(inside, t)).toBe(true);
    expect(pointInTriangleStrict(onEdge, t)).toBe(false);
  });
});
