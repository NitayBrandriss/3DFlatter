import type { UnfoldMeshResult } from "../mesh/types";

/** Max collision centroid markers drawn in the 2D overlay (UI cap, not logic). */
export const QUALITY_OVERLAY_MAX_COLLISIONS = 50;

/** Max tear segment pairs drawn in the 2D overlay (UI cap, not logic). */
export const QUALITY_OVERLAY_MAX_TEARS = 50;

export type QualityIssueCounts = {
  collisionCount: number;
  tearCount: number;
  hasIssues: boolean;
};

export type CappedOverlaySlice<T> = {
  visible: T[];
  total: number;
  truncated: boolean;
};

export function countQualityIssues(
  result: Pick<UnfoldMeshResult, "collisions" | "tears">,
): QualityIssueCounts {
  const collisionCount = result.collisions.length;
  const tearCount = result.tears.length;
  return {
    collisionCount,
    tearCount,
    hasIssues: collisionCount > 0 || tearCount > 0,
  };
}

export function capForOverlay<T>(items: readonly T[], max: number): CappedOverlaySlice<T> {
  const total = items.length;
  if (total <= max) {
    return { visible: [...items], total, truncated: false };
  }
  return { visible: items.slice(0, max), total, truncated: true };
}

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

export function formatQualityIssueSummary(counts: QualityIssueCounts): string | null {
  if (!counts.hasIssues) return null;

  const parts: string[] = [];
  if (counts.collisionCount > 0) {
    parts.push(
      `${counts.collisionCount} face ${pluralize(counts.collisionCount, "overlap", "overlaps")}`,
    );
  }
  if (counts.tearCount > 0) {
    parts.push(
      `${counts.tearCount} edge ${pluralize(counts.tearCount, "tear", "tears")}`,
    );
  }
  return parts.join(" · ");
}

export function formatTruncatedOverlayHint(
  shown: number,
  total: number,
  kind: "collisions" | "tears",
): string | null {
  if (total <= shown) return null;
  const label =
    kind === "collisions"
      ? pluralize(total, "overlap", "overlaps")
      : pluralize(total, "tear", "tears");
  return `Showing ${shown} of ${total} ${label}`;
}

export function formatOverlayTruncationHints(counts: QualityIssueCounts): string[] {
  const hints: string[] = [];
  const collisionHint = formatTruncatedOverlayHint(
    Math.min(counts.collisionCount, QUALITY_OVERLAY_MAX_COLLISIONS),
    counts.collisionCount,
    "collisions",
  );
  if (collisionHint) hints.push(collisionHint);

  const tearHint = formatTruncatedOverlayHint(
    Math.min(counts.tearCount, QUALITY_OVERLAY_MAX_TEARS),
    counts.tearCount,
    "tears",
  );
  if (tearHint) hints.push(tearHint);

  return hints;
}

export function formatQualityIssueToast(counts: QualityIssueCounts): string | null {
  const summary = formatQualityIssueSummary(counts);
  if (!summary) return null;

  const hints = formatOverlayTruncationHints(counts);
  const base = `Pattern issues: ${summary}. Toggle overlay in Flatten panel.`;
  if (hints.length === 0) return base;
  return `${base} ${hints.join(" ")}`;
}
