import { describe, expect, it } from "vitest";
import { foldedDihedralQuad, unitCube, v } from "./cutTestFixtures";
import type { Vec3 } from "./types";
import { tessellateSurfaceSegment } from "./surfacePath";
import { tessellateDraftDisplayPath } from "../../viewer/cutPolyline/tessellateDraftDisplayPath";
import { writePlacedTwin } from "../../viewer/cutPolyline/cutPolylineHelpers";
import type { DisplayNormalization } from "../../viewer/displayNormalization";

const IDENTITY_NORM: DisplayNormalization = {
  centerX: 0,
  centerY: 0,
  centerZ: 0,
  scale: 1,
};

/** True if p is well inside the unit cube (not on a face). */
function isDeepInsideUnitCube(p: Vec3, inset = 0.12): boolean {
  return (
    Math.abs(p.x) < 0.5 - inset &&
    Math.abs(p.y) < 0.5 - inset &&
    Math.abs(p.z) < 0.5 - inset
  );
}

function pathHasThroughVolumeChord(path: readonly Vec3[]): boolean {
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]!;
    const b = path[i + 1]!;
    const mid = {
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
      z: (a.z + b.z) / 2,
    };
    if (isDeepInsideUnitCube(mid)) return true;
  }
  return false;
}

describe("Slice C overlay tessellate — through-volume chords (POLYCUT-C)", () => {
  it("does not chord through the cube between opposite face interiors", () => {
    const mesh = unitCube();
    const path = tessellateSurfaceSegment(
      mesh,
      v(0, 0, 0.5),
      v(0, 0, -0.5),
    );
    expect(pathHasThroughVolumeChord(path)).toBe(false);
  });

  it("does not chord through the cube on a 3-point drag retessellate (+Z → −Z)", () => {
    const mesh = unitCube();
    const display = [
      { x: 0.2, y: 0, z: 0.5 },
      { x: -0.2, y: 0, z: 0.5 },
      { x: 0, y: 0.2, z: 0.5 },
    ];
    const canonical = display.map((p) => ({ ...p }));
    writePlacedTwin(
      display,
      canonical,
      1,
      { x: 0, y: 0, z: -0.5 },
      IDENTITY_NORM,
      false,
    );
    const line = tessellateDraftDisplayPath(
      mesh,
      canonical,
      null,
      IDENTITY_NORM,
    );
    expect(pathHasThroughVolumeChord(line)).toBe(false);
  });

  it("rubber-band tip to the opposite cube face does not tunnel", () => {
    const mesh = unitCube();
    const placed = [v(0.15, 0.1, 0.5), v(-0.1, 0.15, 0.5)];
    const line = tessellateDraftDisplayPath(
      mesh,
      placed,
      v(0, 0, -0.5),
      IDENTITY_NORM,
    );
    expect(pathHasThroughVolumeChord(line)).toBe(false);
  });

  it("walk-fail fallback must not append a piercing chord (off-surface goal)", () => {
    const mesh = unitCube();
    const p0 = v(0, 0, 0.5);
    const p1 = v(0, 0, 0);
    const path = tessellateSurfaceSegment(mesh, p0, p1);
    expect(pathHasThroughVolumeChord(path)).toBe(false);
    expect(path[path.length - 1]).toEqual(p0);
  });

  it("characterizes opposite-face walk: face-local 2D clip stays on the start face", () => {
    const mesh = unitCube();
    const path = tessellateSurfaceSegment(mesh, v(0, 0, 0.5), v(0, 0, -0.5));
    for (const p of path) {
      expect(Math.abs(p.z - 0.5)).toBeLessThan(1e-5);
    }
  });

  it("dihedral drag across the hinge stays on the two wings", () => {
    const mesh = foldedDihedralQuad();
    const display = [
      { x: 0.4, y: 0.3, z: 0 },
      { x: 0.6, y: 0.4, z: 0 },
    ];
    const canonical = display.map((p) => ({ ...p }));
    writePlacedTwin(
      display,
      canonical,
      1,
      { x: 0, y: 0.4, z: 0.6 },
      IDENTITY_NORM,
      false,
    );
    const line = tessellateDraftDisplayPath(
      mesh,
      canonical,
      null,
      IDENTITY_NORM,
    );
    expect(line.length).toBeGreaterThan(2);
    for (const p of line) {
      const onZ0 = Math.abs(p.z) < 1e-5;
      const onX0 = Math.abs(p.x) < 1e-5;
      expect(onZ0 || onX0).toBe(true);
    }
  });
});
