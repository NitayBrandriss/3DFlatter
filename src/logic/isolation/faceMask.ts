import type { FaceIndex } from "../mesh/types";
import type { FaceMask, FloodCombineMode } from "./types";

/** All-zero mask (nothing isolated). */
export function createFaceMask(faceCount: number): FaceMask {
  return new Uint8Array(faceCount);
}

export function cloneFaceMask(mask: FaceMask): FaceMask {
  return new Uint8Array(mask);
}

export function countMaskedFaces(mask: FaceMask): number {
  let n = 0;
  for (let i = 0; i < mask.length; i++) {
    if (mask[i]) n++;
  }
  return n;
}

/** New mask with the given faces set to 1. */
export function maskFromFaces(
  faceCount: number,
  faces: readonly FaceIndex[],
): FaceMask {
  const mask = createFaceMask(faceCount);
  for (const f of faces) {
    if (f >= 0 && f < faceCount) mask[f] = 1;
  }
  return mask;
}

/**
 * Immutable combine of a flooded component into a mask.
 * Out-of-range face ids are ignored.
 */
export function combineFloodIntoMask(
  mask: FaceMask,
  floodFaces: readonly FaceIndex[],
  mode: FloodCombineMode,
): FaceMask {
  const next =
    mode === "replace" ? createFaceMask(mask.length) : cloneFaceMask(mask);
  const value: 0 | 1 = mode === "subtract" ? 0 : 1;
  for (const f of floodFaces) {
    if (f >= 0 && f < next.length) next[f] = value;
  }
  return next;
}
