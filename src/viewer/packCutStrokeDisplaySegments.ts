import type { CutStroke } from "../logic/cuts/types";
import {
  canonicalToDisplay,
  type DisplayNormalization,
} from "./displayNormalization";

/**
 * Pack committed cut strokes into LineSegments xyz pairs (display space).
 * Returns null when there are no drawable segments.
 */
export function packCutStrokeDisplaySegments(
  cutStrokes: readonly CutStroke[],
  normalization: DisplayNormalization,
): Float32Array | null {
  let segmentCount = 0;
  for (const stroke of cutStrokes) {
    if (stroke.points.length >= 2) {
      segmentCount += stroke.points.length - 1;
    }
  }
  if (segmentCount === 0) return null;

  const positions = new Float32Array(segmentCount * 6);
  let o = 0;
  for (const stroke of cutStrokes) {
    for (let i = 0; i < stroke.points.length - 1; i++) {
      const a = canonicalToDisplay(stroke.points[i]!, normalization);
      const b = canonicalToDisplay(stroke.points[i + 1]!, normalization);
      positions[o++] = a.x;
      positions[o++] = a.y;
      positions[o++] = a.z;
      positions[o++] = b.x;
      positions[o++] = b.y;
      positions[o++] = b.z;
    }
  }
  return positions;
}
