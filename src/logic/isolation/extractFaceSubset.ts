import type { MeshModel } from "../mesh/types";
import type { FaceMask } from "./types";

/**
 * Ephemeral Flatten subset (ADR 0101): keep the full vertex array so
 * `EdgeKey`s stay valid; pack only faces where `mask[i] === 1`.
 *
 * Face indices in the subset are packed (subset face 0 = first kept original
 * face). Vertex indices are unchanged. Callers that classify strokes must use
 * original FaceIndex on the session mesh, not subset face ids.
 */
export function extractFaceSubset(mesh: MeshModel, mask: FaceMask): MeshModel {
  if (mask.length !== mesh.faceCount) {
    throw new Error(
      `extractFaceSubset: mask length ${mask.length} !== faceCount ${mesh.faceCount}`,
    );
  }

  let included = 0;
  for (let i = 0; i < mesh.faceCount; i++) {
    if (mask[i]) included++;
  }

  const faces = new Uint32Array(included * 3);
  let w = 0;
  for (let i = 0; i < mesh.faceCount; i++) {
    if (!mask[i]) continue;
    const base = 3 * i;
    faces[w++] = mesh.faces[base]!;
    faces[w++] = mesh.faces[base + 1]!;
    faces[w++] = mesh.faces[base + 2]!;
  }

  return {
    vertices: new Float32Array(mesh.vertices),
    faces,
    vertexCount: mesh.vertexCount,
    faceCount: included,
  };
}

/**
 * Guard for Flatten / Slice 3: `buildTopology` throws on faceCount 0.
 * Call before topology on an ephemeral subset.
 */
export function assertSubsetHasFaces(subset: MeshModel): void {
  if (subset.faceCount === 0) {
    throw new Error(
      "assertSubsetHasFaces: empty isolate subset cannot buildTopology",
    );
  }
}
