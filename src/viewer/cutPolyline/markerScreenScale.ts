/**
 * Uniform local scale so a sphere of `geometryRadius` (in the mesh's parent
 * space) subtends about `targetRadiusPx` on screen. Perspective projection:
 *
 * pixels ≈ (worldRadius / (2 * distance * tan(fov/2))) * viewportHeight
 * worldRadius = geometryRadius * parentScale * localScale
 *
 * Hover/zoom must not change pickability: the same scale is applied to the
 * pick mesh. Clamps avoid vanishing at the near plane or exploding when far.
 */
export function markerScaleForScreenPixels(opts: {
  distance: number;
  fovDeg: number;
  viewportHeightPx: number;
  geometryRadius: number;
  parentScale: number;
  targetRadiusPx: number;
  minScale?: number;
  maxScale?: number;
}): number {
  const {
    distance,
    fovDeg,
    viewportHeightPx,
    geometryRadius,
    parentScale,
    targetRadiusPx,
    minScale = 0.01,
    maxScale = 24,
  } = opts;

  if (
    !(distance > 0) ||
    !(viewportHeightPx > 0) ||
    !(geometryRadius > 0) ||
    !(parentScale > 0) ||
    !(targetRadiusPx > 0)
  ) {
    return 1;
  }

  const fovRad = (fovDeg * Math.PI) / 180;
  const worldRadius =
    (targetRadiusPx * 2 * distance * Math.tan(fovRad / 2)) / viewportHeightPx;
  const scale = worldRadius / (geometryRadius * parentScale);
  if (!Number.isFinite(scale)) return 1;
  return Math.min(maxScale, Math.max(minScale, scale));
}
