import type { OpenLoopInfo } from "@/logic/cuts/types";

/**
 * Collapse materialize warnings into one toast (STATE-S2-004).
 * Prefer an open-loop line when structured `openLoops` is non-empty (STATE-S2-006).
 */
export function formatMaterializeWarningsToast(
  warnings: readonly string[],
  openLoops: readonly OpenLoopInfo[],
): string | null {
  if (warnings.length === 0) return null;
  if (warnings.length === 1) return warnings[0]!;

  const openLoopWarning =
    openLoops.length > 0
      ? warnings.find((w) => w.toLowerCase().includes("open loop"))
      : undefined;
  const lead =
    openLoopWarning ??
    (openLoops.length > 0
      ? openLoops.length === 1
        ? "Warning: 1 open-loop cut stroke."
        : `Warning: ${openLoops.length} open-loop cut strokes.`
      : warnings[0]!);

  return `${warnings.length} cut warnings. ${lead}`;
}
