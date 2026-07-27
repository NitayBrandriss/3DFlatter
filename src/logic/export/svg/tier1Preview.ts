import type { SeamSegment2d, UnfoldMeshResult } from "../../mesh/types";
import { polygonPointsString } from "../../unfold/soupBounds";
import type { SvgBuildStats } from "./types";

export const TIER1_FACE_FILL = "rgba(200, 220, 240, 0.12)";
export const TIER1_FACE_STROKE = "#7dd3fc";
export const TIER1_SEAM_STROKE = "#ff4444";
export const TIER1_COLLISION_FILL = "rgba(249, 115, 22, 0.85)";
export const TIER1_COLLISION_STROKE = "#9a3412";
export const TIER1_TEAR_STROKE_A = "#fbbf24";
export const TIER1_TEAR_STROKE_B = "#fbbf24";
export const TIER1_BACKGROUND = "#0a1628";

export type Tier1FaceDraw = {
  key: string;
  points: string;
};

export type Tier1SeamDraw = {
  key: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
};

/** Shared face list for SVG export and UnfoldViewer2D (UI-003). */
export function listTier1Faces(result: UnfoldMeshResult): Tier1FaceDraw[] {
  const faces: Tier1FaceDraw[] = [];
  for (const island of result.islands) {
    for (let faceIdx = 0; faceIdx < island.faces.length; faceIdx++) {
      const faceId = island.faces[faceIdx]!;
      faces.push({
        key: `${island.islandIndex}-${faceId}`,
        points: polygonPointsString(island.positions2d, faceIdx),
      });
    }
  }
  return faces;
}

/** Shared seam list for SVG export and UnfoldViewer2D (UI-003). */
export function listTier1Seams(result: UnfoldMeshResult): Tier1SeamDraw[] {
  return result.seamSegments.map((seg, i) => ({
    key: `seam-${i}`,
    x0: seg.x0,
    y0: seg.y0,
    x1: seg.x1,
    y1: seg.y1,
  }));
}

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
  const faceDraws = listTier1Faces(result);
  const polygonParts = faceDraws.map(
    (face) =>
      `<polygon points="${face.points}" fill="${TIER1_FACE_FILL}" stroke="${TIER1_FACE_STROKE}" stroke-width="1" vector-effect="non-scaling-stroke"/>`,
  );

  const seamDraws = includeSeams ? listTier1Seams(result) : [];
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
      facePolygonCount: faceDraws.length,
      seamLineCount: seamDraws.length,
    },
  };
}
