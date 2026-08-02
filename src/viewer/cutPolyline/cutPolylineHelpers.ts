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
 * Display-space radius for click-near-first close-loop detection.
 * Auto-close on mesh click is disabled until Slice B (first-vertex marker).
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
 * Append one display/canonical twin pair. Does not auto-close near the first
 * vertex (POLYCUT-001/002 — close deferred to Slice B markers).
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
