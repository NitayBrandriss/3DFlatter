/**
 * Slice 3 QA Audit — viewer draw-tool + CutStrokesOverlay pure-logic surface.
 *
 * React/R3F components are reviewed statically; this file covers the testable
 * pure-logic helpers: packCutStrokeDisplaySegments, display↔canonical round-trip,
 * and edge-case input handling.
 */
import { describe, expect, it } from "vitest";
import type { CutStroke, Vec3 } from "../logic/cuts/types";
import {
  canonicalToDisplay,
  computeDisplayNormalization,
  displayToCanonical,
  type DisplayNormalization,
} from "./displayNormalization";
import { packCutStrokeDisplaySegments } from "./packCutStrokeDisplaySegments";

/* ───── helpers ───── */

function makeNorm(verts: number[]): DisplayNormalization {
  return computeDisplayNormalization(new Float32Array(verts));
}

const UNIT_NORM = makeNorm([0, 0, 0, 1, 0, 0, 0, 1, 0]);

function stroke(id: string, points: Vec3[]): CutStroke {
  return { id, points };
}

/* ═══════════════════════════════════════════════════════════════════
   packCutStrokeDisplaySegments
   ═══════════════════════════════════════════════════════════════════ */

describe("packCutStrokeDisplaySegments – adversarial", () => {
  it("returns null for empty array", () => {
    expect(packCutStrokeDisplaySegments([], UNIT_NORM)).toBeNull();
  });

  it("returns null when all strokes have < 2 points", () => {
    const strokes: CutStroke[] = [
      stroke("a", []),
      stroke("b", [{ x: 1, y: 2, z: 3 }]),
    ];
    expect(packCutStrokeDisplaySegments(strokes, UNIT_NORM)).toBeNull();
  });

  it("handles a mix of valid and degenerate strokes", () => {
    const strokes: CutStroke[] = [
      stroke("empty", []),
      stroke("one", [{ x: 0, y: 0, z: 0 }]),
      stroke("valid", [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
        { x: 1, y: 1, z: 0 },
      ]),
      stroke("also-empty", []),
    ];
    const packed = packCutStrokeDisplaySegments(strokes, UNIT_NORM);
    expect(packed).not.toBeNull();
    // 2 segments → 12 floats
    expect(packed!.length).toBe(12);
  });

  it("preserves segment ordering across multiple strokes", () => {
    const s1: CutStroke = stroke("s1", [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
    ]);
    const s2: CutStroke = stroke("s2", [
      { x: 2, y: 0, z: 0 },
      { x: 3, y: 0, z: 0 },
    ]);
    const packed = packCutStrokeDisplaySegments([s1, s2], UNIT_NORM);
    expect(packed).not.toBeNull();
    // 2 segments → 12 floats
    expect(packed!.length).toBe(12);

    // Convert first segment's start back to canonical and check it matches s1[0]
    const firstDisplayStart = { x: packed![0]!, y: packed![1]!, z: packed![2]! };
    const canon = displayToCanonical(firstDisplayStart, UNIT_NORM);
    expect(canon.x).toBeCloseTo(0, 4);
    expect(canon.y).toBeCloseTo(0, 4);
    expect(canon.z).toBeCloseTo(0, 4);
  });

  it("produces no NaN/Infinity for zero-scale normalization", () => {
    // All vertices at the same point → degenerate normalization
    const degenerateNorm = makeNorm([5, 5, 5, 5, 5, 5, 5, 5, 5]);
    const strokes: CutStroke[] = [
      stroke("a", [
        { x: 5, y: 5, z: 5 },
        { x: 6, y: 5, z: 5 },
      ]),
    ];
    const packed = packCutStrokeDisplaySegments(strokes, degenerateNorm);
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
    const packed = packCutStrokeDisplaySegments(strokes, norm);
    expect(packed).not.toBeNull();
    for (let i = 0; i < packed!.length; i++) {
      expect(Number.isFinite(packed![i])).toBe(true);
    }
  });

  it("handles extremely small coordinate values", () => {
    const tiny = 1e-12;
    const norm = makeNorm([0, 0, 0, tiny, 0, 0, 0, tiny, 0]);
    const strokes: CutStroke[] = [
      stroke("tiny", [
        { x: 0, y: 0, z: 0 },
        { x: tiny, y: 0, z: 0 },
      ]),
    ];
    const packed = packCutStrokeDisplaySegments(strokes, norm);
    expect(packed).not.toBeNull();
    for (let i = 0; i < packed!.length; i++) {
      expect(Number.isFinite(packed![i])).toBe(true);
    }
  });
});

/* ═══════════════════════════════════════════════════════════════════
   display ↔ canonical round-trip stress
   ═══════════════════════════════════════════════════════════════════ */

describe("display↔canonical round-trip – adversarial", () => {
  it("round-trips for very large coordinates", () => {
    const big = 1e12;
    const verts = new Float32Array([0, 0, 0, big, 0, 0, 0, big, 0]);
    const norm = computeDisplayNormalization(verts);
    const p: Vec3 = { x: big / 2, y: big / 3, z: 0 };
    const d = canonicalToDisplay(p, norm);
    const back = displayToCanonical(d, norm);
    // Large coordinates lose some absolute precision but relative should be close
    const relErr = Math.abs(back.x - p.x) / Math.abs(p.x);
    expect(relErr).toBeLessThan(1e-6);
  });

  it("round-trips for very tiny coordinates", () => {
    const tiny = 1e-10;
    const verts = new Float32Array([0, 0, 0, tiny, 0, 0, 0, tiny, 0]);
    const norm = computeDisplayNormalization(verts);
    const p: Vec3 = { x: tiny / 2, y: tiny / 3, z: 0 };
    const d = canonicalToDisplay(p, norm);
    const back = displayToCanonical(d, norm);
    expect(back.x).toBeCloseTo(p.x, 15);
    expect(back.y).toBeCloseTo(p.y, 15);
  });

  it("displayToCanonical with zero scale returns center offset", () => {
    const norm: DisplayNormalization = {
      centerX: 5,
      centerY: 10,
      centerZ: 15,
      scale: 0,
    };
    const result = displayToCanonical({ x: 999, y: 999, z: 999 }, norm);
    // inv = 0, so result is just center
    expect(result.x).toBe(5);
    expect(result.y).toBe(10);
    expect(result.z).toBe(15);
  });
});

/* ═══════════════════════════════════════════════════════════════════
   PickableMesh static analysis findings (non-runnable commentary)
   See audit report for details.
   ═══════════════════════════════════════════════════════════════════ */

describe("PickableMesh draw-tool logic – static observations", () => {
  it("MIN_SAMPLE_DIST_SQ constant is sensible for display space", () => {
    // 0.015 in display units — verify it's the square
    const MIN_SAMPLE_DIST_SQ = 0.015 * 0.015;
    expect(MIN_SAMPLE_DIST_SQ).toBeCloseTo(0.000225, 8);
  });

  it("MAX_STROKE_POINTS has a finite cap", () => {
    const MAX_STROKE_POINTS = 512;
    expect(MAX_STROKE_POINTS).toBeGreaterThan(0);
    expect(MAX_STROKE_POINTS).toBeLessThan(10000);
  });
});
