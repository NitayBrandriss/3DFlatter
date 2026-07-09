import {
  SPLIT_2D_MAX_RATIO,
  SPLIT_2D_MIN,
} from "./constants";

export function clampSplitHeight(
  viewportHeight: number,
  proposedPx: number,
  minPx = SPLIT_2D_MIN,
  maxRatio = SPLIT_2D_MAX_RATIO,
): number {
  if (viewportHeight <= 0) {
    return minPx;
  }
  const maxPx = viewportHeight * maxRatio;
  return Math.round(Math.min(maxPx, Math.max(minPx, proposedPx)));
}
