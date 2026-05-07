import * as THREE from "three";
import type { MeshModel } from "../logic/mesh/types";

export function meshModelToGeometry(mesh: MeshModel): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(mesh.vertices, 3));
  geometry.setIndex(new THREE.BufferAttribute(mesh.faces, 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

