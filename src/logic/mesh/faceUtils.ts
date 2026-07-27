import { makeEdgeKey } from "./edgeKey";
import type { EdgeKey, EdgeSlot, FaceIndex, MeshModel, VertexIndex } from "./types";

/** Packed triangle vertex indices in `mesh.faces` winding order. */
export type FaceVerts = [VertexIndex, VertexIndex, VertexIndex];

/** Local edge slots on a triangle: 0=(v0,v1), 1=(v1,v2), 2=(v2,v0). */
export const EDGE_SLOTS: readonly EdgeSlot[] = [0, 1, 2];

/** Read the three vertex indices for a packed triangle face. */
export function faceVertices(mesh: MeshModel, faceId: FaceIndex): FaceVerts {
  const base = 3 * faceId;
  return [mesh.faces[base]!, mesh.faces[base + 1]!, mesh.faces[base + 2]!];
}

/**
 * Directed edge endpoints for a face slot (mesh.faces winding order):
 * slot 0 = v0→v1, slot 1 = v1→v2, slot 2 = v2→v0.
 */
export function directedEdgeForSlot(
  verts: FaceVerts,
  slot: EdgeSlot,
): [VertexIndex, VertexIndex] {
  const [v0, v1, v2] = verts;
  if (slot === 0) return [v0, v1];
  if (slot === 1) return [v1, v2];
  return [v2, v0];
}

/** Undirected `EdgeKey` for the given face slot. */
export function edgeKeyForFace(
  mesh: MeshModel,
  faceId: FaceIndex,
  slot: EdgeSlot,
): EdgeKey {
  const [va, vb] = directedEdgeForSlot(faceVertices(mesh, faceId), slot);
  return makeEdgeKey(va, vb);
}
