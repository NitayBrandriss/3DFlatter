import { partitionIslands } from "../mesh/partitionIslands";
import type { MeshModel, SeamRegistry, Topology, UnfoldMeshResult } from "../mesh/types";
import { combinedBounds, layoutIslands } from "./layoutIslands";
import { listSeamSegments2d } from "./seamSegments2d";
import { unfoldIsland } from "./unfoldIsland";

/**
 * Partition by seams, unfold each island, and pack into global XY without overlap.
 */
export function unfoldMesh(
  mesh: MeshModel,
  topology: Topology,
  seams: SeamRegistry,
): UnfoldMeshResult {
  const islandFaceLists = partitionIslands(mesh, topology, seams);
  const unfolded = [];

  for (const islandFaces of islandFaceLists) {
    const result = unfoldIsland(mesh, topology, islandFaces);
    if (result.error) {
      return {
        islands: [],
        bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
        seamSegments: [],
        error: result.error,
      };
    }
    unfolded.push(result);
  }

  const islands = layoutIslands(unfolded);
  return {
    islands,
    bounds: combinedBounds(islands),
    seamSegments: listSeamSegments2d(mesh, topology, seams, islands),
  };
}
