import { parseEdgeKey } from "../mesh/edgeKey";
import type { SeamRegistry } from "../mesh/types";

/**
 * Seam line segments using display-normalized vertex positions.
 */
export function listDisplaySeamSegments(
  displayVertices: Float32Array,
  registry: SeamRegistry,
): Float32Array {
  const segments: number[] = [];

  for (const key of registry.seams) {
    const [a, b] = parseEdgeKey(key);
    const aBase = 3 * a;
    const bBase = 3 * b;
    segments.push(
      displayVertices[aBase]!,
      displayVertices[aBase + 1]!,
      displayVertices[aBase + 2]!,
      displayVertices[bBase]!,
      displayVertices[bBase + 1]!,
      displayVertices[bBase + 2]!,
    );
  }

  return new Float32Array(segments);
}
