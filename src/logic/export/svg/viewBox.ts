import type { Bbox2d } from "../../mesh/types";
import type { SvgViewBox } from "./types";

export const SVG_VIEW_PADDING_RATIO = 0.05;

/** Compute SVG viewBox from layout bounds (math Y-up). */
export function computeSvgViewBox(
  bounds: Bbox2d,
  paddingRatio = SVG_VIEW_PADDING_RATIO,
): SvgViewBox {
  const { minX, minY, maxX, maxY } = bounds;
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  const pad = Math.max(spanX, spanY) * paddingRatio;
  const width = spanX + 2 * pad;
  const height = spanY + 2 * pad;

  return {
    x: minX - pad,
    y: minY - pad,
    width,
    height,
    pad,
    bounds: { minX, minY, maxX, maxY },
  };
}

/** `viewBox` attribute string for an `<svg>` element. */
export function viewBoxAttribute(viewBox: SvgViewBox): string {
  return `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`;
}
