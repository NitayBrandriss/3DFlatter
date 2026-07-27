import { WELD_EPSILON } from "../geom2d/tolerances";
import { isIndexDegenerateFace } from "./faceDegeneracy";
import type { MeshModel } from "./types";

export type WeldVerticesResult = {
  mesh: MeshModel;
  /** Triangles dropped after remap because two or more corners share an index. */
  removedDegenerateFaceCount: number;
};

/**
 * Merge coincident vertex positions and remap face indices.
 * Required for OBJ files that duplicate corner positions per face.
 * Drops index-degenerate triangles created by welding (LOGIC-003).
 */
export function weldVertices(
  vertices: Float32Array,
  faces: Uint32Array,
  epsilon = WELD_EPSILON,
): WeldVerticesResult {
  const rawVertexCount = vertices.length / 3;
  const rawFaceCount = faces.length / 3;
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

  const keptFaces = new Uint32Array(faces.length);
  let keptFaceCount = 0;
  let removedDegenerateFaceCount = 0;

  for (let fi = 0; fi < rawFaceCount; fi++) {
    const base = 3 * fi;
    const v0 = remap[faces[base]!]!;
    const v1 = remap[faces[base + 1]!]!;
    const v2 = remap[faces[base + 2]!]!;
    if (isIndexDegenerateFace(v0, v1, v2)) {
      removedDegenerateFaceCount++;
      continue;
    }
    const outBase = 3 * keptFaceCount;
    keptFaces[outBase] = v0;
    keptFaces[outBase + 1] = v1;
    keptFaces[outBase + 2] = v2;
    keptFaceCount++;
  }

  return {
    mesh: {
      vertices: out.subarray(0, 3 * uniqueCount),
      faces: keptFaces.subarray(0, 3 * keptFaceCount),
      vertexCount: uniqueCount,
      faceCount: keptFaceCount,
    },
    removedDegenerateFaceCount,
  };
}
