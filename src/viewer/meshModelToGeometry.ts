import * as THREE from "three";
import type { MeshModel } from "../logic/mesh/types";
import {
  computeDisplayNormalization,
  computeDisplayVertices,
  type DisplayNormalization,
} from "./displayNormalization";

export type DisplayMeshAssets = {
  /** Three.js geometry using display-normalized positions (owned by the caller). */
  geometry: THREE.BufferGeometry;
  /** MeshModel with display vertices; face indices match canonical topology. */
  displayMesh: MeshModel;
  /** Inverse of display verts — maps stroke hits back to canonical coords. */
  normalization: DisplayNormalization;
};

/**
 * Build display geometry and a pick-aligned mesh snapshot from canonical store data.
 * Normalization runs exactly once so render, raycast resolve, and overlays agree.
 */
export function buildDisplayMeshAssets(mesh: MeshModel): DisplayMeshAssets {
  const normalization = computeDisplayNormalization(mesh.vertices);
  const displayVertices = computeDisplayVertices(mesh.vertices);

  const geometry = new THREE.BufferGeometry();
  // Own the display buffer; never attach canonical store vertices to Three.js.
  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(displayVertices, 3),
  );
  geometry.setIndex(
    new THREE.BufferAttribute(new Uint32Array(mesh.faces), 1),
  );
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  const displayMesh: MeshModel = {
    ...mesh,
    vertices: displayVertices,
  };

  return { geometry, displayMesh, normalization };
}
