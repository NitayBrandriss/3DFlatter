import { describe, expect, it } from "vitest";
import { circleIntersection2d, EPS } from "./placeTriangle2d";

describe("circleIntersection2d", () => {
  it("returns finite candidates when discriminant is negative due to float drift", () => {
    const ax = 0;
    const ay = 0;
    const bx = 1;
    const by = 0;
    const rA = 1;
    // Slightly longer than geometrically possible — would yield negative hSq without clamp.
    const rB = 1 + 1e-9;

    const hit = circleIntersection2d(ax, ay, bx, by, rA, rB);
    expect(hit.ok).toBe(true);
    if (hit.ok) {
      expect(Number.isFinite(hit.p1.x)).toBe(true);
      expect(Number.isFinite(hit.p1.y)).toBe(true);
      expect(Number.isFinite(hit.p2.x)).toBe(true);
      expect(Number.isFinite(hit.p2.y)).toBe(true);
    }
  });

  it("rejects circles that are too far apart", () => {
    const hit = circleIntersection2d(0, 0, 10, 0, 1, 1);
    expect(hit.ok).toBe(false);
    if (!hit.ok) {
      expect(hit.reason).toMatch(/too far apart/i);
    }
  });

  it("rejects coincident centers", () => {
    const hit = circleIntersection2d(0, 0, 0, 0, 1, 1);
    expect(hit.ok).toBe(false);
    if (!hit.ok) {
      expect(hit.reason).toMatch(/coincide/i);
    }
  });

  it("rejects one circle containing the other", () => {
    const hit = circleIntersection2d(0, 0, 0.5, 0, 2, 0.5);
    expect(hit.ok).toBe(false);
    if (!hit.ok) {
      expect(hit.reason).toMatch(/degenerate hinge/i);
    }
  });

  it("returns symmetric candidates on a non-degenerate hinge", () => {
    const hit = circleIntersection2d(0, 0, 3, 0, 2, 2);
    expect(hit.ok).toBe(true);
    if (hit.ok) {
      const midY = (hit.p1.y + hit.p2.y) / 2;
      expect(Math.abs(midY)).toBeLessThan(EPS);
      expect(hit.p1.y).toBeGreaterThan(EPS);
      expect(hit.p2.y).toBeLessThan(-EPS);
    }
  });
});
