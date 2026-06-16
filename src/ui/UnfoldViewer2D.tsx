"use client";

import type { UnfoldMeshResult } from "../logic/mesh/types";
import { polygonPointsString } from "../logic/unfold/soupBounds";
import {
  computeSvgViewBox,
  viewBoxAttribute,
} from "../logic/export/svg/viewBox";
import { yFlipGroupTransform } from "../logic/export/svg/yFlip";
import {
  TIER1_BACKGROUND,
  TIER1_FACE_FILL,
  TIER1_FACE_STROKE,
  TIER1_SEAM_STROKE,
} from "../logic/export/svg/tier1Preview";

export function UnfoldViewer2D({ result }: { result: UnfoldMeshResult | null }) {
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

  return (
    <div className="flatten-panel">
      <svg
        className="flatten-svg"
        viewBox={viewBoxAttribute(viewBox)}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Flattened mesh pattern"
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
          {result.seamSegments.map((seg, i) => (
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
          ))}
        </g>
      </svg>
    </div>
  );
}
