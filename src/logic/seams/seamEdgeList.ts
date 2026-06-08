import type { EdgeKey, MeshModel, SeamRegistry } from "../mesh/types";

function parseEdgeKey(key: EdgeKey): [number, number] {
  const [a, b] = key.split(",").map((s) => Number.parseInt(s, 10));
  return [a!, b!];
}

/**
 * Packed line-segment positions for seam rendering: [x0,y0,z0, x1,y1,z1, ...].
 */
export function listSeamSegments(mesh: MeshModel, registry: SeamRegistry): Float32Array {
  const segments: number[] = [];

  for (const key of registry.seams) {
    const [a, b] = parseEdgeKey(key);
    const aBase = 3 * a;
    const bBase = 3 * b;
    segments.push(
      mesh.vertices[aBase]!,
      mesh.vertices[aBase + 1]!,
      mesh.vertices[aBase + 2]!,
      mesh.vertices[bBase]!,
      mesh.vertices[bBase + 1]!,
      mesh.vertices[bBase + 2]!,
    );
  }

  return new Float32Array(segments);
}
