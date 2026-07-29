# Phase 1 — Freeform cut strokes (3D)

**Status:** In progress  
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

1. **Logic** — `materializeCutStrokes`, tests  
2. **State** — stroke CRUD, Flatten wiring in `useFlattenExport` ✅  
3. **Viewer** — draw tool + `CutStrokesOverlay` ✅  
4. **Docs** — ADR 0100 + update PRODUCT_ROADMAP when complete  

Full design notes: see Cursor plan *Freeform 3D cuts* (promote details here as ADR 0100 lands).

## Done when

- [x] ADR 0100 accepted  
- [x] Vitest coverage for materialize + snap + open-loop validation  
- [ ] Manual: draw → delete stroke (base mesh unchanged) → Flatten → cuts visible in 2D  
- [ ] `npm test` / `npm run lint`
