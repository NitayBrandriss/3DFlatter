/** Trigger a browser download of a text file (client-only). */
export function downloadTextFile(
  content: string,
  fileName: string,
  mimeType: string,
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** Derive a safe `.svg` filename from an OBJ basename. */
export function svgFileNameFromObj(fileName: string): string {
  const base = fileName.replace(/\.obj$/i, "").trim() || "pattern";
  const safe = base.replace(/[^\w.\-]+/g, "_");
  return `${safe}.svg`;
}
