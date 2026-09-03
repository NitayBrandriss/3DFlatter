import type { MeshModel } from "../mesh/types";
import type { FaceMask } from "./types";

/**
 * Ephemeral Flatten subset (ADR 0101): keep the full vertex array so
 * `EdgeKey`s stay valid; pack only faces where `mask[i] === 1`.
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
