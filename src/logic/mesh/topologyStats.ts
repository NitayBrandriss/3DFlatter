import type { Topology } from "./types";

export interface TopologySummary {
  boundaryEdgesCount: number;
  manifoldEdgesCount: number;
  nonManifoldEdgesCount: number;
}

/** Count unique edges by incident face count for UI diagnostics. */
export function summarizeTopology(topo: Topology): TopologySummary {
  let boundaryEdgesCount = 0;
  let manifoldEdgesCount = 0;
  let nonManifoldEdgesCount = 0;

  for (const incidents of topo.edgeToFaces.values()) {
    const n = incidents.length;
    if (n === 1) boundaryEdgesCount++;
    else if (n === 2) manifoldEdgesCount++;
    else if (n > 2) nonManifoldEdgesCount++;
  }

  return { boundaryEdgesCount, manifoldEdgesCount, nonManifoldEdgesCount };
}
