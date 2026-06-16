import type { EdgeKey, SeamRegistry } from "../mesh/types";

export function createSeamRegistry(): SeamRegistry {
  return { seams: new Set<EdgeKey>() };
}

/** Returns a new registry with the edge toggled; input is never mutated. */
export function toggleSeam(registry: SeamRegistry, key: EdgeKey): SeamRegistry {
  const seams = new Set(registry.seams);
  if (seams.has(key)) {
    seams.delete(key);
  } else {
    seams.add(key);
  }
  return { seams };
}

/** Returns an empty registry; input is never mutated. */
export function clearSeams(registry: SeamRegistry): SeamRegistry {
  void registry;
  return createSeamRegistry();
}

export function seamCount(registry: SeamRegistry): number {
  return registry.seams.size;
}

export function hasSeam(registry: SeamRegistry, key: EdgeKey): boolean {
  return registry.seams.has(key);
}
