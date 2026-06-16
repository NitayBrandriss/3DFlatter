/** Group transform: math Y-up soup → SVG Y-down, preserving layout bbox. */
export function yFlipGroupTransform(minY: number, maxY: number): string {
  return `translate(0, ${minY + maxY}) scale(1, -1)`;
}
