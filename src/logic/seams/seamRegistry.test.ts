import { describe, expect, it } from "vitest";
import type { EdgeKey } from "../mesh/types";
import {
  clearSeams,
  createSeamRegistry,
  hasSeam,
  seamCount,
  toggleSeam,
} from "./seamRegistry";

const KEY = "0,1" as EdgeKey;

describe("seamRegistry", () => {
  it("starts empty", () => {
    const registry = createSeamRegistry();
    expect(seamCount(registry)).toBe(0);
    expect(hasSeam(registry, KEY)).toBe(false);
  });

  it("toggles seam membership immutably", () => {
    const initial = createSeamRegistry();
    const added = toggleSeam(initial, KEY);
    expect(hasSeam(added, KEY)).toBe(true);
    expect(hasSeam(initial, KEY)).toBe(false);

    const removed = toggleSeam(added, KEY);
    expect(hasSeam(removed, KEY)).toBe(false);
    expect(hasSeam(added, KEY)).toBe(true);
  });

  it("clears all seams immutably", () => {
    const initial = createSeamRegistry();
    const withSeams = toggleSeam(
      toggleSeam(initial, KEY),
      "2,3" as EdgeKey,
    );
    const cleared = clearSeams(withSeams);
    expect(seamCount(cleared)).toBe(0);
    expect(seamCount(withSeams)).toBe(2);
  });
});
