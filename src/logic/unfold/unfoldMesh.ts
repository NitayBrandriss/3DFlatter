import { partitionIslands } from "../mesh/partitionIslands";
import type { MeshModel, SeamRegistry, Topology, UnfoldMeshResult } from "../mesh/types";
import { analyzeUnfoldedIsland } from "./analyzeUnfoldedIsland";
import { combinedBounds, layoutIslands } from "./layoutIslands";
import { listSeamSegments2d } from "./seamSegments2d";
import { toGlobalQualityReports } from "./toGlobalQualityReports";
import { unfoldIsland } from "./unfoldIsland";

/**
 * Partition by seams, unfold each island, detect quality issues, and pack into global XY.
 * Failed islands are skipped with warnings when others succeed (LOGIC-002).
 */
export function unfoldMesh(
  mesh: MeshModel,
  topology: Topology,
  seams: SeamRegistry,
): UnfoldMeshResult {
  const islandFaceLists = partitionIslands(mesh, topology, seams);
  const unfolded = [];
  const localReports = [];
  const warnings: string[] = [];

  for (let i = 0; i < islandFaceLists.length; i++) {
    const islandFaces = islandFaceLists[i]!;
    const result = unfoldIsland(mesh, topology, islandFaces);
    if (result.error) {
      warnings.push(`Island ${i} (${islandFaces.length} faces): ${result.error}`);
      continue;
    }
    // Keep partition index so quality reports match warning labels when earlier islands fail.
    unfolded.push({ ...result, sourceIslandIndex: i });
    localReports.push(analyzeUnfoldedIsland(mesh, topology, islandFaces, result));
  }

  if (unfolded.length === 0) {
    return {
      islands: [],
      bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
      seamSegments: [],
      collisions: [],
      tears: [],
      warnings: warnings.length > 0 ? warnings : undefined,
      error: warnings[0] ?? "No unfoldable islands",
    };
  }

  const islands = layoutIslands(unfolded);
  const { collisions, tears } = toGlobalQualityReports(localReports, islands);
  const { segments: seamSegments, skipped: skippedSeams } = listSeamSegments2d(
    mesh,
    topology,
    seams,
    islands,
  );
  if (skippedSeams.length > 0) {
    const preview = skippedSeams
      .slice(0, 3)
      .map((s) => `${s.edgeKey}: ${s.reason}`)
      .join("; ");
    const more =
      skippedSeams.length > 3 ? ` (+${skippedSeams.length - 3} more)` : "";
    warnings.push(`Skipped ${skippedSeams.length} seam(s) in 2D export — ${preview}${more}`);
  }

  return {
    islands,
    bounds: combinedBounds(islands),
    seamSegments,
    collisions,
    tears,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}
