import type { FloodCombineMode } from "../logic/isolation/types";

/**
 * Active 3D mesh editing tool.
 * `"isolate"` is seed / add / subtract (ADR 0101). Isolation mode itself is
 * `isolation.active`, and the user may switch back to seam or cut while a mask exists.
 */
export type MeshEditTool = "none" | "seam" | "cut" | "isolate";

/**
 * Pointer-up inside the drag threshold.
 * Isolate owns Shift / Alt. Shift+Alt is invalid: no flood and no camera pivot.
 * Alt on seam, cut, or orbit stays today's pivot.
 */
export type MeshPointerAction =
  | { type: "flood"; mode: FloodCombineMode }
  | { type: "pivot" }
  | { type: "none" }
  | { type: "passthrough" };

export function meshPointerAction(
  tool: MeshEditTool,
  shiftKey: boolean,
  altKey: boolean,
): MeshPointerAction {
  if (tool === "isolate") {
    if (shiftKey && altKey) return { type: "none" };
    if (shiftKey) return { type: "flood", mode: "add" };
    if (altKey) return { type: "flood", mode: "subtract" };
    return { type: "flood", mode: "replace" };
  }
  if (altKey) return { type: "pivot" };
  return { type: "passthrough" };
}
