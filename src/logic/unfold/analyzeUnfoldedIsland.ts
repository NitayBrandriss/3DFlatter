import type {
  EdgeTear2d,
  FaceIndex,
  MeshModel,
  Topology,
  TriangleCollision2d,
  UnfoldIslandResult,
} from "../mesh/types";
import { buildUnfoldTreeEdges, expectedTreeEdgeCount } from "./buildUnfoldTreeEdges";
import { detectCollisions } from "./detectCollisions";
import { detectTears } from "./detectTears";

export type IslandQualityReport = {
  collisions: TriangleCollision2d[];
  tears: EdgeTear2d[];
};

/** Run 3a + 3b on one unfolded island in local soup XY. */
export function analyzeUnfoldedIsland(
  mesh: MeshModel,
  topology: Topology,
  islandFaces: FaceIndex[],
  result: UnfoldIslandResult,
): IslandQualityReport {
  const treeEdges = buildUnfoldTreeEdges(mesh, topology, islandFaces);
  const expected = expectedTreeEdgeCount(islandFaces.length);
  if (treeEdges.size !== expected) {
    // LOGIC-006 / ADR 0003 W2 — detect BFS drift vs unfoldIsland after a successful unfold.
    throw new Error(
      `Unfold tree edge count mismatch: got ${treeEdges.size}, expected ${expected} for ${islandFaces.length} face(s)`,
    );
  }
  return {
    collisions: detectCollisions(mesh, topology, result),
    tears: detectTears(mesh, topology, islandFaces, result, treeEdges),
  };
}
