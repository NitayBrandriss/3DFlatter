import { describe, expect, it } from "vitest";
import {
  COLLISION_AREA_ABS,
  collisionAreaThreshold,
  tearThreshold,
  TEAR_ABS,
} from "./tolerances";

describe("tolerances", () => {
  it("collisionAreaThreshold uses abs floor for tiny edges", () => {
    expect(collisionAreaThreshold(0)).toBe(COLLISION_AREA_ABS);
    expect(collisionAreaThreshold(1e-6)).toBe(COLLISION_AREA_ABS);
  });

  it("collisionAreaThreshold scales with edge length squared", () => {
    const t = collisionAreaThreshold(10);
    expect(t).toBeGreaterThan(COLLISION_AREA_ABS);
    expect(collisionAreaThreshold(20)).toBeGreaterThan(t);
  });

  it("tearThreshold uses abs floor", () => {
    expect(tearThreshold(0)).toBe(TEAR_ABS);
  });

  it("tearThreshold scales with 3D edge length", () => {
    expect(tearThreshold(1000)).toBeGreaterThan(TEAR_ABS);
  });
});
