import { EDGE_SLOTS, edgeKeyForFace, faceVertices } from "./faceUtils";
import { isIndexDegenerateFace } from "./faceDegeneracy";
import type { FaceIndex, MeshModel, SeamRegistry, Topology } from "./types";
import { getNeighborAcrossEdge } from "./types";

/**
 * Faces skipped by buildTopology (index-degenerate) must not form islands.
 * Index check matches topology; remaining edge-map scan is defense if a face
 * somehow has distinct indices but no edge registration.
 */
export function isTopologyOrphanFace(
  mesh: MeshModel,
  topology: Topology,
  faceId: FaceIndex,
): boolean {
  const [v0, v1, v2] = faceVertices(mesh, faceId);
  if (isIndexDegenerateFace(v0, v1, v2)) {
    return true;
  }

  for (const slot of EDGE_SLOTS) {
    const key = edgeKeyForFace(mesh, faceId, slot);
    const incidents = topology.edgeToFaces.get(key);
    if (incidents?.some((inc) => inc.faceId === faceId)) {
      return false;
    }
  }
  return true;
}

/**
 * Partition faces into connected islands, cutting across seam edges.
 * Two faces are in the same island if reachable via non-seam manifold edges.
 * Topology-orphan (index-degenerate) faces are excluded.
 */
export function partitionIslands(
  mesh: MeshModel,
  topology: Topology,
  seams: SeamRegistry,
): FaceIndex[][] {
  const { faceCount } = mesh;
  const visited = new Uint8Array(faceCount);
  const islands: FaceIndex[][] = [];

  for (let start = 0; start < faceCount; start++) {
    if (visited[start]) continue;
    if (isTopologyOrphanFace(mesh, topology, start)) {
      visited[start] = 1;
      continue;
    }

    const island: FaceIndex[] = [];
    const queue: FaceIndex[] = [start];
    visited[start] = 1;

    while (queue.length > 0) {
      const faceId = queue.pop()!;
      island.push(faceId);

      for (const slot of EDGE_SLOTS) {
        const neighbor = getNeighborAcrossEdge(topology, faceId, slot);
        if (neighbor === null || visited[neighbor]) continue;

        const key = edgeKeyForFace(mesh, faceId, slot);
        if (seams.seams.has(key)) continue;

        visited[neighbor] = 1;
        queue.push(neighbor);
      }
    }

    islands.push(island);
  }

  return islands;
}
