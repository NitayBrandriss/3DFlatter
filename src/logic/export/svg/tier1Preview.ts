import type { SeamSegment2d, UnfoldMeshResult } from "../../mesh/types";
import { polygonPointsString } from "../../unfold/soupBounds";
import type { SvgBuildStats } from "./types";

export const TIER1_FACE_FILL = "rgba(200, 220, 240, 0.12)";
export const TIER1_FACE_STROKE = "#7dd3fc";
export const TIER1_SEAM_STROKE = "#ff4444";
export const TIER1_BACKGROUND = "#0a1628";

function seamLineElement(seg: SeamSegment2d, index: number): string {
  return `<line x1="${seg.x0}" y1="${seg.y0}" x2="${seg.x1}" y2="${seg.y1}" stroke="${TIER1_SEAM_STROKE}" stroke-width="2" vector-effect="non-scaling-stroke" data-seam-index="${index}"/>`;
}

export type Tier1PreviewContent = {
  innerSvg: string;
  stats: Pick<SvgBuildStats, "facePolygonCount" | "seamLineCount">;
};

/** Blueprint-style polygon + seam overlay matching UnfoldViewer2D. */
export function buildTier1PreviewContent(
  result: UnfoldMeshResult,
  includeSeams: boolean,
): Tier1PreviewContent {
  const polygonParts: string[] = [];
  let facePolygonCount = 0;

  for (const island of result.islands) {
    for (let faceIdx = 0; faceIdx < island.faces.length; faceIdx++) {
      const points = polygonPointsString(island.positions2d, faceIdx);
      polygonParts.push(
        `<polygon points="${points}" fill="${TIER1_FACE_FILL}" stroke="${TIER1_FACE_STROKE}" stroke-width="1" vector-effect="non-scaling-stroke"/>`,
      );
      facePolygonCount++;
    }
  }

  const seamParts = includeSeams
    ? result.seamSegments.map((seg, i) => seamLineElement(seg, i))
    : [];

  const innerSvg = [
    `<g id="faces">${polygonParts.join("")}</g>`,
    `<g id="seams">${seamParts.join("")}</g>`,
  ].join("");

  return {
    innerSvg,
    stats: {
      facePolygonCount,
      seamLineCount: seamParts.length,
    },
  };
}
