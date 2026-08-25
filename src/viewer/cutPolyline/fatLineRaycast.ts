import * as THREE from "three";

/** Fallback when camera/FOV is unavailable (legacy world units). */
export const LINE_PICK_THRESHOLD = 0.06;

/**
 * Upper clamp for screen-space world threshold. Slightly above the legacy
 * fixed 0.06 so committed cyan strokes stay clickable at default framing
 * without returning to a zoom-blocking constant.
 */
export const LINE_PICK_THRESHOLD_MAX = 0.1;

/** Default screen-space pick radius (draft rubber-band / in-progress line). */
export const LINE_PICK_TARGET_PX = 12;

/**
 * Wider screen-space target for committed cyan strokes — easier click-to-edit
 * while still scaling down when zoomed (orbit stays usable on drag).
 */
export const COMMITTED_LINE_PICK_TARGET_PX = 16;

/**
 * World-space Line.threshold so the pick cylinder stays ~`targetPx` on screen.
 * Scales down when zoomed in so a dense surface-hug stroke does not cover a
 * whole limb and steal OrbitControls.
 */
export function linePickThresholdForDistance(opts: {
  distance: number;
  fovDeg: number;
  viewportHeightPx: number;
  targetPx?: number;
  minThreshold?: number;
  maxThreshold?: number;
}): number {
  const {
    distance,
    fovDeg,
    viewportHeightPx,
    targetPx = LINE_PICK_TARGET_PX,
    minThreshold = 0.003,
    maxThreshold = LINE_PICK_THRESHOLD_MAX,
  } = opts;

  if (
    !(distance > 0) ||
    !(viewportHeightPx > 0) ||
    !(targetPx > 0) ||
    !(fovDeg > 0)
  ) {
    return LINE_PICK_THRESHOLD;
  }

  const fovRad = (fovDeg * Math.PI) / 180;
  const world =
    (targetPx * 2 * distance * Math.tan(fovRad / 2)) / viewportHeightPx;
  if (!Number.isFinite(world)) return LINE_PICK_THRESHOLD;
  return Math.min(maxThreshold, Math.max(minThreshold, world));
}

const _worldCenter = new THREE.Vector3();

/**
 * Fat-line raycast for THREE.Line so thin polylines remain pickable.
 * Bind as `line.raycast = fatLineRaycast`.
 * Optional `line.userData.viewportHeightPx` / `pickTargetPx` refine scaling.
 */
export function fatLineRaycast(
  this: THREE.Line,
  raycaster: THREE.Raycaster,
  intersects: THREE.Intersection[],
): void {
  const lineParams = raycaster.params.Line ?? { threshold: 1 };
  const prev = lineParams.threshold;

  let threshold = LINE_PICK_THRESHOLD;
  const camera = raycaster.camera;
  if (camera instanceof THREE.PerspectiveCamera) {
    const geo = this.geometry;
    if (!geo.boundingSphere) geo.computeBoundingSphere();
    const sphere = geo.boundingSphere;
    if (sphere) {
      _worldCenter.copy(sphere.center).applyMatrix4(this.matrixWorld);
      const distance = camera.position.distanceTo(_worldCenter);
      const viewportHeightPx =
        typeof this.userData.viewportHeightPx === "number" &&
        this.userData.viewportHeightPx > 0
          ? this.userData.viewportHeightPx
          : 800;
      const pickTargetPx =
        typeof this.userData.pickTargetPx === "number" &&
        this.userData.pickTargetPx > 0
          ? this.userData.pickTargetPx
          : LINE_PICK_TARGET_PX;
      threshold = linePickThresholdForDistance({
        distance,
        fovDeg: camera.fov,
        viewportHeightPx,
        targetPx: pickTargetPx,
      });
    }
  }

  lineParams.threshold = threshold;
  raycaster.params.Line = lineParams;
  THREE.Line.prototype.raycast.call(this, raycaster, intersects);
  lineParams.threshold = prev;
}
