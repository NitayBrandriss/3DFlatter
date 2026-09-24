# Phase 2 — P2-E2 Mesh isolation (sub-mesh selection)

**Status:** Active — **Slice 1 complete**; next is **Slice 2 (State)**  
**ADR:** [0101 — Mesh isolation](../../decisions/product/0101-mesh-isolation.md)  
**Roadmap:** [PRODUCT_ROADMAP.md](../../../PRODUCT_ROADMAP.md) Phase 2 / P2-E2  
**Depends on:** PoC ADRs [0001](../../decisions/poc/0001-mesh-model-and-topology.md), [0002](../../decisions/poc/0002-unfold-step-1-hinge-island.md); product [ADR 0100](../../decisions/product/0100-freeform-cut-strokes.md)  
**Epic capture:** [phase2-epics.md](phase2-epics.md) (P2-E2 promoted; this file is the implementation SSOT)  
**Done bar:** [AGENTS.md — Algorithmic & slice Done criteria](../../../AGENTS.md#algorithmic--slice-done-criteria) (Tiers A–D). Green Vitest alone is not Done for Slices 1–4.

## Goal

Select a connected region on a dense connected mesh (seed-flood bounded by bracelet cut strokes and/or manual seams), isolate it with a **ghosted** remainder, and run seams / cuts / Flatten on that face mask without cloning the session `MeshModel` or remapping `EdgeKey`s.

## Scope summary

| Topic | Decision |
|-------|----------|
| Selection | Seed-flood + fence `EdgeKey`s from committed stroke surface walks; Shift-add / Alt-subtract; no lasso |
| Canonical scenario | Two **circumferential vertex-ring** bracelets (shoulder + wrist) → click the arm → isolate the band |
| Session | Face-index `Uint8Array` overlay; base mesh frozen; load clears mask; `meshLoadVersion` unchanged |
| Viewer | Shared full-mesh display positions; two index buffers; ghost remainder (not hide); frame isolate bbox |
| Flatten | Ephemeral face-filtered mesh (keep verts); inside strokes only; crossing strokes skip + toast |
| Seams | Pick/clear only edges with an isolated incident face; ghost-side seams stay in the registry |

## Viewer / tool UX

| Mode | Gesture / outcome |
|------|-------------------|
| Bound | Draw committed cut polylines (bracelets) and/or pick seams — these are flood fences without Flatten |
| Seed | Isolate tool: click a face → flood until seams, fence edges, fallback blockers, or boundary |
| Add / subtract | Shift-click adds a component; Alt-click subtracts; single-face click for cleanup |
| Whole-mesh flood | Warn; do not auto-isolate (includes **mesh-minus-scar** / incomplete bracelet) |
| Confirm | **Isolate** — ghost remainder, frame selection, `isolation.active = true` |
| Work | Switch to seam or cut; picks and draws hit isolate only |
| Exit | Restores full visibility; mask may persist for re-enter; edits remain on shared session |

**Parked (not v1):** screen lasso, hide toggle, brush radius, auto-split crossing strokes — [PRODUCT_ROADMAP.md — Deferred backlog](../../../PRODUCT_ROADMAP.md#deferred-backlog-not-scheduled) and ADR 0101 deferred section.

## Logic contracts (locked after Slice 1 QA)

Do not re-open in Slices 2–5 except via a new ADR / QA decision. Detail: [qa-isolation-slice1.md](qa-isolation-slice1.md) D1–D3; ADR 0101 fence paragraph.

| Contract | Rule |
|----------|------|
| Hybrid fence | `fenceEdges` = stroke **exit** `EdgeKey`s. `blockerFaces` **only** when that stroke’s walk has **no** exit edges (approximate-fence warning). Walked faces with exits are **not** opaque. |
| Classify vs flood | `classifyStrokeVsMask` uses **walked** faces on the **session** mesh (original `FaceIndex`). Flood barriers use hybrid `fenceEdges` + fallback `blockerFaces` only. |
| Whole-mesh | `coversAllNonOrphanFaces` = flood faces + scar (fallback blockers not entered) cover every non-orphan. Incomplete bracelet / chest scribble → warn, no auto-isolate. |
| Canonical bracelet | Circumferential **vertex-ring** stroke; exit keys ⊇ `tubeCircumferentialLoop`. Midpoint “bracelet” strokes are characterizing only (often non-separating → wrap + whole-mesh warn). |
| Subset | Keep full vertex array; pack masked faces. Subset face ids are **packed** (≠ session). `assertSubsetHasFaces` before `buildTopology`. |
| Warnings | Flood/fence `warnings` (non-manifold wall, `locate === none`, hop-cap, approximate fence) must reach the user — do not swallow in Zustand. |
| Unproven in Vitest | Dense ~84k-tri hitch (`locate` still brute-force). Slice summaries must say so. |

Reuse `src/logic/isolation/` — do not fork flood/fence/extract in state or viewer.

## Implementation slices

Execution order. Do not start a later slice until the previous is **Done** under the tier below (not merely green tests). Next slice is **blocked** until that slice’s Red Team High/Critical are closed or waived ([AGENTS.md](../../../AGENTS.md#algorithmic--slice-done-criteria)).

| # | Slice | Tier | Status |
|---|--------|------|--------|
| 1 | Logic | B–D | **Complete** — [qa-isolation-slice1.md](qa-isolation-slice1.md) remediated; High closed; Slice 2 unblocked |
| 2 | State | B–D | **Next** |
| 3 | Flatten | B–D | Blocked on Slice 2 Done |
| 4 | Viewer | B–D | Blocked on Slice 3 Done |
| 5 | UI | A (+ B if island-stats math is new) | Blocked on Slice 4 Done |
| 6 | Epic closeout + manual QA | A | Blocked on Slice 5; **not** a substitute for per-slice Red Team |

Plans for Slices 2–4 **must** list adversarial fixtures, tests that go red under wrong semantics, and explicit non-goals. “Wire the store + happy tests” is incomplete.

### 1. Logic — complete

`FaceMask`, `fenceEdgesFromStrokes`, `floodFromFace`, `extractFaceSubset` / `assertSubsetHasFaces`, `classifyStrokeVsMask`. Extract-then-`buildTopology` for Flatten (isolation boundary = real boundary). No mask-aware `partitionIslands` (sidebar uses extract-then-partition later).

### 2. State — next

**Paths:** `src/state/meshSessionStore.ts`, `src/state/meshEditTool.ts` (`"isolate"`).

**Ship:** overlay `{ active, mask }` keyed by original face count; seed / add / subtract via `floodFromFace` + `combineFloodIntoMask` + `fenceEdgesFromStrokes(committed strokes)`; enter Isolate only when `!coversAllNonOrphanFaces` and mask nonempty; exit clears `active` (mask may persist); successful **file load** clears mask (same as `cutStrokes`); `flattenSnapshotKey` gains isolation identity (**mask bits + `active`**), not a `patternRevision` bump for mask edits; `meshLoadVersion` unchanged on isolate enter/exit / seed / add / subtract.

**Must not:** pass walked faces as blockers; store a remapped sub-`MeshModel`; drop fence/flood `warnings` (keep on overlay for Slice 5 toasts).

**Adversarial / oracle (must be red if wrong):**

| Fixture / case | Oracle |
|----------------|--------|
| Vertex-ring two-bracelet + seed (reuse `openTube` / `branchedTube`) | Mask === arm band; `active` may be set |
| Incomplete bracelet + seed | `coversAllNonOrphanFaces`; confirm **refused**; `active` stays false |
| Ablation: `flattenSnapshotKey` without isolation identity | Suite must **fail** — key changes when mask or `active` changes, not when those are ignored |
| Seed/add/subtract | `meshLoadVersion` and `patternRevision` unchanged |
| Successful load | Mask cleared; failed load preserves mask |
| Branched tube: bracelet on limb A, seed A | Limb B bits stay 0 |

**Non-goals:** viewer picking, Flatten call, sidebar chrome.

**Red Team:** `docs/plans/product/qa-isolation-slice2.md`, IDs `ISO-S2-*`. Slice 3 blocked until High/Critical closed or waived.

**Unproven:** 84k-tri seed-click latency (fence walk + flood).

### 3. Flatten

**Paths:** `src/logic/cuts/flattenWithCutStrokes.ts`, `src/ui/useFlattenExport.ts`.

**Ship:** When `isolation.active`, `extractFaceSubset` → `assertSubsetHasFaces` → `buildTopology`; `partitionStrokesVsMask` on the **session** mesh + original-id mask; materialize **inside** strokes only; crossing + outside skip + toast; filter seams to keys with ≥1 remaining incident face on the subset; snapshot stales when isolation identity changes.

**Adversarial / oracle:**

| Fixture / case | Oracle |
|----------------|--------|
| Isolated band + inside stroke only | Unfold islands ⊆ isolate; inside stroke materialized |
| Crossing stroke | Classified `crossing`; skipped; toast; inside strokes still run |
| Disjoint mask (two islands) | `partitionIslands` length ≥ 2; vertex indices unchanged |
| Empty mask / `active` with zero faces | Must **not** call `buildTopology` unguarded (`assertSubsetHasFaces`) |
| Ablation: classify on **subset** face ids | Must fail — strokes classified on session `FaceIndex` |

**Non-goals:** auto-split crossing strokes (ISO-001); persisting derived mesh.

**Red Team:** `qa-isolation-slice3.md`, IDs `ISO-S3-*`.

### 4. Viewer

**Paths:** `src/viewer/MeshViewport.tsx`, `src/viewer/PickableMesh.tsx`. `displayNormalization.ts` **unchanged** (full-mesh scale).

**Ship:** Shared full-mesh positions; two index buffers (isolate pickable, remainder ghost + `raycast` off); seed click when tool is `"isolate"` (delegate to store flood, no second algorithm); while `active`, seam/cut picks hit isolate only; camera frames isolate bbox in **display** space.

**Adversarial / oracle:**

| Fixture / case | Oracle |
|----------------|--------|
| Ablation: ghost `raycast` still on | Ghost pick must fail the “no ghost pick” test |
| Isolate then pick ghost seam | No seam toggle |
| Frame isolate | Orbit target uses isolate display bbox, not full mesh |
| Display scale | Isolating a small band does not explode normalization |

**Non-goals:** hide-remainder toggle; lasso.

**Red Team:** `qa-isolation-slice4.md`, IDs `ISO-S4-*`.

### 5. UI

**Paths:** `src/ui/layout/AppSidebar.tsx` (and thin hooks).

**Ship:** Isolate tool; Isolate / Exit; selected face count; toast whole-mesh refuse + fence/flood warnings + crossing skip (if not already toasted in Slice 3); while isolated, island stats = extract-then-`partitionIslands` on the subset (not a new mask-aware partition).

**Tier:** A for chrome. If island-count math is inlined in React, pull it to `src/logic/` or store selectors and treat that bit as Tier B.

**Non-goals:** new selection gestures.

### 6. Epic closeout + manual QA

This file stays SSOT for slice order. Per-slice Red Team files stay in `docs/plans/product/qa-isolation-sliceN.md` and [qa-audits.md](qa-audits.md). Slice 6 is the **manual matrix** + epic Done checklist — not the first audit.

Dense avatar (~84k tris) is **manual only** (gitignored `3d_models/`). Record hitch / hop-cap if seen.

## Key files

| Path | Purpose |
|------|---------|
| `src/logic/isolation/` | Mask, hybrid fences, flood, extract, classify (`assertSubsetHasFaces`) |
| `src/logic/isolation/testMeshes.ts` | Tube, vertex-ring bracelet, `branchedTube`, non-manifold toy |
| `src/logic/cuts/surfacePath.ts` | Overlay tessellate (fence walk is a related fork; ISO-S1-013 parked) |
| `src/logic/cuts/flattenWithCutStrokes.ts` | Isolated flatten input (subset + inside strokes) — Slice 3 |
| `src/logic/mesh/partitionIslands.ts` | Island stats via extract-then-partition (sidebar) |
| `src/state/meshSessionStore.ts` | Isolation overlay, flatten fingerprint — Slice 2 |
| `src/state/meshEditTool.ts` | `"none"` / `"seam"` / `"cut"` / `"isolate"` — Slice 2 |
| `src/ui/useFlattenExport.ts` | Subset flatten + crossing-stroke toast — Slice 3 |
| `src/ui/layout/AppSidebar.tsx` | Tool select, Isolate / Exit, mask-scoped stats — Slice 5 |
| `src/viewer/MeshViewport.tsx` | Dual index buffers, ghost mesh, isolate framing — Slice 4 |
| `src/viewer/PickableMesh.tsx` | Seed click when isolate tool; picks only isolate geometry — Slice 4 |
| `src/viewer/displayNormalization.ts` | Unchanged — full-mesh scale |
| [qa-isolation-slice1.md](qa-isolation-slice1.md) | Slice 1 Red Team SSOT (remediated) |

## Non-goals (v1)

Match ADR 0101: hide toggle, lasso, brush radius, OBJ groups, destructive session split, 2D-blueprint isolation, auto-split crossing strokes, Worker flatten, mask-aware `partitionIslands`, snapping user strokes to geodesic rings, shared hop helper with `tessellateSurfaceSegment` (ISO-S1-013 parked).

## Done when

- [x] ADR 0101 accepted
- [x] Slice 1 logic + [qa-isolation-slice1.md](qa-isolation-slice1.md) High closed (hybrid fence, scar whole-mesh, vertex-ring + branched fixtures)
- [ ] Slice 2: isolate enter/exit does not bump `meshLoadVersion`; load clears mask; flatten key includes isolation; `ISO-S2` High closed or waived
- [ ] Slice 3: isolated Flatten + crossing skip; `assertSubsetHasFaces`; `ISO-S3` High closed or waived
- [ ] Slice 4: ghost remainder, isolate picking/frame; `ISO-S4` High closed or waived
- [ ] Slice 5: Isolate / Exit + toasts + mask-scoped stats
- [ ] Manual matrix (below) on a real session; dense avatar noted even if hitchy
- [ ] `npm test` / `npm run lint`

## Manual QA matrix (slice 6)

Canonical bracelets: draw **around** a limb (closed ring), not a longitudinal scribble.

| Case | Expect |
|------|--------|
| Seed on unseamed cube, no fences | Toast; no auto-isolate (whole mesh) |
| Incomplete bracelet + seed | Toast whole-mesh (wrap / scar); `active` stays false |
| One seam cycle + seed on one side | Flood stops at seams; Isolate ghosts the other side |
| Two closed vertex-ring bracelets + seed between | Band selected; remainder ghosted; camera frames band |
| Shift-click second body | Additive mask |
| Alt-click component | Subtract from mask |
| Isolate then seam pick on ghost | No pick |
| Isolate then Flatten | 2D pattern is the isolate only |
| Stroke crossing the mask | Skip + toast; inside strokes still materialize |
| Exit isolate | Full mesh visible; prior seams/strokes still there |
| Non-manifold edge on seed flood | Toast / warning; flood does not pretend it is a normal boundary |
| Dense body (manual, gitignored) | Same bracelet story; note hitch if fence walk stalls |
