import type { EdgeKey, Topology } from "../mesh/types";

export type EdgeEligibility =
  | { ok: true }
  | { ok: false; reason: string };

/** v1: only manifold interior edges (exactly two incident faces) may be seams. */
export function canSelectAsSeam(topology: Topology, key: EdgeKey): EdgeEligibility {
  const incidents = topology.edgeToFaces.get(key);
  if (!incidents) {
    return { ok: false, reason: "Edge not found in mesh topology." };
  }
  if (incidents.length === 1) {
    return { ok: false, reason: "Boundary edge — already open, cannot be a seam." };
  }
  if (incidents.length > 2) {
    return { ok: false, reason: "Non-manifold edge — unsupported for unfolding." };
  }
  return { ok: true };
}
