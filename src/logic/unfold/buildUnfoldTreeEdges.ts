import { makeEdgeKey } from "../mesh/edgeKey";
import type {
  EdgeKey,
  EdgeSlot,
  FaceIndex,
  MeshModel,
  Topology,
  VertexIndex,
} from "../mesh/types";
import { getNeighborAcrossEdge } from "../mesh/types";

const EDGE_SLOTS: EdgeSlot[] = [0, 1, 2];

type FaceVerts = [VertexIndex, VertexIndex, VertexIndex];

function readFaceVertices(mesh: MeshModel, faceId: FaceIndex): FaceVerts {
  const base = 3 * faceId;
  return [mesh.faces[base]!, mesh.faces[base + 1]!, mesh.faces[base + 2]!];
}

function directedEdgeForSlot(verts: FaceVerts, slot: EdgeSlot): [VertexIndex, VertexIndex] {
  const [v0, v1, v2] = verts;
  if (slot === 0) return [v0, v1];
  if (slot === 1) return [v1, v2];
  return [v2, v0];
}

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

      const parentVerts = readFaceVertices(mesh, faceId);
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
