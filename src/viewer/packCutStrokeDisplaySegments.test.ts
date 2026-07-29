import { describe, expect, it } from "vitest";
import type { Vec3 } from "../logic/cuts/types";
import { computeDisplayNormalization } from "./displayNormalization";
import { packCutStrokeDisplaySegments } from "./packCutStrokeDisplaySegments";

describe("packCutStrokeDisplaySegments", () => {
  it("emits one segment pair per consecutive stroke points", () => {
    const verts = new Float32Array([0, 0, 0, 2, 0, 0, 0, 2, 0]);
    const norm = computeDisplayNormalization(verts);
    const points: Vec3[] = [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 1, y: 1, z: 0 },
    ];
    const packed = packCutStrokeDisplaySegments([{ id: "a", points }], norm);
    expect(packed).not.toBeNull();
    expect(packed!.length).toBe(12);
  });

  it("skips empty and single-point strokes", () => {
    const norm = computeDisplayNormalization(
      new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
    );
    expect(
      packCutStrokeDisplaySegments(
        [
          { id: "empty", points: [] },
          { id: "one", points: [{ x: 0, y: 0, z: 0 }] },
        ],
        norm,
      ),
    ).toBeNull();
  });
});
