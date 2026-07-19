/**
 * Soft client-side load budgets (IO-002).
 * Reject before large allocates so the browser stays responsive.
 */
export const MAX_MESH_FILE_BYTES = 50 * 1024 * 1024; // 50 MiB

/** Soft max triangulated faces after fan triangulation / STL decode. */
export const MAX_MESH_TRIANGLES = 500_000;

export function formatByteLimit(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return Number.isInteger(mb) ? `${mb} MiB` : `${mb.toFixed(1)} MiB`;
}
