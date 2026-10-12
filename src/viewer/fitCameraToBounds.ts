import * as THREE from "three";
import type { DisplayBounds } from "../logic/isolation/maskGeometry";
import type { FaceMask } from "../logic/isolation/types";

export type OrbitFitTarget = {
  target: THREE.Vector3;
  update: () => void;
};

/**
 * Effect key for FitCameraToMesh.
 * Inactive stays `"full"` so a pre-confirm mask edit does not refit.
 * While active, the key changes when the masked face ids change.
 */
export function isolationFrameKey(
  active: boolean,
  mask: FaceMask | null,
): string {
  if (!active || !mask) return "full";
  let key = "iso";
  for (let i = 0; i < mask.length; i++) {
    if (mask[i]) key += `,${i}`;
  }
  return key;
}

/**
 * Active framing uses the isolate bounds. Inactive framing stays `full`
 * (the full-mesh sphere), including when an isolate box is already known.
 */
export function frameBoundsForIsolation(
  active: boolean,
  full: DisplayBounds,
  isolate: DisplayBounds | null,
): DisplayBounds {
  if (active && isolate) return isolate;
  return full;
}

/** Sphere of a display geometry. Three.js uses every position, not the index. */
export function geometryDisplayBounds(
  geometry: THREE.BufferGeometry,
): DisplayBounds | null {
  geometry.computeBoundingSphere();
  const sphere = geometry.boundingSphere;
  if (!sphere) return null;
  return {
    centerX: sphere.center.x,
    centerY: sphere.center.y,
    centerZ: sphere.center.z,
    radius: sphere.radius,
  };
}

/**
 * Place the camera on the same offset FitCameraToMesh has always used,
 * and copy `bounds` center onto the orbit target.
 */
export function applyFitCameraToBounds(
  camera: THREE.Camera,
  controls: OrbitFitTarget | null,
  bounds: DisplayBounds,
): void {
  const radius = bounds.radius || 1;
  const center = new THREE.Vector3(bounds.centerX, bounds.centerY, bounds.centerZ);

  const fov = camera instanceof THREE.PerspectiveCamera ? camera.fov : 50;
  const fovRad = (fov * Math.PI) / 180;
  const distance = radius / Math.sin(fovRad / 2);

  const dir = new THREE.Vector3(1, 0.7, 1).normalize();
  camera.position.copy(center.clone().add(dir.multiplyScalar(distance * 1.15)));
  if (
    camera instanceof THREE.PerspectiveCamera ||
    camera instanceof THREE.OrthographicCamera
  ) {
    camera.near = Math.max(0.01, distance / 100);
    camera.far = distance * 100;
    camera.updateProjectionMatrix();
  }

  if (controls) {
    controls.target.copy(center);
    controls.update();
  }
}
