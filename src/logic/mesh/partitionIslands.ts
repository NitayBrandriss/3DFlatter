import { makeEdgeKey } from "./edgeKey";
import type { EdgeSlot, FaceIndex, MeshModel, SeamRegistry, Topology } from "./types";
import { getNeighborAcrossEdge } from "./types";

const EDGE_SLOTS: EdgeSlot[] = [0, 1, 2];

function edgeKeyForFace(mesh: MeshModel, faceId: FaceIndex, slot: EdgeSlot) {
  const base = 3 * faceId;
  const v0 = mesh.faces[base]!;
  const v1 = mesh.faces[base + 1]!;
  const v2 = mesh.faces[base + 2]!;
  if (slot === 0) return makeEdgeKey(v0, v1);
  if (slot === 1) return makeEdgeKey(v1, v2);
  return makeEdgeKey(v2, v0);
}

/**
 * Partition faces into connected islands, cutting across seam edges.
 * Two faces are in the same island if reachable via non-seam manifold edges.
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
