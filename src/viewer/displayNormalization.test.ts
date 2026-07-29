import { describe, expect, it } from "vitest";
import {
  canonicalToDisplay,
  computeDisplayNormalization,
  computeDisplayVertices,
  displayToCanonical,
} from "./displayNormalization";
import { SCENE_TARGET_RADIUS } from "./sceneScale";

describe("displayNormalization", () => {
  it("round-trips display ↔ canonical for a simple box", () => {
    const verts = new Float32Array([
      0, 0, 0, 10, 0, 0, 10, 10, 0, 0, 10, 0, 0, 0, 10, 10, 0, 10, 10, 10, 10, 0,
      10, 10,
    ]);
    const norm = computeDisplayNormalization(verts);
    const display = computeDisplayVertices(verts);

    for (let i = 0; i < verts.length; i += 3) {
      const c = {
        x: verts[i]!,
        y: verts[i + 1]!,
        z: verts[i + 2]!,
      };
      const d = canonicalToDisplay(c, norm);
      expect(d.x).toBeCloseTo(display[i]!, 6);
      expect(d.y).toBeCloseTo(display[i + 1]!, 6);
      expect(d.z).toBeCloseTo(display[i + 2]!, 6);

      const back = displayToCanonical(d, norm);
      expect(back.x).toBeCloseTo(c.x, 6);
      expect(back.y).toBeCloseTo(c.y, 6);
      expect(back.z).toBeCloseTo(c.z, 6);
    }
  });

  it("places the furthest centered vertex near SCENE_TARGET_RADIUS", () => {
    const verts = new Float32Array([-2, 0, 0, 2, 0, 0, 0, 1, 0]);
    const display = computeDisplayVertices(verts);
    let maxR = 0;
    for (let i = 0; i < display.length; i += 3) {
      const r = Math.hypot(display[i]!, display[i + 1]!, display[i + 2]!);
      maxR = Math.max(maxR, r);
    }
    expect(maxR).toBeCloseTo(SCENE_TARGET_RADIUS, 6);
  });

  it("handles a degenerate single-point mesh without NaN", () => {
    const verts = new Float32Array([1, 2, 3]);
    const norm = computeDisplayNormalization(verts);
    expect(norm.scale).toBe(1);
    const d = computeDisplayVertices(verts);
    expect(d[0]).toBe(0);
    expect(d[1]).toBe(0);
    expect(d[2]).toBe(0);
  });

  it("round-trips for very large coordinates", () => {
    const big = 1e12;
    const verts = new Float32Array([0, 0, 0, big, 0, 0, 0, big, 0]);
    const norm = computeDisplayNormalization(verts);
    const p = { x: big / 2, y: big / 3, z: 0 };
    const d = canonicalToDisplay(p, norm);
    const back = displayToCanonical(d, norm);
    const relErr = Math.abs(back.x - p.x) / Math.abs(p.x);
    expect(relErr).toBeLessThan(1e-6);
  });

  it("round-trips for very tiny coordinates", () => {
    const tiny = 1e-10;
    const verts = new Float32Array([0, 0, 0, tiny, 0, 0, 0, tiny, 0]);
    const norm = computeDisplayNormalization(verts);
    const p = { x: tiny / 2, y: tiny / 3, z: 0 };
    const d = canonicalToDisplay(p, norm);
    const back = displayToCanonical(d, norm);
    expect(back.x).toBeCloseTo(p.x, 15);
    expect(back.y).toBeCloseTo(p.y, 15);
  });

  it("displayToCanonical with zero scale returns center offset", () => {
    const norm = {
      centerX: 5,
      centerY: 10,
      centerZ: 15,
      scale: 0,
    };
    const result = displayToCanonical({ x: 999, y: 999, z: 999 }, norm);
    expect(result.x).toBe(5);
    expect(result.y).toBe(10);
    expect(result.z).toBe(15);
  });
});
