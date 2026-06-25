import type {
  EdgeTear2d,
  FaceIndex,
  MeshModel,
  Topology,
  TriangleCollision2d,
  UnfoldIslandResult,
} from "../mesh/types";
import { buildUnfoldTreeEdges } from "./buildUnfoldTreeEdges";
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
  return {
    collisions: detectCollisions(mesh, topology, result),
    tears: detectTears(mesh, topology, islandFaces, result, treeEdges),
  };
}
