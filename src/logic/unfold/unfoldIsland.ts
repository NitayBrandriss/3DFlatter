import type {
  EdgeSlot,
  FaceIndex,
  FlattenedTriangleSoup,
  MeshModel,
  Topology,
  UnfoldIslandResult,
  VertexIndex,
} from "../mesh/types";
import { getNeighborAcrossEdge } from "../mesh/types";
import {
  circleIntersection2d,
  distance3d,
  EPS,
  pickCCWCandidate,
  placeRootTriangleCCW,
  signedArea2d,
  type Vec2,
} from "./placeTriangle2d";

const EDGE_SLOTS: EdgeSlot[] = [0, 1, 2];

type FaceVerts = [VertexIndex, VertexIndex, VertexIndex];

/** Read the three vertex indices for a packed triangle face. */
function faceVertices(mesh: MeshModel, faceId: FaceIndex): FaceVerts {
  const base = 3 * faceId;
  return [mesh.faces[base]!, mesh.faces[base + 1]!, mesh.faces[base + 2]!];
}

/**
 * Directed edge endpoints for a face slot (CCW order):
 * slot 0 = v0→v1, slot 1 = v1→v2, slot 2 = v2→v0.
 */
function directedEdgeForSlot(verts: FaceVerts, slot: EdgeSlot): [VertexIndex, VertexIndex] {
  const [v0, v1, v2] = verts;
  if (slot === 0) return [v0, v1];
  if (slot === 1) return [v1, v2];
  return [v2, v0];
}

/** Third vertex of `verts` that is not `va` or `vb`. */
function thirdVertex(verts: FaceVerts, va: VertexIndex, vb: VertexIndex): VertexIndex | null {
  for (const v of verts) {
    if (v !== va && v !== vb) return v;
  }
  return null;
}

/** Slot on `faceId` whose neighbor across the edge is `targetNeighbor`. */
function slotTowardNeighbor(
  topology: Topology,
  faceId: FaceIndex,
  targetNeighbor: FaceIndex,
): EdgeSlot | null {
  for (const slot of EDGE_SLOTS) {
    if (getNeighborAcrossEdge(topology, faceId, slot) === targetNeighbor) {
      return slot;
    }
  }
  return null;
}

/** Read one corner from a packed face soup slice [x0,y0,x1,y1,x2,y2]. */
function cornerFromSoup(soup: Float32Array, cornerIndex: 0 | 1 | 2): Vec2 {
  const off = 2 * cornerIndex;
  return { x: soup[off]!, y: soup[off + 1]! };
}

/** Find 2D position for `vi` on a face that already has soup corners written. */
function cornerForVertexOnFace(
  mesh: MeshModel,
  faceId: FaceIndex,
  soup: Float32Array,
  vi: VertexIndex,
): Vec2 | null {
  const base = 3 * faceId;
  for (let i = 0; i < 3; i++) {
    if (mesh.faces[base + i] === vi) {
      return cornerFromSoup(soup, i as 0 | 1 | 2);
    }
  }
  return null;
}

/** Write [x0,y0,x1,y1,x2,y2] into a soup slice. */
function writeFaceSoup(
  corners: [Vec2, Vec2, Vec2],
  out: Float32Array,
  soupOffset: number,
): void {
  const [p0, p1, p2] = corners;
  out[soupOffset] = p0.x;
  out[soupOffset + 1] = p0.y;
  out[soupOffset + 2] = p1.x;
  out[soupOffset + 3] = p1.y;
  out[soupOffset + 4] = p2.x;
  out[soupOffset + 5] = p2.y;
}

/** Pick hinge candidate matching mesh.faces winding (CCW or CW). */
function pickHingeCandidateForFace(
  mesh: MeshModel,
  faceId: FaceIndex,
  va: VertexIndex,
  vb: VertexIndex,
  vc: VertexIndex,
  a2d: Vec2,
  b2d: Vec2,
): { ok: true; point: Vec2 } | { ok: false; reason: string } {
  const lenA = distance3d(mesh, va, vc);
  const lenB = distance3d(mesh, vb, vc);
  const hit = circleIntersection2d(a2d.x, a2d.y, b2d.x, b2d.y, lenA, lenB);
  if (!hit.ok) return hit;

  const [v0, v1, v2] = faceVertices(mesh, faceId);

  const areaForCandidate = (candidate: Vec2): number => {
    const tri = (vi: VertexIndex): Vec2 => {
      if (vi === va) return a2d;
      if (vi === vb) return b2d;
      if (vi === vc) return candidate;
      throw new Error(`Unexpected vertex ${vi} on face ${faceId}.`);
    };
    return signedArea2d(tri(v0).x, tri(v0).y, tri(v1).x, tri(v1).y, tri(v2).x, tri(v2).y);
  };

  for (const candidate of [hit.p1, hit.p2]) {
    if (areaForCandidate(candidate) > EPS) {
      return { ok: true, point: candidate };
    }
  }

  for (const candidate of [hit.p1, hit.p2]) {
    if (areaForCandidate(candidate) < -EPS) {
      return { ok: true, point: candidate };
    }
  }

  const fallback = pickCCWCandidate(a2d.x, a2d.y, b2d.x, b2d.y, hit.p1, hit.p2);
  if (fallback.ok) return fallback;

  return { ok: false, reason: "No valid hinge candidate for mesh face vertex order." };
}

/**
 * Unfold one connected island into the XY plane via BFS hinge placement.
 *
 * Seams are not read here — the caller must pass an island from `partitionIslands`.
 * Shared-edge 2D coords are copied from the parent face soup (triangle soup output),
 * not from a global per-vertex map.
 */
export function unfoldIsland(
  mesh: MeshModel,
  topology: Topology,
  islandFaces: FaceIndex[],
): UnfoldIslandResult {
  if (islandFaces.length === 0) {
    return { faces: [], positions2d: new Float32Array(0), error: "Empty island." };
  }

  const islandSet = new Set(islandFaces);
  const faceToSoupIndex = new Map<FaceIndex, number>();
  for (let i = 0; i < islandFaces.length; i++) {
    faceToSoupIndex.set(islandFaces[i]!, i);
  }

  const positions2d = new Float32Array(islandFaces.length * 6);
  const rootFaceId = islandFaces[0]!;
  const rootVerts = faceVertices(mesh, rootFaceId);

  const rootPlacement = placeRootTriangleCCW(mesh, rootVerts[0], rootVerts[1], rootVerts[2]);
  if (!rootPlacement.ok) {
    return { faces: islandFaces, positions2d, error: rootPlacement.reason };
  }

  writeFaceSoup(
    [rootPlacement.v0, rootPlacement.v1, rootPlacement.v2],
    positions2d,
    0,
  );

  const unfolded = new Set<FaceIndex>([rootFaceId]);
  const queue: FaceIndex[] = [rootFaceId];

  while (queue.length > 0) {
    const faceId = queue.shift()!;
    const parentSoupIndex = faceToSoupIndex.get(faceId)!;
    const parentSoup = positions2d.subarray(6 * parentSoupIndex, 6 * parentSoupIndex + 6);

    for (const slot of EDGE_SLOTS) {
      const neighbor = getNeighborAcrossEdge(topology, faceId, slot);
      if (neighbor === null || !islandSet.has(neighbor) || unfolded.has(neighbor)) {
        continue;
      }

      const neighborVerts = faceVertices(mesh, neighbor);
      const neighborSlot = slotTowardNeighbor(topology, neighbor, faceId);
      if (neighborSlot === null) {
        return {
          faces: islandFaces,
          positions2d,
          error: `No back-edge from face ${neighbor} to face ${faceId}.`,
        };
      }

      const [va, vb] = directedEdgeForSlot(neighborVerts, neighborSlot);
      const vc = thirdVertex(neighborVerts, va, vb);
      if (vc === null) {
        return {
          faces: islandFaces,
          positions2d,
          error: `Could not find third vertex for neighbor of face ${faceId}.`,
        };
      }

      const a2d = cornerForVertexOnFace(mesh, faceId, parentSoup, va);
      const b2d = cornerForVertexOnFace(mesh, faceId, parentSoup, vb);
      if (!a2d || !b2d) {
        return {
          faces: islandFaces,
          positions2d,
          error: `Shared edge (${va}, ${vb}) missing on parent face ${faceId} soup.`,
        };
      }

      const hinge = pickHingeCandidateForFace(mesh, neighbor, va, vb, vc, a2d, b2d);
      if (!hinge.ok) {
        return {
          faces: islandFaces,
          positions2d,
          error: `Hinge failed for face ${neighbor}: ${hinge.reason}`,
        };
      }

      const c2d = hinge.point;
      const corner2d = (vi: VertexIndex): Vec2 => {
        if (vi === va) return a2d;
        if (vi === vb) return b2d;
        if (vi === vc) return c2d;
        throw new Error(`Vertex ${vi} not on hinge triangle for face ${neighbor}.`);
      };

      const neighborCorners: [Vec2, Vec2, Vec2] = [
        corner2d(neighborVerts[0]),
        corner2d(neighborVerts[1]),
        corner2d(neighborVerts[2]),
      ];

      const neighborSoupIndex = faceToSoupIndex.get(neighbor)!;
      writeFaceSoup(neighborCorners, positions2d, 6 * neighborSoupIndex);

      unfolded.add(neighbor);
      queue.push(neighbor);
    }
  }

  for (const faceId of islandFaces) {
    if (!unfolded.has(faceId)) {
      return {
        faces: islandFaces,
        positions2d,
        error: `Island disconnected: face ${faceId} unreachable from root ${rootFaceId}.`,
      };
    }
  }

  return { faces: islandFaces, positions2d };
}
