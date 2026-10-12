import * as THREE from "three";
import {
  isolateDisplayBounds,
  splitIsolationIndexBuffers,
  type DisplayBounds,
} from "../logic/isolation/maskGeometry";
import type { FaceMask } from "../logic/isolation/types";
import type { FaceIndex, MeshModel } from "../logic/mesh/types";
import {
  computeDisplayNormalization,
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

export type IsolationDisplayGeometries = {
  isolateGeometry: THREE.BufferGeometry;
  ghostGeometry: THREE.BufferGeometry;
  isolateFaceIds: readonly FaceIndex[];
  isolateBounds: DisplayBounds | null;
};

/**
 * Display vertices from an already-computed normalization.
 * `computeDisplayVertices` would call `computeDisplayNormalization` again;
 * displayNormalization.ts stays the single formula, applied here once.
 */
function applyDisplayNormalization(
  canonicalVertices: Float32Array,
  normalization: DisplayNormalization,
): Float32Array {
  const { centerX, centerY, centerZ, scale } = normalization;
  const out = new Float32Array(canonicalVertices.length);
  for (let i = 0; i < canonicalVertices.length; i += 3) {
    out[i] = (canonicalVertices[i]! - centerX) * scale;
    out[i + 1] = (canonicalVertices[i + 1]! - centerY) * scale;
    out[i + 2] = (canonicalVertices[i + 2]! - centerZ) * scale;
  }
  return out;
}

function indexedDisplayGeometry(
  positions: Float32Array,
  indices: Uint32Array,
): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  if (indices.length > 0) {
    geometry.computeVertexNormals();
  }
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * Build display geometry and a pick-aligned mesh snapshot from canonical store data.
 * Normalization runs exactly once so render, raycast resolve, and overlays agree.
 */
export function buildDisplayMeshAssets(mesh: MeshModel): DisplayMeshAssets {
  const normalization = computeDisplayNormalization(mesh.vertices);
  const displayVertices = applyDisplayNormalization(mesh.vertices, normalization);

  const geometry = indexedDisplayGeometry(displayVertices, new Uint32Array(mesh.faces));

  const displayMesh: MeshModel = {
    ...mesh,
    vertices: displayVertices,
  };

  return { geometry, displayMesh, normalization };
}

/**
 * Ghost remainder raycast. Writes no hits — same contract as SeamOverlay
 * `raycast={() => undefined}` — so pointer and cut rays miss the ghost.
 */
export function ghostMeshRaycast(
  raycaster: THREE.Raycaster,
  intersects: THREE.Intersection[],
): void {
  // Same contract as SeamOverlay `raycast={() => undefined}`: record nothing.
  void raycaster;
  void intersects;
}

/**
 * Isolate and ghost geometries sharing the full display position buffer from
 * `assets`. Does not normalize again. Null when the mask length disagrees
 * with the mesh (caller keeps the full pick mesh).
 */
export function isolationGeometriesFromDisplay(
  assets: DisplayMeshAssets,
  mesh: MeshModel,
  mask: FaceMask,
): IsolationDisplayGeometries | null {
  if (mask.length !== mesh.faceCount) return null;
  const split = splitIsolationIndexBuffers(mesh, mask);
  const positions = assets.displayMesh.vertices;
  return {
    isolateGeometry: indexedDisplayGeometry(positions, split.isolateIndices),
    ghostGeometry: indexedDisplayGeometry(positions, split.ghostIndices),
    isolateFaceIds: split.isolateFaceIds,
    isolateBounds: isolateDisplayBounds(positions, split.isolateIndices),
  };
}

/** One full-mesh `buildDisplayMeshAssets` call, then both index buffers. */
export function buildActiveIsolationGeometries(
  mesh: MeshModel,
  mask: FaceMask,
): IsolationDisplayGeometries & { assets: DisplayMeshAssets } {
  const assets = buildDisplayMeshAssets(mesh);
  const parts = isolationGeometriesFromDisplay(assets, mesh, mask);
  if (!parts) {
    throw new Error(
      `buildActiveIsolationGeometries: mask length ${mask.length} !== faceCount ${mesh.faceCount}`,
    );
  }
  return { assets, ...parts };
}
