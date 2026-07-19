import { makeEdgeKey } from "../mesh/edgeKey";
import { EDGE_SLOTS, directedEdgeForSlot, faceVertices } from "../mesh/faceUtils";
import type { EdgeKey, FaceIndex, MeshModel, Topology } from "../mesh/types";
import { getNeighborAcrossEdge } from "../mesh/types";

/**
 * BFS unfold tree edges mirroring `unfoldIsland` (root = islandFaces[0], FIFO, slots [0,1,2]).
 */
export function buildUnfoldTreeEdges(
  mesh: MeshModel,
  topology: Topology,
  islandFaces: FaceIndex[],
): Set<EdgeKey> {
  if (islandFaces.length === 0) return new Set();

  const islandSet = new Set(islandFaces);
  const treeEdges = new Set<EdgeKey>();
  const rootFaceId = islandFaces[0]!;
  const unfolded = new Set<FaceIndex>([rootFaceId]);
  const queue: FaceIndex[] = [rootFaceId];

  while (queue.length > 0) {
    const faceId = queue.shift()!;

    for (const slot of EDGE_SLOTS) {
      const neighbor = getNeighborAcrossEdge(topology, faceId, slot);
      if (neighbor === null || !islandSet.has(neighbor) || unfolded.has(neighbor)) {
        continue;
      }

      const parentVerts = faceVertices(mesh, faceId);
      const [va, vb] = directedEdgeForSlot(parentVerts, slot);
      treeEdges.add(makeEdgeKey(va, vb));

      unfolded.add(neighbor);
      queue.push(neighbor);
    }
  }

  return treeEdges;
}

export function expectedTreeEdgeCount(faceCount: number): number {
  return Math.max(0, faceCount - 1);
}
