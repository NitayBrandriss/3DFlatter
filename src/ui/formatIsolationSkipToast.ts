import type { SkippedCutStroke } from "@/logic/cuts/flattenWithCutStrokes";

/**
 * One toast for strokes Flatten skipped because they are not wholly inside
 * the active isolate (ADR 0101). Inside strokes still materialize.
 */
export function formatIsolationSkipToast(
  skipped: readonly SkippedCutStroke[],
): string | null {
  if (skipped.length === 0) return null;
  if (skipped.length === 1) {
    return "Skipped 1 cut stroke not wholly inside the isolate.";
  }
  return `Skipped ${skipped.length} cut strokes not wholly inside the isolate.`;
}
