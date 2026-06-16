import type { MeshModel } from "./types";

const WELD_EPSILON = 1e-6;

/**
 * Merge coincident vertex positions and remap face indices.
 * Required for OBJ files that duplicate corner positions per face.
 */
export function weldVertices(
  vertices: Float32Array,
  faces: Uint32Array,
  epsilon = WELD_EPSILON,
): MeshModel {
  const rawVertexCount = vertices.length / 3;
  const faceCount = faces.length / 3;
  const invEpsilon = 1 / epsilon;

  const keyToIndex = new Map<string, number>();
  const remap = new Uint32Array(rawVertexCount);
  const out = new Float32Array(vertices.length);
  let uniqueCount = 0;

  for (let vi = 0; vi < rawVertexCount; vi++) {
    const base = 3 * vi;
    const x = vertices[base]!;
    const y = vertices[base + 1]!;
    const z = vertices[base + 2]!;
    const key = `${Math.round(x * invEpsilon)},${Math.round(y * invEpsilon)},${Math.round(z * invEpsilon)}`;

    let index = keyToIndex.get(key);
    if (index === undefined) {
      index = uniqueCount++;
      keyToIndex.set(key, index);
      const outBase = 3 * index;
      out[outBase] = x;
      out[outBase + 1] = y;
      out[outBase + 2] = z;
    }

    remap[vi] = index;
  }

  const remappedFaces = new Uint32Array(faces.length);
  for (let i = 0; i < faces.length; i++) {
    remappedFaces[i] = remap[faces[i]!]!;
  }

  return {
    vertices: out.subarray(0, 3 * uniqueCount),
    faces: remappedFaces,
    vertexCount: uniqueCount,
    faceCount,
  };
}
