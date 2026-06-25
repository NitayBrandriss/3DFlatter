/**
 * Central numeric tolerances for 2D geometry (ADR 0003).
 * `SAT_EPS` is the single source of truth — `placeTriangle2d` re-exports it as `EPS`.
 */
export const SAT_EPS = 1e-6;

/** Minimum overlap area for collision reporting. */
export const COLLISION_AREA_ABS = 1e-10;

/** Relative overlap area factor × avgEdgeLength². */
export const COLLISION_AREA_REL = 1e-8;

/** Endpoint gap for tear detection (matches unfold tests). */
export const TEAR_ABS = 1e-4;

/** Relative tear threshold × 3D edge length. */
export const TEAR_REL = 1e-6;

/** Collinearity angle tolerance for tear kind classification (radians). */
export const ANGLE_EPS = 1e-3;

/** Skip collapsed 2D triangles in broad phase when |signedArea2d| < this. */
export const DEGEN_AREA_EPS = 1e-12;

/** Spatial grid minimum cell size. */
export const GRID_MIN_CELL = 1e-6;

/** maxCell = islandBBoxMaxSide / GRID_MAX_CELL_DIVISOR */
export const GRID_MAX_CELL_DIVISOR = 4;

/** Scale-aware minimum overlap area for collision (ADR 0003). */
export function collisionAreaThreshold(avgEdgeLength2d: number): number {
  return Math.max(COLLISION_AREA_ABS, COLLISION_AREA_REL * avgEdgeLength2d ** 2);
}

/** Scale-aware endpoint disagreement threshold for tears (ADR 0003). */
export function tearThreshold(edgeLen3d: number): number {
  return Math.max(TEAR_ABS, TEAR_REL * edgeLen3d);
}
