import { describe, expect, it } from "vitest";
import { makeMesh } from "../logic/cuts/cutTestFixtures";
import type { CutStroke, Vec3 } from "../logic/cuts/types";
import {
  canonicalToDisplay,
  computeDisplayNormalization,
  displayToCanonical,
  type DisplayNormalization,
} from "./displayNormalization";
import { packCutStrokeDisplaySegments } from "./packCutStrokeDisplaySegments";

function makeNorm(verts: number[]): DisplayNormalization {
  return computeDisplayNormalization(new Float32Array(verts));
}

const UNIT_VERTS = [0, 0, 0, 1, 0, 0, 0, 1, 0];
const UNIT_NORM = makeNorm(UNIT_VERTS);
const UNIT_MESH = makeMesh(UNIT_VERTS, [0, 1, 2]);

function stroke(id: string, points: Vec3[]): CutStroke {
  return { id, points };
}

describe("packCutStrokeDisplaySegments", () => {
  it("emits one segment pair per consecutive stroke points with correct display coords", () => {
    const verts = new Float32Array([0, 0, 0, 2, 0, 0, 0, 2, 0]);
    const norm = computeDisplayNormalization(verts);
    const points: Vec3[] = [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 0.2, y: 0.6, z: 0 },
    ];
    const packed = packCutStrokeDisplaySegments(UNIT_MESH, [{ id: "a", points }], norm);
    expect(packed).not.toBeNull();
    expect(packed!.length).toBe(12);

    const expectedA = canonicalToDisplay(points[0]!, norm);
    const expectedB = canonicalToDisplay(points[1]!, norm);
    expect(packed![0]).toBeCloseTo(expectedA.x, 6);
    expect(packed![1]).toBeCloseTo(expectedA.y, 6);
    expect(packed![2]).toBeCloseTo(expectedA.z, 6);
    expect(packed![3]).toBeCloseTo(expectedB.x, 6);
    expect(packed![4]).toBeCloseTo(expectedB.y, 6);
    expect(packed![5]).toBeCloseTo(expectedB.z, 6);
  });

  it("skips empty and single-point strokes", () => {
    const norm = computeDisplayNormalization(
      new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
    );
    expect(
      packCutStrokeDisplaySegments(
        UNIT_MESH,
        [
          { id: "empty", points: [] },
          { id: "one", points: [{ x: 0, y: 0, z: 0 }] },
        ],
        norm,
      ),
    ).toBeNull();
  });

  it("returns null for empty stroke list", () => {
    expect(packCutStrokeDisplaySegments(UNIT_MESH, [], UNIT_NORM)).toBeNull();
  });

  it("handles a mix of valid and degenerate strokes", () => {
    const strokes: CutStroke[] = [
      stroke("empty", []),
      stroke("one", [{ x: 0, y: 0, z: 0 }]),
      stroke("valid", [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
        { x: 0.2, y: 0.6, z: 0 },
      ]),
      stroke("also-empty", []),
    ];
    const packed = packCutStrokeDisplaySegments(UNIT_MESH, strokes, UNIT_NORM);
    expect(packed).not.toBeNull();
    expect(packed!.length).toBe(12);
  });

  it("preserves segment ordering across multiple strokes", () => {
    const s1: CutStroke = stroke("s1", [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
    ]);
    const s2: CutStroke = stroke("s2", [
      { x: 0.1, y: 0.1, z: 0 },
      { x: 0.4, y: 0.4, z: 0 },
    ]);
    const packed = packCutStrokeDisplaySegments(UNIT_MESH, [s1, s2], UNIT_NORM);
    expect(packed).not.toBeNull();
    expect(packed!.length).toBe(12);

    const firstDisplayStart = { x: packed![0]!, y: packed![1]!, z: packed![2]! };
    const canon = displayToCanonical(firstDisplayStart, UNIT_NORM);
    expect(canon.x).toBeCloseTo(0, 4);
    expect(canon.y).toBeCloseTo(0, 4);
    expect(canon.z).toBeCloseTo(0, 4);
  });

  it("does not pack a piercing chord for off-mesh stroke points", () => {
    const packed = packCutStrokeDisplaySegments(
      UNIT_MESH,
      [
        stroke("off", [
          { x: 0.2, y: 0.2, z: 0 },
          { x: 0.2, y: 0.2, z: 5 },
        ]),
      ],
      UNIT_NORM,
    );
    expect(packed).toBeNull();
  });

  it("produces no NaN/Infinity for zero-scale normalization", () => {
    const degenerateNorm = makeNorm([5, 5, 5, 5, 5, 5, 5, 5, 5]);
    const strokes: CutStroke[] = [
      stroke("a", [
        { x: 5, y: 5, z: 5 },
        { x: 6, y: 5, z: 5 },
      ]),
    ];
    const degenerateMesh = makeMesh([5, 5, 5, 6, 5, 5, 5, 6, 5], [0, 1, 2]);
    const packed = packCutStrokeDisplaySegments(degenerateMesh, strokes, degenerateNorm);
    expect(packed).not.toBeNull();
    for (let i = 0; i < packed!.length; i++) {
      expect(Number.isFinite(packed![i])).toBe(true);
    }
  });

  it("handles extremely large coordinate values without overflow", () => {
    const big = 1e15;
    const norm = makeNorm([0, 0, 0, big, 0, 0, 0, big, 0]);
    const strokes: CutStroke[] = [
      stroke("big", [
        { x: 0, y: 0, z: 0 },
        { x: big, y: 0, z: 0 },
      ]),
    ];
    const bigMesh = makeMesh([0, 0, 0, big, 0, 0, 0, big, 0], [0, 1, 2]);
    const packed = packCutStrokeDisplaySegments(bigMesh, strokes, norm);
    expect(packed).not.toBeNull();
    for (let i = 0; i < packed!.length; i++) {
      expect(Number.isFinite(packed![i])).toBe(true);
    }
  });

  it("handles extremely small coordinate values", () => {
    const norm = makeNorm([0, 0, 0, 1, 0, 0, 0, 1, 0]);
    const strokes: CutStroke[] = [
      stroke("tiny", [
        { x: 0, y: 0, z: 0 },
        { x: 0.05, y: 0.05, z: 0 },
      ]),
    ];
    const packed = packCutStrokeDisplaySegments(UNIT_MESH, strokes, norm);
    expect(packed).not.toBeNull();
    for (let i = 0; i < packed!.length; i++) {
      expect(Number.isFinite(packed![i])).toBe(true);
    }
  });
});
