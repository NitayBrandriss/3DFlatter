import type { Triangle2d } from "./triangle2d";

export function tri(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
): Triangle2d {
  return [
    { x: ax, y: ay },
    { x: bx, y: by },
    { x: cx, y: cy },
  ];
}
