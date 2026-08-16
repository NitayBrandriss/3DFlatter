import * as THREE from "three";

/** Display-space pick threshold for cut stroke / draft polylines. */
export const LINE_PICK_THRESHOLD = 0.06;

/**
 * Fat-line raycast for THREE.Line so thin polylines remain pickable.
 * Bind as `line.raycast = fatLineRaycast`.
 */
export function fatLineRaycast(
  this: THREE.Line,
  raycaster: THREE.Raycaster,
  intersects: THREE.Intersection[],
): void {
  const lineParams = raycaster.params.Line ?? { threshold: 1 };
  const prev = lineParams.threshold;
  lineParams.threshold = LINE_PICK_THRESHOLD;
  raycaster.params.Line = lineParams;
  THREE.Line.prototype.raycast.call(this, raycaster, intersects);
  lineParams.threshold = prev;
}
