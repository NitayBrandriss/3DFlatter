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

/** Local edge slot on a triangle: 0=(v0,v1), 1=(v1,v2), 2=(v2,v0). */
export type EdgeSlot = 0 | 1 | 2;

/** Sentinel in neighborFaceAcrossEdge: no neighbor (boundary, non-manifold, or seam cut). */
export const NO_NEIGHBOR = -1;

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

/** One face incident on an undirected edge, with its local slot index. */
export type EdgeIncident = {
  faceId: FaceIndex;
  slot: EdgeSlot;
};

/**
 * Edge -> list of incident faces (with local slot).
 *
 * Interpretation by incidents.length:
 * - 1: boundary edge
 * - 2: manifold interior edge
 * - >2: non-manifold (unsupported/ambiguous for unfolding PoC)
 */
export type EdgeToFacesMap = Map<EdgeKey, EdgeIncident[]>;

/**
 * Flat neighbor buffer: length = 3 * faceCount.
 * Index via neighborIndex(faceId, slot). Value is faceId or NO_NEIGHBOR (-1).
 *
 * Edge order per face (v0,v1,v2 from packed faces):
 *   slot 0 = (v0,v1), slot 1 = (v1,v2), slot 2 = (v2,v0)
 */
export type NeighborFaceAcrossEdge = Int32Array;

/** Derived topology (adjacency) from `MeshModel.faces`. */
export interface Topology {
  edgeToFaces: EdgeToFacesMap;
  neighborFaceAcrossEdge: NeighborFaceAcrossEdge;
  /** Faces skipped in Pass 1 due to degeneracy (for UI/debug). */
  skippedDegenerateFaceCount: number;
}

/**
 * Stores user-selected cut edges (seams).
 * Deliberately independent of float geometry identity.
 */
export interface SeamRegistry {
  seams: Set<EdgeKey>;
}

/** Index into neighborFaceAcrossEdge for face `faceId` at local edge `slot`. */
export function neighborIndex(faceId: FaceIndex, slot: EdgeSlot): number {
  return 3 * faceId + slot;
}

/** Read neighbor face across edge, or null if none. */
export function getNeighborAcrossEdge(
  topo: Topology,
  faceId: FaceIndex,
  slot: EdgeSlot,
): FaceIndex | null {
  const n = topo.neighborFaceAcrossEdge[neighborIndex(faceId, slot)];
  return n === NO_NEIGHBOR ? null : n;
}

/**
 * Per-face 2D layout in the XY plane. Length = islandFaceCount * 6.
 * For face i in `UnfoldIslandResult.faces` order:
 *   [x0, y0, x1, y1, x2, y2] matching mesh.faces vertex order (v0, v1, v2).
 * 2D winding follows each face's `mesh.faces` order (CCW or CW as stored).
 * One 3D vertex index may appear at different 2D positions on different faces
 * (e.g. across a slit); BFS parent→child hinges copy matching coords on the tree edge only.
 */
export type FlattenedTriangleSoup = Float32Array;

/** Axis-aligned bounds in the unfold XY plane (math Y-up). */
export type Bbox2d = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

/** One island after global layout offsets have been applied. */
export type LayoutedIsland = {
  islandIndex: number;
  faces: FaceIndex[];
  /** Soup in global XY (math Y-up); layout offset already baked in. */
  positions2d: FlattenedTriangleSoup;
  offset: { x: number; y: number };
  bounds: Bbox2d;
};

/** One 2D line segment for a seam edge on a layouted island boundary. */
export type SeamSegment2d = {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
};

/** Full mesh unfold: all islands laid out without mutual overlap. */
export type UnfoldMeshResult = {
  islands: LayoutedIsland[];
  bounds: Bbox2d;
  /** Cut lines in global layout XY; one segment per seam side per incident face. */
  seamSegments: SeamSegment2d[];
  error?: string;
};

/** Result of unfolding one island into the XY plane (zero thickness). */
export interface UnfoldIslandResult {
  /** Face indices unfolded, in stable order (input island order). */
  faces: FaceIndex[];
  /**
   * Packed 2D triangle soup aligned to `faces`.
   * If `error` is set, discard this buffer — it may be partially filled.
   */
  positions2d: FlattenedTriangleSoup;
  /** When set, `positions2d` is invalid and must not be used. */
  error?: string;
}
