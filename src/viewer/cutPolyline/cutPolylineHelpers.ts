import {
  isAtCutStrokePointCap,
  shouldAppendCutSample,
  type Vec3Like,
} from "../cutDrawSampling";
import {
  displayToCanonical,
  type DisplayNormalization,
} from "../displayNormalization";

/**
 * Display-space radius for legacy Euclidean near-first checks (tests / optional).
 * Mesh-click auto-close stays off; close is via first-vertex marker (Slice B).
 */
export const CUT_POLYLINE_CLOSE_RADIUS = 0.06;

export type Vec3 = { x: number; y: number; z: number };

export function distSq(a: Vec3Like, b: Vec3Like): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
}

/** True when `displayLocal` is within `radius` of the first placed vertex. */
export function isClosedClick(
  displayLocal: Vec3Like,
  first: Vec3Like,
  radius = CUT_POLYLINE_CLOSE_RADIUS,
): boolean {
  return distSq(displayLocal, first) <= radius * radius;
}

/** A draft commits only with at least two canonical points. */
export function canFinalizeDraft(pointCount: number): boolean {
  return pointCount >= 2;
}

export type IdlePolylineDraft = {
  display: Vec3[];
  canonical: Vec3[];
  editingStrokeId: null;
};

/** Pure Esc/Cancel reset — clears draft clones; does not write Zustand. */
export function idlePolylineDraft(): IdlePolylineDraft {
  return { display: [], canonical: [], editingStrokeId: null };
}

/**
 * Drop the vertex added by the second click of a double-click before finalize.
 * `lastPointerUpAdded` is true only when that pointerup actually appended a point.
 */
export function stripDblClickDuplicate(
  display: readonly Vec3Like[],
  canonical: readonly Vec3[],
  lastPointerUpAdded: boolean,
): { display: Vec3Like[]; canonical: Vec3[] } {
  if (!lastPointerUpAdded || display.length === 0) {
    return {
      display: display.map((p) => ({ ...p })),
      canonical: canonical.map((p) => ({ ...p })),
    };
  }
  return {
    display: display.slice(0, -1).map((p) => ({ ...p })),
    canonical: canonical.slice(0, -1).map((p) => ({ ...p })),
  };
}

export type AppendDraftPointResult =
  | { status: "added"; display: Vec3[]; canonical: Vec3[] }
  | { status: "rejected" }
  | { status: "capped" };

/**
 * Build a closed polyline by appending a duplicate of the first vertex as last.
 * Returns null when there are fewer than two points or twin lengths diverge.
 * If already closed (first === last by exact coords), returns deep copies as-is.
 */
export function closePolylineByDuplicatingFirst(
  display: readonly Vec3Like[],
  canonical: readonly Vec3[],
): { display: Vec3[]; canonical: Vec3[] } | null {
  if (display.length < 2 || display.length !== canonical.length) {
    return null;
  }
  const firstD = display[0]!;
  const firstC = canonical[0]!;
  const lastD = display[display.length - 1]!;
  const alreadyClosed =
    firstD.x === lastD.x && firstD.y === lastD.y && firstD.z === lastD.z;

  const displayCopy = display.map((p) => ({ x: p.x, y: p.y, z: p.z }));
  const canonicalCopy = canonical.map((p) => ({ x: p.x, y: p.y, z: p.z }));
  if (alreadyClosed) {
    return { display: displayCopy, canonical: canonicalCopy };
  }
  displayCopy.push({ x: firstD.x, y: firstD.y, z: firstD.z });
  canonicalCopy.push({ x: firstC.x, y: firstC.y, z: firstC.z });
  return { display: displayCopy, canonical: canonicalCopy };
}

/**
 * Append one display/canonical twin pair. Does not auto-close near the first
 * vertex on mesh click (POLYCUT-001/002 — close via first-vertex marker).
 */
export function appendPolylineDraftPoint(
  display: readonly Vec3Like[],
  canonical: readonly Vec3[],
  displayLocal: Vec3Like,
  normalization: DisplayNormalization,
): AppendDraftPointResult {
  const prev = display[display.length - 1];
  if (!shouldAppendCutSample(prev, displayLocal)) {
    return { status: "rejected" };
  }
  if (isAtCutStrokePointCap(display.length)) {
    return { status: "capped" };
  }
  const nextCanonical = displayToCanonical(displayLocal, normalization);
  return {
    status: "added",
    display: [
      ...display.map((p) => ({ x: p.x, y: p.y, z: p.z })),
      { x: displayLocal.x, y: displayLocal.y, z: displayLocal.z },
    ],
    canonical: [
      ...canonical.map((p) => ({ x: p.x, y: p.y, z: p.z })),
      {
        x: nextCanonical.x,
        y: nextCanonical.y,
        z: nextCanonical.z,
      },
    ],
  };
}

/**
 * Cap toast fires once per draft: first capped attempt notifies; later ones do not.
 */
export function takeCapToastNotification(alreadyShown: boolean): {
  notify: boolean;
  shown: boolean;
} {
  if (alreadyShown) return { notify: false, shown: true };
  return { notify: true, shown: true };
}

export { shouldAppendCutSample };

/** Exact first===last close (marker-close / POLYCUT-011 pairing). */
export function isExactlyClosedPolyline(
  display: readonly Vec3Like[],
): boolean {
  if (display.length < 3) return false;
  const first = display[0]!;
  const last = display[display.length - 1]!;
  return first.x === last.x && first.y === last.y && first.z === last.z;
}

/**
 * POLYCUT-010: write one display/canonical twin. If `pairClosed`, also copy
 * endpoint 0 ↔ n−1 (POLYCUT-011). Mutates in place.
 */
export function writePlacedTwin(
  display: Vec3[],
  canonical: Vec3[],
  index: number,
  displayLocal: Vec3Like,
  normalization: DisplayNormalization,
  pairClosed: boolean,
): void {
  if (index < 0 || index >= display.length || display.length !== canonical.length) {
    return;
  }
  display[index] = {
    x: displayLocal.x,
    y: displayLocal.y,
    z: displayLocal.z,
  };
  const nextCanonical = displayToCanonical(displayLocal, normalization);
  canonical[index] = {
    x: nextCanonical.x,
    y: nextCanonical.y,
    z: nextCanonical.z,
  };
  if (!pairClosed || display.length < 3) return;
  const last = display.length - 1;
  if (index === 0) {
    display[last] = { x: display[0]!.x, y: display[0]!.y, z: display[0]!.z };
    canonical[last] = {
      x: canonical[0]!.x,
      y: canonical[0]!.y,
      z: canonical[0]!.z,
    };
  } else if (index === last) {
    display[0] = { x: display[last]!.x, y: display[last]!.y, z: display[last]!.z };
    canonical[0] = {
      x: canonical[last]!.x,
      y: canonical[last]!.y,
      z: canonical[last]!.z,
    };
  }
}

/** Sparse segment start indices incident to `index` (for overlay retessellate). */
export function incidentSparseSegmentStarts(
  pointCount: number,
  index: number,
  closed: boolean,
): number[] {
  if (pointCount < 2 || index < 0 || index >= pointCount) return [];
  const starts = new Set<number>();
  if (index > 0) starts.add(index - 1);
  if (index < pointCount - 1) starts.add(index);
  if (closed && pointCount >= 3) {
    if (index === 0) starts.add(pointCount - 2);
    if (index === pointCount - 1) starts.add(0);
  }
  return [...starts].sort((a, b) => a - b);
}

export function excludeCutStrokeById<T extends { id: string }>(
  strokes: readonly T[],
  id: string | null,
): readonly T[] {
  if (!id) return strokes;
  return strokes.filter((s) => s.id !== id);
}

/**
 * Visible draft-marker count. Closed strokes hide the duplicate last vertex
 * so it does not occlude the amber first marker (POLYCUT-C-003).
 */
export function draftMarkerCount(
  pointCount: number,
  closed: boolean,
): number {
  if (pointCount <= 0) return 0;
  if (closed && pointCount >= 3) return pointCount - 1;
  return pointCount;
}

/**
 * Any in-progress draft (new or committed re-edit) blocks committed-stroke pick
 * so mesh clicks still place / unsaved edits are not discarded (POLYCUT-D-001).
 * `editingStrokeId` is retained for call-site clarity; pick is gated on draftActive.
 */
export function canPickCommittedStroke(
  draftActive: boolean,
  _editingStrokeId: string | null,
  dragging: boolean,
): boolean {
  if (dragging) return false;
  return !draftActive;
}
