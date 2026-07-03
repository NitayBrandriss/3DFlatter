import { partitionIslands } from "../mesh/partitionIslands";
import type { MeshModel, SeamRegistry, Topology, UnfoldMeshResult } from "../mesh/types";
import { analyzeUnfoldedIsland } from "./analyzeUnfoldedIsland";
import { combinedBounds, layoutIslands } from "./layoutIslands";
import { listSeamSegments2d } from "./seamSegments2d";
import { toGlobalQualityReports } from "./toGlobalQualityReports";
import { unfoldIsland } from "./unfoldIsland";

/**
 * Partition by seams, unfold each island, detect quality issues, and pack into global XY.
 */
export function unfoldMesh(
  mesh: MeshModel,
  topology: Topology,
  seams: SeamRegistry,
): UnfoldMeshResult {
  const islandFaceLists = partitionIslands(mesh, topology, seams);
  const unfolded = [];
  const localReports = [];

  for (const islandFaces of islandFaceLists) {
    const result = unfoldIsland(mesh, topology, islandFaces);
    if (result.error) {
      return {
        islands: [],
        bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
        seamSegments: [],
        collisions: [],
        tears: [],
        error: result.error,
      };
    }
    unfolded.push(result);
    localReports.push(analyzeUnfoldedIsland(mesh, topology, islandFaces, result));
  }

  const islands = layoutIslands(unfolded);
  const { collisions, tears } = toGlobalQualityReports(localReports, islands);

  return {
    islands,
    bounds: combinedBounds(islands),
    seamSegments: listSeamSegments2d(mesh, topology, seams, islands),
    collisions,
    tears,
  };
}
