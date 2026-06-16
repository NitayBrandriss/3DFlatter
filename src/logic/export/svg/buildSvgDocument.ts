import type { UnfoldMeshResult } from "../../mesh/types";
import { buildTier1PreviewContent, TIER1_BACKGROUND } from "./tier1Preview";
import type { SvgBuildResult, SvgExportOptions } from "./types";
import { computeSvgViewBox, viewBoxAttribute } from "./viewBox";
import { yFlipGroupTransform } from "./yFlip";

function escapeXml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export class SvgExportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SvgExportError";
  }
}

/**
 * Build a complete SVG document from an unfold result.
 * Tier 2 (manufacturing) is implemented in a later slice.
 */
export function buildSvgDocument(
  result: UnfoldMeshResult,
  options: SvgExportOptions,
): SvgBuildResult {
  if (result.error) {
    throw new SvgExportError(result.error);
  }
  if (result.islands.length === 0) {
    throw new SvgExportError("No islands to export");
  }

  const tier = options.tier ?? "preview";
  if (tier === "manufacturing") {
    throw new SvgExportError("Manufacturing export is not implemented yet");
  }

  const paddingRatio = options.paddingRatio;
  const viewBox = computeSvgViewBox(result.bounds, paddingRatio);
  const { minX, minY, maxX, maxY } = viewBox.bounds;
  const includeSeams = options.includeSeams ?? true;
  const title = options.title ?? "Flattened mesh pattern";

  const { innerSvg, stats: tier1Stats } = buildTier1PreviewContent(result, includeSeams);
  const flipTransform = yFlipGroupTransform(minY, maxY);

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBoxAttribute(viewBox)}" preserveAspectRatio="xMidYMid meet">`,
    `<title>${escapeXml(title)}</title>`,
    `<rect x="${viewBox.x}" y="${viewBox.y}" width="${viewBox.width}" height="${viewBox.height}" fill="${TIER1_BACKGROUND}"/>`,
    `<g transform="${flipTransform}">`,
    innerSvg,
    `</g>`,
    `</svg>`,
  ].join("");

  return {
    svg,
    viewBox,
    stats: {
      facePolygonCount: tier1Stats.facePolygonCount,
      seamLineCount: tier1Stats.seamLineCount,
      cutPathCount: 0,
      cutSegmentCount: 0,
    },
  };
}
