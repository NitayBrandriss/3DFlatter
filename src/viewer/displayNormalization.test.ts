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
});
