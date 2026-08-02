import { describe, expect, it } from "vitest";
import {
  CUT_DRAW_MAX_STROKE_POINTS,
  shouldAppendCutSample,
} from "../cutDrawSampling";
import type { DisplayNormalization } from "../displayNormalization";
import {
  CUT_POLYLINE_CLOSE_RADIUS,
  appendPolylineDraftPoint,
  canFinalizeDraft,
  isClosedClick,
  stripDblClickDuplicate,
  takeCapToastNotification,
} from "./cutPolylineHelpers";

const IDENTITY_NORM: DisplayNormalization = {
  centerX: 0,
  centerY: 0,
  centerZ: 0,
  scale: 1,
};

describe("cutPolylineHelpers", () => {
  it("isClosedClick detects clicks within close radius of first vertex", () => {
    const first = { x: 0, y: 0, z: 0 };
    expect(isClosedClick({ x: 0.01, y: 0, z: 0 }, first)).toBe(true);
    expect(
      isClosedClick(
        { x: CUT_POLYLINE_CLOSE_RADIUS, y: 0, z: 0 },
        first,
      ),
    ).toBe(true);
    expect(
      isClosedClick(
        { x: CUT_POLYLINE_CLOSE_RADIUS + 0.001, y: 0, z: 0 },
        first,
      ),
    ).toBe(false);
  });

  it("shouldAppendCutSample rejects samples closer than min distance", () => {
    const prev = { x: 0, y: 0, z: 0 };
    expect(shouldAppendCutSample(prev, { x: 0.001, y: 0, z: 0 })).toBe(false);
    expect(shouldAppendCutSample(prev, { x: 0.02, y: 0, z: 0 })).toBe(true);
  });

  it("canFinalizeDraft requires at least two points", () => {
    expect(canFinalizeDraft(0)).toBe(false);
    expect(canFinalizeDraft(1)).toBe(false);
    expect(canFinalizeDraft(2)).toBe(true);
    expect(canFinalizeDraft(CUT_DRAW_MAX_STROKE_POINTS)).toBe(true);
  });

  it("stripDblClickDuplicate removes last point only when last pointerup added", () => {
    const display = [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 1.02, y: 0, z: 0 },
    ];
    const canonical = [
      { x: 0, y: 0, z: 0 },
      { x: 10, y: 0, z: 0 },
      { x: 10.2, y: 0, z: 0 },
    ];

    const stripped = stripDblClickDuplicate(display, canonical, true);
    expect(stripped.display).toHaveLength(2);
    expect(stripped.canonical).toHaveLength(2);
    expect(stripped.display[1]).toEqual({ x: 1, y: 0, z: 0 });
    expect(stripped.canonical[1]).toEqual({ x: 10, y: 0, z: 0 });

    const kept = stripDblClickDuplicate(display, canonical, false);
    expect(kept.display).toHaveLength(3);
    expect(kept.canonical).toHaveLength(3);
  });

  it("stripDblClickDuplicate does not mutate inputs", () => {
    const display = [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }];
    const canonical = [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
    ];
    const stripped = stripDblClickDuplicate(display, canonical, true);
    stripped.display[0]!.x = 99;
    expect(display[0]!.x).toBe(0);
  });

  it("appendPolylineDraftPoint near first vertex appends open stroke (no auto-close)", () => {
    const display = [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
    ];
    const canonical = [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
    ];
    const nearFirst = { x: 0.01, y: 0, z: 0 };
    expect(isClosedClick(nearFirst, display[0]!)).toBe(true);

    const result = appendPolylineDraftPoint(
      display,
      canonical,
      nearFirst,
      IDENTITY_NORM,
    );
    expect(result.status).toBe("added");
    if (result.status !== "added") return;
    expect(result.display).toHaveLength(3);
    expect(result.canonical).toHaveLength(3);
    expect(result.display[2]).toEqual(nearFirst);
    // Open polyline: last is the click, not a duplicate of first at end as close.
    expect(result.canonical[2]).toEqual(nearFirst);
    expect(result.display[0]).not.toBe(result.display[2]);
  });

  it("appendPolylineDraftPoint keeps display/canonical twin lengths aligned", () => {
    let display: { x: number; y: number; z: number }[] = [];
    let canonical: { x: number; y: number; z: number }[] = [];

    const points = [
      { x: 0, y: 0, z: 0 },
      { x: 0.5, y: 0, z: 0 },
      { x: 1, y: 0.5, z: 0 },
    ];
    for (const p of points) {
      const result = appendPolylineDraftPoint(
        display,
        canonical,
        p,
        IDENTITY_NORM,
      );
      expect(result.status).toBe("added");
      if (result.status !== "added") return;
      display = result.display;
      canonical = result.canonical;
      expect(display).toHaveLength(canonical.length);
    }
    expect(display).toHaveLength(3);
  });

  it("appendPolylineDraftPoint returns capped at max stroke points", () => {
    const display = Array.from({ length: CUT_DRAW_MAX_STROKE_POINTS }, (_, i) => ({
      x: i * 0.02,
      y: 0,
      z: 0,
    }));
    const canonical = display.map((p) => ({ ...p }));
    const result = appendPolylineDraftPoint(
      display,
      canonical,
      { x: CUT_DRAW_MAX_STROKE_POINTS * 0.02 + 0.02, y: 0, z: 0 },
      IDENTITY_NORM,
    );
    expect(result.status).toBe("capped");
  });

  it("takeCapToastNotification fires only once per draft", () => {
    const first = takeCapToastNotification(false);
    expect(first).toEqual({ notify: true, shown: true });
    const second = takeCapToastNotification(first.shown);
    expect(second).toEqual({ notify: false, shown: true });
  });

  it("strip after near-first append yields open finalize-ready polyline", () => {
    const afterNearFirst = appendPolylineDraftPoint(
      [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
      ],
      [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
      ],
      { x: 0.01, y: 0, z: 0 },
      IDENTITY_NORM,
    );
    expect(afterNearFirst.status).toBe("added");
    if (afterNearFirst.status !== "added") return;

    const stripped = stripDblClickDuplicate(
      afterNearFirst.display,
      afterNearFirst.canonical,
      true,
    );
    expect(stripped.display).toHaveLength(2);
    expect(canFinalizeDraft(stripped.canonical.length)).toBe(true);
    const first = stripped.canonical[0]!;
    const last = stripped.canonical[stripped.canonical.length - 1]!;
    expect(first.x === last.x && first.y === last.y && first.z === last.z).toBe(
      false,
    );
  });
});
