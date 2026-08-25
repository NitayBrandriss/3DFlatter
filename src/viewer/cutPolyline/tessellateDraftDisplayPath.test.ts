import { describe, expect, it } from "vitest";
import { foldedDihedralQuad, unitQuad, v } from "../../logic/cuts/cutTestFixtures";
import { MAX_SURFACE_TESSELLATE_HOPS } from "../../logic/cuts/surfacePath";
import type { DisplayNormalization } from "../displayNormalization";
import {
  appendLastSegmentDisplayPath,
  tessellateDraftDisplayPath,
} from "./tessellateDraftDisplayPath";

const IDENTITY_NORM: DisplayNormalization = {
  centerX: 0,
  centerY: 0,
  centerZ: 0,
  scale: 1,
};

describe("tessellateDraftDisplayPath incremental", () => {
  it("appendLastSegment matches full tessellate for a two-segment path", () => {
    const mesh = foldedDihedralQuad();
    const p0 = v(0.5, 0.3, 0);
    const p1 = v(0, 0.3, 0.5);
    const p2 = v(0, 0.5, 0.4);

    const full = tessellateDraftDisplayPath(mesh, [p0, p1, p2], null, IDENTITY_NORM);

    const afterFirst = appendLastSegmentDisplayPath(
      mesh,
      [],
      p0,
      p1,
      IDENTITY_NORM,
    );
    const incremental = appendLastSegmentDisplayPath(
      mesh,
      afterFirst,
      p1,
      p2,
      IDENTITY_NORM,
    );

    expect(incremental.length).toBe(full.length);
    for (let i = 0; i < full.length; i++) {
      expect(incremental[i]!.x).toBeCloseTo(full[i]!.x, 6);
      expect(incremental[i]!.y).toBeCloseTo(full[i]!.y, 6);
      expect(incremental[i]!.z).toBeCloseTo(full[i]!.z, 6);
    }
  });

  it("single segment on coplanar quad stays in plane", () => {
    const mesh = unitQuad();
    const path = appendLastSegmentDisplayPath(
      mesh,
      [],
      v(0.2, 0.2),
      v(0.8, 0.8),
      IDENTITY_NORM,
    );
    expect(path.length).toBeGreaterThanOrEqual(2);
    for (const p of path) {
      expect(Math.abs(p.z)).toBeLessThan(1e-6);
    }
  });
});

describe("MAX_SURFACE_TESSELLATE_HOPS", () => {
  it("is a finite strict cap", () => {
    expect(MAX_SURFACE_TESSELLATE_HOPS).toBe(2048);
  });
});
