import { describe, expect, it } from "vitest";
import { formatMaterializeWarningsToast } from "./formatMaterializeWarningsToast";

describe("formatMaterializeWarningsToast", () => {
  it("returns null for empty warnings", () => {
    expect(formatMaterializeWarningsToast([], [])).toBeNull();
  });

  it("returns the single warning unchanged", () => {
    expect(
      formatMaterializeWarningsToast(["Stroke x is self-intersecting."], []),
    ).toBe("Stroke x is self-intersecting.");
  });

  it("collapses many warnings and prioritizes open-loop when present", () => {
    const toast = formatMaterializeWarningsToast(
      [
        "Skipped segment on stroke a.",
        "Stroke open: open loop (slit).",
        "Skipped snap on stroke b.",
      ],
      [{ strokeId: "open", interiorEndpoints: [0, 1] }],
    );
    expect(toast).toBe("3 cut warnings. Stroke open: open loop (slit).");
  });

  it("synthesizes open-loop lead when multi-warning list lacks open-loop text", () => {
    expect(
      formatMaterializeWarningsToast(
        ["Skipped segment.", "Other warning."],
        [{ strokeId: "a", interiorEndpoints: [0] }],
      ),
    ).toBe("2 cut warnings. Warning: 1 open-loop cut stroke.");
  });
});
