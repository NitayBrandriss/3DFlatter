import * as THREE from "three";
import { SCENE_TARGET_RADIUS } from "./sceneScale";

/** Centers at origin and scales so the bounding sphere matches the scene target radius. */
export function centerAndNormalizeGeometry(geometry: THREE.BufferGeometry): void {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  if (box) {
    const center = box.getCenter(new THREE.Vector3());
    geometry.translate(-center.x, -center.y, -center.z);
  }

  geometry.computeBoundingSphere();
  const sphere = geometry.boundingSphere;
  if (!sphere || sphere.radius < 1e-10) return;

  const scale = SCENE_TARGET_RADIUS / sphere.radius;
  geometry.scale(scale, scale, scale);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
}
