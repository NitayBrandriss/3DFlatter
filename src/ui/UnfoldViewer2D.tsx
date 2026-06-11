"use client";

import type { UnfoldMeshResult } from "../logic/mesh/types";
import { polygonPointsString } from "../logic/unfold/soupBounds";

const VIEW_PADDING_RATIO = 0.05;

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

  const { minX, minY, maxX, maxY } = result.bounds;
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  const pad = Math.max(spanX, spanY) * VIEW_PADDING_RATIO;
  const width = spanX + 2 * pad;
  const height = spanY + 2 * pad;

  // Math Y-up soup; flip keeps content in the original bbox for a standard viewBox.
  const viewBox = `${minX - pad} ${minY - pad} ${width} ${height}`;
  const flipTransform = `translate(0, ${minY + maxY}) scale(1, -1)`;

  return (
    <div className="flatten-panel">
      <svg
        className="flatten-svg"
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Flattened mesh pattern"
      >
        <rect
          x={minX - pad}
          y={minY - pad}
          width={width}
          height={height}
          fill="#0a1628"
        />
        <g transform={flipTransform}>
          {result.islands.map((island) =>
            island.faces.map((faceId, faceIdx) => (
              <polygon
                key={`${island.islandIndex}-${faceId}`}
                points={polygonPointsString(island.positions2d, faceIdx)}
                fill="rgba(200, 220, 240, 0.12)"
                stroke="#7dd3fc"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
            )),
          )}
        </g>
      </svg>
    </div>
  );
}
