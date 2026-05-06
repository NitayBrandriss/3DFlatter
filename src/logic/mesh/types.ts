/**
 * Core mesh + topology contracts.
 *
 * ADR 0001 constraints:
 * - Mesh is canonicalized into packed vertex/triangle buffers (triangulated, 0-based indices).
 * - Undirected edges use a stable key based on sorted vertex indices.
 * - Seams are stored as a Set of stable EdgeKeys.
 */

/** Face index in the triangulated mesh (0..faceCount-1). */
export type FaceIndex = number;

/** Vertex index in the mesh (0..vertexCount-1). */
export type VertexIndex = number;

/**
 * Stable undirected edge identity.
 * Always uses sorted vertex indices: `${min},${max}` (e.g. `"12,98"`).
 */
export type EdgeKey = `${number},${number}`;

/**
 * A triangulated face represented by three vertex indices.
 * This is the "logical" view of a face; the canonical storage is packed `MeshModel.faces`.
 */
export interface MeshFace {
  id: FaceIndex;
  v0: VertexIndex;
  v1: VertexIndex;
  v2: VertexIndex;
}

/**
 * An undirected mesh edge.
 * `a` and `b` are the sorted endpoints (a < b) to match EdgeKey stability.
 */
export interface MeshEdge {
  key: EdgeKey;
  a: VertexIndex;
  b: VertexIndex;
}

/**
 * Canonical in-memory mesh format (ADR 0001).
 *
 * - `vertices` is xyz-packed: length = 3 * vertexCount
 * - `faces` is triangle-index-packed: length = 3 * faceCount
 */
export interface MeshModel {
  vertices: Float32Array;
  faces: Uint32Array;
  vertexCount: number;
  faceCount: number;
}

/**
 * Edge -> list of incident faces.
 *
 * Interpretation:
 * - 1 face: boundary edge
 * - 2 faces: manifold interior edge
 * - >2 faces: non-manifold (unsupported/ambiguous for unfolding PoC)
 */
export type EdgeToFacesMap = Map<EdgeKey, FaceIndex[]>;

/**
 * For each face, store the neighbor face across each of its 3 directed triangle edges:
 *   edge0 = (v0,v1)
 *   edge1 = (v1,v2)
 *   edge2 = (v2,v0)
 *
 * `null` means boundary or ambiguous (and later, will also represent "cut" seams).
 */
export type FaceNeighborTriplet = readonly [
  FaceIndex | null,
  FaceIndex | null,
  FaceIndex | null,
];

/** Indexed by faceId. */
export type NeighborFaceAcrossEdge = FaceNeighborTriplet[];

/** Derived topology (adjacency) from `MeshModel.faces`. */
export interface Topology {
  edgeToFaces: EdgeToFacesMap;
  neighborFaceAcrossEdge: NeighborFaceAcrossEdge;
}

/**
 * Stores user-selected cut edges (seams).
 * Deliberately independent of float geometry identity.
 */
export interface SeamRegistry {
  seams: Set<EdgeKey>;
}

/** Utility: build a stable undirected edge key from two vertex indices. */
export type MakeEdgeKey = (i: VertexIndex, j: VertexIndex) => EdgeKey;

