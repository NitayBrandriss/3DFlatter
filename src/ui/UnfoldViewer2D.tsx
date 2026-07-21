"use client";

import { memo } from "react";
import type { UnfoldMeshResult } from "../logic/mesh/types";
import {
  TIER1_BACKGROUND,
  TIER1_COLLISION_FILL,
  TIER1_COLLISION_STROKE,
  TIER1_FACE_FILL,
  TIER1_FACE_STROKE,
  TIER1_SEAM_STROKE,
  TIER1_TEAR_STROKE_A,
  TIER1_TEAR_STROKE_B,
} from "../logic/export/svg/tier1Preview";
import {
  computeSvgViewBox,
  viewBoxAttribute,
} from "../logic/export/svg/viewBox";
import { yFlipGroupTransform } from "../logic/export/svg/yFlip";
import type { QualityIssueCounts } from "../logic/unfold/qualitySummary";
import {
  QUALITY_OVERLAY_MAX_COLLISIONS,
  QUALITY_OVERLAY_MAX_TEARS,
  capForOverlay,
  formatOverlayTruncationHints,
  formatQualityIssueSummary,
} from "../logic/unfold/qualitySummary";
import { polygonPointsString } from "../logic/unfold/soupBounds";

type UnfoldViewer2DProps = {
  result: UnfoldMeshResult | null;
  /** When false, seam overlay segments are omitted (shared with SVG export). */
  showSeams?: boolean;
  showQualityOverlay?: boolean;
  qualityCounts?: QualityIssueCounts | null;
};

export const UnfoldViewer2D = memo(function UnfoldViewer2D({
  result,
  showSeams = true,
  showQualityOverlay = false,
  qualityCounts = null,
}: UnfoldViewer2DProps) {
  if (!result) {
    return (
      <div className="flatten-panel flatten-panel-empty">
        <p className="muted" style={{ margin: 0 }}>
          Click <strong>Flatten</strong> to generate the 2D pattern.
        </p>
      </div>
    );
  }

  const viewBox = computeSvgViewBox(result.bounds);
  const { minY, maxY } = viewBox.bounds;
  const flipTransform = yFlipGroupTransform(minY, maxY);
  const markerRadius = 0.015 * Math.max(viewBox.width, viewBox.height);

  const showOverlay =
    showQualityOverlay &&
    (result.collisions.length > 0 || result.tears.length > 0);
  const cappedCollisions = capForOverlay(result.collisions, QUALITY_OVERLAY_MAX_COLLISIONS);
  const cappedTears = capForOverlay(result.tears, QUALITY_OVERLAY_MAX_TEARS);

  const counts = qualityCounts ?? {
    collisionCount: result.collisions.length,
    tearCount: result.tears.length,
    hasIssues: result.collisions.length > 0 || result.tears.length > 0,
  };
  const truncationHints = showOverlay ? formatOverlayTruncationHints(counts) : [];
  const summary = showOverlay ? formatQualityIssueSummary(counts) : null;

  return (
    <div className="flatten-panel">
      {showOverlay && summary ? (
        <div className="flatten-quality-legend" aria-live="polite">
          <span className="flatten-quality-legend-item">
            <span
              className="flatten-quality-swatch flatten-quality-swatch--collision"
              aria-hidden
            />
            overlaps
          </span>
          <span className="flatten-quality-legend-item">
            <span
              className="flatten-quality-swatch flatten-quality-swatch--tear"
              aria-hidden
            />
            tears
          </span>
          <span className="flatten-quality-legend-counts muted">{summary}</span>
          {truncationHints.length > 0 ? (
            <span className="flatten-quality-legend-truncation muted">
              {truncationHints.join(" · ")}
            </span>
          ) : null}
        </div>
      ) : null}
      <svg
        className="flatten-svg"
        viewBox={viewBoxAttribute(viewBox)}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={
          showOverlay
            ? "Flattened mesh pattern with quality issue overlay"
            : "Flattened mesh pattern"
        }
      >
        <rect
          x={viewBox.x}
          y={viewBox.y}
          width={viewBox.width}
          height={viewBox.height}
          fill={TIER1_BACKGROUND}
        />
        <g transform={flipTransform}>
          {result.islands.map((island) =>
            island.faces.map((faceId, faceIdx) => (
              <polygon
                key={`${island.islandIndex}-${faceId}`}
                points={polygonPointsString(island.positions2d, faceIdx)}
                fill={TIER1_FACE_FILL}
                stroke={TIER1_FACE_STROKE}
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
            )),
          )}
          {showSeams
            ? result.seamSegments.map((seg, i) => (
                <line
                  key={`seam-${i}`}
                  x1={seg.x0}
                  y1={seg.y0}
                  x2={seg.x1}
                  y2={seg.y1}
                  stroke={TIER1_SEAM_STROKE}
                  strokeWidth={2}
                  vectorEffect="non-scaling-stroke"
                />
              ))
            : null}
          {showOverlay ? (
            <g id="quality-overlay">
              {cappedCollisions.visible.map((collision, i) => (
                <circle
                  key={`collision-${i}`}
                  cx={collision.centroid.x}
                  cy={collision.centroid.y}
                  r={markerRadius}
                  fill={TIER1_COLLISION_FILL}
                  stroke={TIER1_COLLISION_STROKE}
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              {cappedTears.visible.map((tear, i) => (
                <g key={`tear-${i}`} data-tear-kind={tear.kind}>
                  <line
                    x1={tear.segmentA.x0}
                    y1={tear.segmentA.y0}
                    x2={tear.segmentA.x1}
                    y2={tear.segmentA.y1}
                    stroke={TIER1_TEAR_STROKE_A}
                    strokeWidth={2}
                    vectorEffect="non-scaling-stroke"
                  />
                  <line
                    x1={tear.segmentB.x0}
                    y1={tear.segmentB.y0}
                    x2={tear.segmentB.x1}
                    y2={tear.segmentB.y1}
                    stroke={TIER1_TEAR_STROKE_B}
                    strokeWidth={2}
                    strokeDasharray="4 3"
                    vectorEffect="non-scaling-stroke"
                  />
                </g>
              ))}
            </g>
          ) : null}
        </g>
      </svg>
    </div>
  );
});
