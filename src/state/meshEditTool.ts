/**
 * Active 3D mesh editing tool.
 * `"isolate"` is seed / add / subtract (ADR 0101). Isolation mode itself is
 * `isolation.active`, and the user may switch back to seam or cut while a mask exists.
 */
export type MeshEditTool = "none" | "seam" | "cut" | "isolate";
