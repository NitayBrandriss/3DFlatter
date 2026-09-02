# Phase 2 — P2-E2 Mesh isolation (sub-mesh selection)

**Status:** Active  
**ADR:** [0101 — Mesh isolation](../../decisions/product/0101-mesh-isolation.md)  
**Roadmap:** [PRODUCT_ROADMAP.md](../../../PRODUCT_ROADMAP.md) Phase 2 / P2-E2  
**Depends on:** PoC ADRs [0001](../../decisions/poc/0001-mesh-model-and-topology.md), [0002](../../decisions/poc/0002-unfold-step-1-hinge-island.md); product [ADR 0100](../../decisions/product/0100-freeform-cut-strokes.md)  
**Epic capture:** [phase2-epics.md](phase2-epics.md) (P2-E2 promoted; this file is the implementation SSOT)

## Goal

Select a connected region on a dense connected mesh (seed-flood bounded by bracelet cut strokes and/or manual seams), isolate it with a **ghosted** remainder, and run seams / cuts / Flatten on that face mask without cloning the session `MeshModel` or remapping `EdgeKey`s.

## Scope summary

| Topic | Decision |
|-------|----------|
| Selection | Seed-flood + fence `EdgeKey`s from committed stroke surface walks; Shift-add / Alt-subtract; no lasso |
| Canonical scenario | Two closed bracelets (shoulder + wrist) → click the arm → isolate the band |
| Session | Face-index `Uint8Array` overlay; base mesh frozen; load clears mask; `meshLoadVersion` unchanged |
| Viewer | Shared full-mesh display positions; two index buffers; ghost remainder (not hide); frame isolate bbox |
| Flatten | Ephemeral face-filtered mesh (keep verts); inside strokes only; crossing strokes skip + toast |
| Seams | Pick/clear only edges with an isolated incident face; ghost-side seams stay in the registry |

## Viewer / tool UX

| Mode | Gesture / outcome |
|------|-------------------|
| Bound | Draw committed cut polylines (bracelets) and/or pick seams — these are flood fences without Flatten |
| Seed | Isolate tool: click a face → flood until seams, fence edges, or boundary |
| Add / subtract | Shift-click adds a component; Alt-click subtracts; single-face click for cleanup |
| Whole-mesh flood | Warn; do not auto-isolate |
| Confirm | **Isolate** — ghost remainder, frame selection, `isolation.active = true` |
| Work | Switch to seam or cut; picks and draws hit isolate only |
| Exit | Restores full visibility; mask may persist for re-enter; edits remain on shared session |

**Parked (not v1):** screen lasso, hide toggle, brush radius, auto-split crossing strokes — [PRODUCT_ROADMAP.md — Deferred backlog](../../../PRODUCT_ROADMAP.md#deferred-backlog-not-scheduled) and ADR 0101 deferred section.

## Implementation slices

Execution order. Do not start a later slice until the previous is testable.

1. **Logic** — `FaceMask`, fence edges from strokes (reuse `surfacePath` / `cutSurfaceWalk`, not `materializeCutStrokes`), `floodFromFace`, face-subset extract (full vertex array, packed isolated faces). Vitest fixtures including a two-loop “bracelet band”. Optional: mask-aware `partitionIslands` **or** extract-then-`buildTopology` (prefer extract-then-topology for Flatten so the isolation boundary is a real boundary).
2. **State** — isolation overlay in `meshSessionStore`; enter / exit / seed / add / subtract; `flattenSnapshotKey` includes isolation identity; file load clears mask; `meshEditTool` gains `"isolate"`.
3. **Flatten** — `flattenWithCutStrokes` / `useFlattenExport` consume the ephemeral subset + contained strokes; crossing-stroke toast; snapshot stales when the mask or `active` flag changes.
4. **Viewer** — dual index buffers in `MeshViewport` / `PickableMesh`; ghost remainder (`raycast` off); isolate-only picking; camera frames isolate; seed click when tool is isolate.
5. **UI** — sidebar Isolate tool, Isolate / Exit, selected face count; session stats scoped to the mask while isolated (`AppSidebar`).
6. **Docs + QA** — this file stays SSOT for slices; manual matrix below; `npm test` / `npm run lint` per slice that touches TS/React.

## Key files

Existing paths to extend; isolation logic modules are planned, not present until slice 1.

| Path | Purpose |
|------|---------|
| `src/logic/isolation/` (planned) | Mask, fence edges, flood, face-subset extract |
| `src/logic/cuts/surfacePath.ts` | Read-only surface walk for fence `EdgeKey`s |
| `src/logic/cuts/flattenWithCutStrokes.ts` | Isolated flatten input (subset mesh + inside strokes) |
| `src/logic/mesh/partitionIslands.ts` | Island stats within mask (sidebar) if not using extract-only |
| `src/state/meshSessionStore.ts` | Isolation overlay, flatten fingerprint, load clears mask |
| `src/state/meshEditTool.ts` | `"none"` / `"seam"` / `"cut"` / `"isolate"` |
| `src/ui/useFlattenExport.ts` | Subset flatten + crossing-stroke toast |
| `src/ui/layout/AppSidebar.tsx` | Tool select, Isolate / Exit, mask-scoped stats |
| `src/viewer/MeshViewport.tsx` | Dual index buffers, ghost mesh, isolate framing |
| `src/viewer/PickableMesh.tsx` | Seed click when isolate tool; picks only isolate geometry |
| `src/viewer/displayNormalization.ts` | Unchanged — full-mesh scale |

## Non-goals (v1)

Match ADR 0101: hide toggle, lasso, brush radius, OBJ groups, destructive session split, 2D-blueprint isolation, auto-split crossing strokes, Worker flatten.

## Done when

- [ ] ADR 0101 accepted (this planning pass)
- [ ] Vitest: flood + two-bracelet band, fence edges from strokes, subset extract keeps vertex indices, crossing stroke classified skip
- [ ] State: isolate enter/exit does not bump `meshLoadVersion`; load clears mask; flatten key includes isolation
- [ ] Manual: two bracelets → seed between them → ghost torso/hand context → Flatten unfolds only the band
- [ ] Manual: crossing stroke → toast, Flatten still runs on inside strokes; exit isolate → full mesh, seams/strokes persist
- [ ] `npm test` / `npm run lint`

## Manual QA matrix (slice 6)

| Case | Expect |
|------|--------|
| Seed on unseamed cube, no fences | Toast; no auto-isolate (whole mesh) |
| One seam cycle + seed on one side | Flood stops at seams; Isolate ghosts the other side |
| Two closed bracelets + seed between | Band selected; remainder ghosted; camera frames band |
| Shift-click second body | Additive mask |
| Alt-click component | Subtract from mask |
| Isolate then seam pick on ghost | No pick |
| Isolate then Flatten | 2D pattern is the isolate only |
| Stroke crossing the mask | Skip + toast; inside strokes still materialize |
| Exit isolate | Full mesh visible; prior seams/strokes still there |
