/** User-facing toast when demo fetch fails (APP-003 — shared with API semantics). */
export function demoLoadFailureMessage(httpStatus: number, modelLabel: string): string {
  if (httpStatus === 404) {
    return `Demo model "${modelLabel}" not found. Add it under 3d_models/.`;
  }
  return `Failed to load demo model "${modelLabel}".`;
}
