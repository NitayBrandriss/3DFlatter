# Phase 1 — Freeform cut strokes (3D)

**Status:** Complete  
**ADR:** [0100 — Freeform cut strokes](../../decisions/product/0100-freeform-cut-strokes.md)  
**Roadmap:** [PRODUCT_ROADMAP.md](../../../PRODUCT_ROADMAP.md) Phase 1  
**Depends on:** PoC ADRs [0001](../../decisions/poc/0001-mesh-model-and-topology.md), [0002](../../decisions/poc/0002-unfold-step-1-hinge-island.md)  
**Viewer UX blueprint:** [polyline_cut_tool plan](../../../.cursor/plans/polyline_cut_tool_318885f7.plan.md) (Slices A–E)  
**QA:** [qa-audits.md](qa-audits.md)

## Goal

Non-destructive **cut strokes** on the 3D mesh (overlay in Zustand); **lazy** `materializeCutStrokes` on Flatten; edge-pick seams unchanged.

## Scope summary

| Topic | Decision |
|-------|----------|
| Editing | `cutStrokes` in canonical 3D; base `session.mesh` unchanged until Flatten |
| Commit | `materializeCutStrokes` → derived mesh + topology + seam union → `unfoldMesh` |
| Open loops | Warn on Flatten; user may proceed |
| Geometry | Segment–triangle clip walk, interior Steiner + fan, scale-aware snap/surface eps; whole-stroke self-intersect reject |
| Versioning | `meshLoadVersion` on load only; `patternRevision` for stroke edits; flatten fingerprint also includes `seamsContentKey` |
| Overlay preview | Surface tessellation ([`surfacePath.ts`](../../../src/logic/cuts/surfacePath.ts)); same face-local walk as materialize |

## Viewer UX (polyline lifecycle)

Freehand drag-sample was replaced by **point-to-point** drawing and node editing. Draft points stay in component refs until finalize (no Zustand / `patternRevision` on move).

| Mode | Gesture / outcome |
|------|-------------------|
| Place | Click mesh to place vertices; orbit between clicks (`pointerup`, drag ≤ 5px) → append sparse vertex |
| Rubber-band | Hover tip tessellated from last point (drafting only) |
| Close loop | Click **amber first-vertex marker** → duplicate first as last + commit (not Euclidean mesh auto-close) |
| Drag node | Grab any marker → mesh-surface raycast; orbit disabled only while grabbed |
| Finalize open | **Enter** or **Done** (viewport toolbar / sidebar) → `addCutStroke` |
| Discard | **Esc** or **Cancel** discards the draft |
| Last vertex | While drafting, Backspace removes the last placed vertex (not a general undo stack) |
| Re-edit committed | Click a cyan committed stroke → draft session; Done → `updateCutStroke`; Cancel restores store |

**Parked (v2):** mid-segment insert, general undo stack, snap/weld — [PRODUCT_ROADMAP.md — Cut-tool UX backlog](../../../PRODUCT_ROADMAP.md#cut-tool-ux-backlog-v2--after-polyline-blueprint).

## Implementation slices

1. **Logic** — `materializeCutStrokes`, tests ✅  
2. **State** — stroke CRUD, Flatten wiring in `useFlattenExport` ✅  
3. **Viewer (polyline A–D)** — draw, markers, drag, committed re-edit ✅  
4. **Docs** — ADR 0100 + PRODUCT_ROADMAP ✅  
5. **Docs + QA matrix (Slice E)** — this file + [qa-audits.md](qa-audits.md) ✅  

## Key files

| Path | Purpose |
|------|---------|
| `src/logic/cuts/` | `materializeCutStrokes`, `WorkingMesh`, snap/vec3, `surfacePath` / `cutSurfaceWalk` |
| `src/logic/cuts/flattenWithCutStrokes.ts` | Pure flatten pipeline (materialize → unfold) |
| `src/state/meshSessionStore.ts` | `cutStrokes` CRUD, `patternRevision`, `flattenSnapshotKey` |
| `src/state/meshEditTool.ts` | Tool enum: `none` / `seam` / `cut` |
| `src/ui/useFlattenExport.ts` | Flatten hook with materialize wiring + warning toasts |
| `src/viewer/PickableMesh.tsx` | Seam pick + cut place / rubber-band |
| `src/viewer/CutStrokesOverlay.tsx` | Committed stroke overlay (cyan; surface-tessellated) |
| `src/viewer/CommittedStrokePickables.tsx` | Invisible per-stroke pick proxies (Slice D) |
| `src/viewer/cutPolyline/` | Draft session: line, markers, helpers, raycast, tessellate |
| `src/viewer/displayNormalization.ts` | Display↔canonical coordinate transforms |
| `src/viewer/packCutStrokeDisplaySegments.ts` | Committed stroke → LineSegments packing |

## Done when

- [x] ADR 0100 accepted  
- [x] Vitest: materialize / store / flatten / viewer packing / cutPolyline helpers / Slice A–D audit suites  
- [x] Manual: draw → delete stroke (base mesh unchanged) → Flatten → cuts visible in 2D  
- [x] Manual polyline matrix (Slice E): draw, orbit between clicks, rubber-band, marker close, drag, re-edit, Flatten  
- [x] `npm test` / `npm run lint`
