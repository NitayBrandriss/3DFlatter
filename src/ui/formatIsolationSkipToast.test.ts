import { describe, expect, it } from "vitest";
import { formatIsolationSkipToast } from "./formatIsolationSkipToast";

describe("formatIsolationSkipToast", () => {
  it("returns null when nothing was skipped", () => {
    expect(formatIsolationSkipToast([])).toBeNull();
  });

  it("uses the singular sentence for one skipped stroke", () => {
    expect(
      formatIsolationSkipToast([{ id: "cross", relation: "crossing" }]),
    ).toBe("Skipped 1 cut stroke not wholly inside the isolate.");
  });

  it("counts crossing and outside strokes together", () => {
    expect(
      formatIsolationSkipToast([
        { id: "cross", relation: "crossing" },
        { id: "ghost", relation: "outside" },
      ]),
    ).toBe("Skipped 2 cut strokes not wholly inside the isolate.");
  });
});
