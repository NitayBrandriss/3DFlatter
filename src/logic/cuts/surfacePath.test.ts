import { describe, expect, it } from "vitest";
import { foldedDihedralQuad, stroke, unitQuad, v } from "./cutTestFixtures";
import { tessellateCutStroke, tessellateSurfaceSegment } from "./surfacePath";

function onWingPlane(p: { x: number; y: number; z: number }, wing: "z0" | "x0"): boolean {
  if (wing === "z0") return Math.abs(p.z) < 1e-6;
  return Math.abs(p.x) < 1e-6;
}

describe("surfacePath", () => {
  describe("folded dihedral", () => {
    it("wing A to wing B yields >2 points on surface wings", () => {
      const mesh = foldedDihedralQuad();
      const path = tessellateSurfaceSegment(mesh, v(0.5, 0.3, 0), v(0, 0.3, 0.5));
      expect(path.length).toBeGreaterThan(2);
      for (const p of path) {
        expect(onWingPlane(p, "z0") || onWingPlane(p, "x0")).toBe(true);
      }
    });

    it("closed stroke tessellates with edge crossings on both wings", () => {
      const mesh = foldedDihedralQuad();
      const loop = stroke("folded", [
        v(0.3, 0.2, 0),
        v(0, 0.2, 0.3),
        v(0, 0.4, 0.3),
        v(0.3, 0.4, 0),
        v(0.3, 0.2, 0),
      ]);
      const path = tessellateCutStroke(mesh, loop);
      expect(path.length).toBeGreaterThan(loop.points.length);
      for (const p of path) {
        expect(onWingPlane(p, "z0") || onWingPlane(p, "x0")).toBe(true);
      }
    });
  });

  describe("coplanar unitQuad", () => {
    it("interior segment stays in z=0 with endpoint-only or in-plane path", () => {
      const mesh = unitQuad();
      const path = tessellateSurfaceSegment(mesh, v(0.2, 0.2), v(0.8, 0.8));
      expect(path.length).toBeGreaterThanOrEqual(2);
      for (const p of path) {
        expect(Math.abs(p.z)).toBeLessThan(1e-6);
      }
    });
  });

  describe("fallback", () => {
    it("does not append an off-surface goal as a piercing chord", () => {
      const mesh = unitQuad();
      const path = tessellateSurfaceSegment(mesh, v(0.2, 0.2), v(0.8, 0.8, 5));
      expect(path.length).toBeGreaterThanOrEqual(1);
      expect(path[path.length - 1]).toEqual(v(0.2, 0.2));
    });
  });
});
