# Phase 1 — Freeform cut strokes (3D)

**Status:** Complete  
**ADR:** [0100 — Freeform cut strokes](../../decisions/product/0100-freeform-cut-strokes.md)  
**Roadmap:** [PRODUCT_ROADMAP.md](../../../PRODUCT_ROADMAP.md) Phase 1  
**Depends on:** PoC ADRs [0001](../../decisions/poc/0001-mesh-model-and-topology.md), [0002](../../decisions/poc/0002-unfold-step-1-hinge-island.md)

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

## Implementation slices

1. **Logic** — `materializeCutStrokes`, tests ✅  
2. **State** — stroke CRUD, Flatten wiring in `useFlattenExport` ✅  
3. **Viewer** — draw tool + `CutStrokesOverlay` ✅  
4. **Docs** — ADR 0100 + update PRODUCT_ROADMAP ✅  

## Key files

| Path | Purpose |
|------|---------|
| `src/logic/cuts/` | `materializeCutStrokes`, `WorkingMesh`, snap/vec3 helpers, types |
| `src/logic/cuts/flattenWithCutStrokes.ts` | Pure flatten pipeline (materialize → unfold) |
| `src/state/meshSessionStore.ts` | `cutStrokes` CRUD, `patternRevision`, `flattenSnapshotKey` |
| `src/state/meshEditTool.ts` | Tool enum: `none` / `seam` / `cut` |
| `src/ui/useFlattenExport.ts` | Flatten hook with materialize wiring + warning toasts |
| `src/viewer/PickableMesh.tsx` | Seam pick + draw-cut input |
| `src/viewer/CutStrokesOverlay.tsx` | Committed stroke overlay (cyan) |
| `src/viewer/InProgressCutStrokeLine.tsx` | Imperative in-progress line (ref-based) |
| `src/viewer/displayNormalization.ts` | Display↔canonical coordinate transforms |
| `src/viewer/packCutStrokeDisplaySegments.ts` | Stroke→LineSegments packing |

## Done when

- [x] ADR 0100 accepted  
- [x] Vitest: `materializeCutStrokes.test.ts`, `materializeCutStrokes.adversarial.test.ts`, `workingMesh.test.ts`, `flattenWithCutStrokes.test.ts`, `meshSessionStore.test.ts`, viewer packing/sampling tests  
- [x] Manual: draw → delete stroke (base mesh unchanged) → Flatten → cuts visible in 2D  
- [x] `npm test` / `npm run lint`
