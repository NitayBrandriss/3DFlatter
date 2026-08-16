import * as THREE from "three";
import type { DisplayVec3 } from "./InProgressPolylineLine";

const ndcVec = new THREE.Vector2();
const hitLocal = new THREE.Vector3();
const raycaster = new THREE.Raycaster();

/** Client pixel → NDC for `Raycaster.setFromCamera`. */
export function clientToNdc(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
): { x: number; y: number } | null {
  if (rect.width <= 0 || rect.height <= 0) return null;
  return {
    x: ((clientX - rect.left) / rect.width) * 2 - 1,
    y: -((clientY - rect.top) / rect.height) * 2 + 1,
  };
}

/**
 * Raycast the pickable display mesh; return display-local hit (same space as
 * `PickableMesh` `worldToLocal`). No hit / missing faceIndex → null.
 */
export function raycastDisplayMesh(
  camera: THREE.Camera,
  mesh: THREE.Object3D,
  ndc: { x: number; y: number },
): DisplayVec3 | null {
  ndcVec.set(ndc.x, ndc.y);
  raycaster.setFromCamera(ndcVec, camera);
  const hits = raycaster.intersectObject(mesh, false);
  const hit = hits[0];
  if (!hit || hit.faceIndex == null) return null;
  hitLocal.copy(hit.point);
  mesh.worldToLocal(hitLocal);
  return { x: hitLocal.x, y: hitLocal.y, z: hitLocal.z };
}
