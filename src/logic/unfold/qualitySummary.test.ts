import { describe, expect, it } from "vitest";
import { parseObj } from "../io/obj/parseObj";
import { buildTopology } from "../mesh/buildTopology";
import { createSeamRegistry } from "../seams/seamRegistry";
import {
  QUALITY_OVERLAY_MAX_TEARS,
  capForOverlay,
  countQualityIssues,
  formatOverlayTruncationHints,
  formatQualityIssueSummary,
  formatQualityIssueToast,
  formatTruncatedOverlayHint,
} from "./qualitySummary";
import { unfoldMesh } from "./unfoldMesh";

const CUBE_OBJ = `
v -1 -1 -1
v 1 -1 -1
v 1 1 -1
v -1 1 -1
v -1 -1 1
v 1 -1 1
v 1 1 1
v -1 1 1
f 1 2 3
f 1 3 4
f 5 6 7
f 5 7 8
f 1 5 8
f 1 8 4
f 2 6 7
f 2 7 3
f 4 3 7
f 4 7 8
f 1 2 6
f 1 6 5
`;

describe("countQualityIssues", () => {
  it("returns zero counts for a clean result", () => {
    const counts = countQualityIssues({ collisions: [], tears: [] });
    expect(counts).toEqual({
      collisionCount: 0,
      tearCount: 0,
      hasIssues: false,
    });
  });

  it("reports counts from unfoldMesh on a closed cube", () => {
    const { mesh } = parseObj(CUBE_OBJ);
    const topo = buildTopology(mesh);
    const result = unfoldMesh(mesh, topo, createSeamRegistry());
    const counts = countQualityIssues(result);

    expect(counts.hasIssues).toBe(true);
    expect(counts.collisionCount).toBeGreaterThan(0);
    expect(counts.tearCount).toBeGreaterThan(0);
  });
});

describe("capForOverlay", () => {
  it("returns all items when under the cap", () => {
    const items = [1, 2, 3];
    expect(capForOverlay(items, 50)).toEqual({
      visible: [1, 2, 3],
      total: 3,
      truncated: false,
    });
  });

  it("slices to max and sets truncated when over the cap", () => {
    const items = Array.from({ length: 60 }, (_, i) => i);
    const capped = capForOverlay(items, 50);
    expect(capped.visible).toHaveLength(50);
    expect(capped.total).toBe(60);
    expect(capped.truncated).toBe(true);
  });
});

describe("formatQualityIssueSummary", () => {
  it("returns null when clean", () => {
    expect(formatQualityIssueSummary({ collisionCount: 0, tearCount: 0, hasIssues: false })).toBe(
      null,
    );
  });

  it("formats both kinds", () => {
    expect(
      formatQualityIssueSummary({ collisionCount: 42, tearCount: 18, hasIssues: true }),
    ).toBe("42 face overlaps · 18 edge tears");
  });

  it("formats singular collision", () => {
    expect(
      formatQualityIssueSummary({ collisionCount: 1, tearCount: 0, hasIssues: true }),
    ).toBe("1 face overlap");
  });

  it("formats singular tear", () => {
    expect(
      formatQualityIssueSummary({ collisionCount: 0, tearCount: 1, hasIssues: true }),
    ).toBe("1 edge tear");
  });
});

describe("formatTruncatedOverlayHint", () => {
  it("returns null when nothing is truncated", () => {
    expect(formatTruncatedOverlayHint(50, 50, "collisions")).toBeNull();
    expect(formatTruncatedOverlayHint(10, 10, "tears")).toBeNull();
  });

  it("formats collision truncation", () => {
    expect(formatTruncatedOverlayHint(50, 142, "collisions")).toBe(
      "Showing 50 of 142 overlaps",
    );
  });

  it("formats tear truncation with singular", () => {
    expect(formatTruncatedOverlayHint(1, 3, "tears")).toBe("Showing 1 of 3 tears");
  });
});

describe("formatOverlayTruncationHints", () => {
  it("returns empty when under caps", () => {
    expect(
      formatOverlayTruncationHints({ collisionCount: 10, tearCount: 5, hasIssues: true }),
    ).toEqual([]);
  });

  it("returns hints for both kinds when over caps", () => {
    expect(
      formatOverlayTruncationHints({
        collisionCount: 142,
        tearCount: 80,
        hasIssues: true,
      }),
    ).toEqual(["Showing 50 of 142 overlaps", `Showing ${QUALITY_OVERLAY_MAX_TEARS} of 80 tears`]);
  });
});

describe("formatQualityIssueToast", () => {
  it("returns null when clean", () => {
    expect(
      formatQualityIssueToast({ collisionCount: 0, tearCount: 0, hasIssues: false }),
    ).toBeNull();
  });

  it("includes toggle hint without truncation when under caps", () => {
    expect(
      formatQualityIssueToast({ collisionCount: 3, tearCount: 2, hasIssues: true }),
    ).toBe(
      "Pattern issues: 3 face overlaps · 2 edge tears. Toggle overlay in Flatten panel.",
    );
  });

  it("appends truncation hints when over caps", () => {
    const toast = formatQualityIssueToast({
      collisionCount: 142,
      tearCount: 18,
      hasIssues: true,
    });
    expect(toast).toContain("Pattern issues: 142 face overlaps · 18 edge tears.");
    expect(toast).toContain("Showing 50 of 142 overlaps");
    expect(toast).not.toContain("Showing 50 of 18");
  });
});
