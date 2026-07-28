# 3DFlatter — QA Code Audit

> **How to use this doc (2026-07-28):** Static audit snapshot from **2026-07-19**; **[QA remediation Slices 0–7](plans/archive/qa-audit-remediation.md) is complete** (2026-07-27). For product roadmap, see [plans/README.md](plans/README.md). For **what is still open vs deferred**, see [Findings count](#findings-count) and [Low](#low) — not the 2026-07-19 executive bullets alone.

**Date:** 2026-07-19 (Staff/Principal refresh of 2026-07-14 audit; Slice 0 ADR sync applied same day)  
**Scope:** `src/logic/`, `src/state/`, `src/ui/` (incl. `layout/`), `src/viewer/`, `app/`, `docs/decisions/`, `docs/plans/`  
**Method:** Deep static review against ADRs 0001–0003, AGENTS.md, plans hub + archives (incl. quality overlay + mobile layout), prior audit IDs. Code read + grep SoC verification + `npm test` / `npm run lint`. **No application code changes** — this file only.  
**Test baseline (audit day):** `npm test` — **29 files, 138 tests, all passing** (was 28 / 122 on 2026-07-14).  
**Test baseline (post–Slice 7):** run `npm test` locally — **33 files, 168 tests** (2026-07-28).  
**Lint baseline:** `npm run lint` — **passes**.

---

## Severity scale

| Level | Meaning |
|-------|---------|
| **Critical** | Data loss, wrong geometry output, or broken core workflow for real inputs |
| **High** | Significant UX bug, race condition, stuck UI state, or broken required tooling |
| **Medium** | Performance, maintainability, or inconsistent behavior under common use |
| **Low** | Minor polish, dead code, or fragile patterns unlikely to bite soon |
| **Info** | Documented PoC limits, intentional plan deferrals, or acceptable tradeoffs |

---

## Executive summary

Architecture remains **strong for a PoC**: triangle-soup unfold (ADR 0002), `EdgeKey` seam identity, and a clean `src/logic/` boundary (zero React/Three.js imports — verified). Prior Critical/High lifecycle bugs stay fixed (`loadSeq`, weld/orphan skips, partial unfold, flatten keyed to `meshLoadVersion`).

**Post-remediation (2026-07-27):** Slices 0–7 addressed the Medium/High remediation backlog from this audit (docs sync, quality correctness, logic DRY/perf, I/O budgets, Zustand selectors, layout/a11y, UI structure). **No open Critical or High items.** Remaining work is **Low polish**, **Info** PoC limits, and **UI-004** (Web Worker flatten) **deferred** per [ADR 0004](decisions/0004-tech-debt-remediation-strategy.md).

**Original 2026-07-19 focus:** ADR validity + doc drift, SoC, DRY, performance, and edge-case logic. ADRs 0001–0003 remain the right foundation; doc gaps called out here were largely addressed in Slices 0–1.

**Resolved since 2026-07-14 (highlights):** STATE-004, VIEW-005, UI-006; full slice list in [Changes since 2026-07-14](#changes-since-2026-07-14).

---

## Changes since 2026-07-14

| Status | Notes |
|--------|--------|
| **Resolved** | STATE-004, VIEW-005; UI-006 implemented; DOC-001/002/003 (Slice 0); **TEAR-001, LOGIC-025, LOGIC-006 assert** (Slice 1); **LOGIC-007, LOGIC-008, LOGIC-012** (Slice 2); **LOGIC-009, LOGIC-010, LOGIC-011, PERF-002** (Slice 3); **LOGIC-004/005/013–015, IO-001/002/003** (Slice 4); **STATE-003, ARCH-001, ARCH-003, UI-008** (Slice 5) |
| **Resolved (Slice 6–7, 2026-07-27)** | STATE-006, VIEW-001, VIEW-006, LAYOUT-001/002/004/008/009/010, A11Y-002/003; UI-001/003, UI-002 mitigated, APP-001 mitigated, APP-002/003, LAYOUT-007 |
| **New Medium (2026-07-19 audit)** | TEAR-001, LOGIC-025, DOC-001, DOC-003, ARCH-003; VIEW-006 (filed 2026-07-23, fixed Slice 6) |
| **New Low (2026-07-19 audit)** | DOC-002 (PERF-002 fixed Slice 3) |
| **Deferred (not blocking PoC)** | **UI-004** Web Worker flatten — [remediation Deferred](plans/archive/qa-audit-remediation.md#deferred) |
| **Still open** | Low-priority IDs in [Low](#low) table (~11); optional LOGIC-006 BFS walker share |
| **Baseline** | Quality overlay + mobile layout shipped; remediation plan complete |

---

## 1. Architectural critique & ADR alignment

### Verdict on the decisions themselves

| ADR | Still valid? | Critique |
|-----|--------------|----------|
| **0001 — Mesh + topology** | **Yes — keep** | Packed arrays, 0-based indices, `EdgeKey`, XY plane remain optimal. Fan triangulation + concave warning is an honest PoC tradeoff. Half-edge remains correctly deferred. **Amend:** document STL as a first-class I/O path; clarify that “degenerate” means **index** degeneracy only (geometric zero-area with distinct indices is out of scope). Vertex welding is shipped but only mentioned as a future note — promote to a short accepted consequence or tiny follow-up ADR. |
| **0002 — Hinge unfold + triangle soup** | **Yes — keep** | Rejecting `Map<VertexIndex, Vec2>` is still the right call for slits/darts and SVG soup. Parent-soup-copy BFS is implemented faithfully. **Amend:** “Deferred to Step 2+” (orchestration, layout, 2D viewer, collision) is **stale** — those shipped under plans/ADR 0003. Mark deferred items superseded or add a short ADR 0004 for mesh-level orchestration contracts (`unfoldMesh`, layout indexing). |
| **0003 — Quality detection** | **Yes — keep** | Orthogonality and complementary 3a/3b remain sound. Tear kinds and W2 production assert updated in Slice 1. Soft-cap hooks for huge closed-mesh reports remain a future note as meshes grow. |

### Code alignment (drift)

| Contract | Status |
|----------|--------|
| Packed triangulated `MeshModel`, 0-based indices | **Compliant** |
| `EdgeKey` seam identity (`Set`, no float matching) | **Compliant** |
| Triangle-soup unfold; no `Map<VertexIndex, Vec2>` | **Compliant** |
| `unfoldIsland` does not read seams | **Compliant** |
| XY flatten plane | **Compliant** |
| Quality orthogonal to unfold; does not set `error` | **Compliant** |
| `meshLoadVersion` not bumped on seam toggles | **Compliant** |
| Surface degenerate/non-manifold to user | **Addressed** (Slice 4 — topology skip toasts via load path; sidebar counts remain) |
| `src/logic/` free of React/Three.js | **Compliant** (grep: zero matches) |
| ADR 0001 OBJ-only narrative vs STL in product | **Addressed** (DOC-001, Slice 0 — 2026-07-19) |
| ADR 0002 deferred list vs shipped Step 2/3 | **Addressed** (DOC-002, Slice 0 — 2026-07-19) |
| ADR 0003 tear taxonomy + W2 assertion | **Addressed** (Slice 1 — TEAR-001 + LOGIC-006 production assert) |

### State management (Zustand vs local hooks)

**What works**

- **Zustand (`meshSessionStore`)** owns durable session: mesh, topology, seams, load lifecycle, toasts, seam mode. `loadSeq` race handling and “failed load keeps prior session” are solid.
- **Local hooks** own ephemeral UI: flatten snapshot + quality overlay (`useFlattenExport`), viewport prefs, layout (sidebar/split/peek). This matches the quality-overlay plan (“do not push quality fields into the store”).
- Flatten keyed to `meshLoadVersion` correctly survives seam edits without false clears (STATE-002).

**What to improve (not blockers)**

- Granular Zustand selectors (mesh identity vs seams vs chrome) + `seamsContentKey` memoization for session stats (ARCH-001, STATE-003 — Slice 5). Flatten snapshot remains hook-local with documented version contract (ARCH-003).
- Dual ownership of “pattern validity” (session seams vs flatten snapshot) is intentional — see `useFlattenExport` ARCH-003 comment.

### Separation of concerns

| Layer | Verdict |
|-------|---------|
| `src/logic/` | **Clean** — pure geometry/I/O; no React/Three |
| `src/viewer/` | Correct Three/R3F boundary; pick math delegated to `resolvePick`; display normalization stays out of topology |
| `src/state/` | Thin orchestration over logic; appropriate |
| `src/ui/` | Mostly thin; `AppSidebar` prop surface and `page.tsx` orchestration remain the main maintainability costs (UI-002, APP-001) |
| `app/` | Routes + demo API; demo catalog in `src/data/` (APP-002, Slice 7) |

No material SoC violations found. Overlay caps live in `qualitySummary.ts` (logic) while rendering caps apply in UI — acceptable and tested.

---

## Critical

*(None open.)* Prior LOGIC-001 remains **Fixed** (2026-07-14): weld drops index-degenerate faces; partition skips topology orphans; `unfoldMesh` continues past failed islands.

---

## High

*(None open.)* Prior STATE-001/002/007/008, LOGIC-002/003, LAYOUT-003, A11Y-001, TOOL-001 remain **Fixed** (2026-07-14).

### STATE-004 — Failed loads bump `meshLoadVersion` *(resolved 2026-07-19 re-verify)*

| Field | Detail |
|-------|--------|
| **Severity** | Low → **Fixed** |
| **Status** | **Fixed** — catch path keeps prior session and does not increment `meshLoadVersion` (comment cites STATE-007 / STATE-004) |
| **Files** | `src/state/meshSessionStore.ts` |

---

## Medium

### TEAR-001 — Dead branch in `classifyTearKind`; parallel-offset tears reported as `skew` *(new)*

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Category** | Logic / Documentation Alignment |
| **Status** | **Fixed** (2026-07-19, remediation Slice 1) — parallel non-collinear → `gap`; angled → `skew`; ADR 0003 tear-kind table updated |
| **Files** | `src/logic/unfold/detectTears.ts` (`classifyTearKind`) |
| **Description** | ~~After the collinear `gap`/`overlap` branch, both remaining paths returned `"skew"`…~~ Fixed. |
| **Suggested fix** | ~~…~~ Done. |

### LOGIC-025 — Quality `islandIndex` rebased after failed islands *(new)*

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Category** | Logic |
| **Status** | **Fixed** (2026-07-19, remediation Slice 1) — `sourceIslandIndex` on successful unfolds; `layoutIslands` prefers it for `islandIndex` |
| **Files** | `unfoldMesh.ts`, `layoutIslands.ts`, `types.ts` (`UnfoldIslandResult.sourceIslandIndex`) |
| **Description** | ~~Warnings used partition index; layout rebased…~~ Fixed. |
| **Suggested fix** | ~~…~~ Done. |

### DOC-001 — ADR 0001 still OBJ-centric while STL is first-class *(new)*

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Category** | Documentation Alignment |
| **Status** | **Fixed** (2026-07-19, remediation Slice 0) — ADR 0001 documents peer OBJ/STL I/O, weld-on-load, index-only degeneracy |
| **Files** | `docs/decisions/0001-mesh-model-and-topology.md`, `src/logic/io/stl/parseStl.ts`, AGENTS.md |
| **Description** | ~~Product and AGENTS treat OBJ + STL as peer I/O…~~ Addressed by ADR amend. |
| **Suggested fix** | ~~…~~ Done. |

### DOC-003 — ADR 0003 W2 overstates production tree-size assertion *(new)*

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Category** | Documentation Alignment / Logic |
| **Status** | **Fixed** (2026-07-19, remediation Slice 0) — W2 softened then tightened by Slice 1 production assert |
| **Files** | `docs/decisions/0003-unfold-quality-detection.md` (W2), `analyzeUnfoldedIsland.ts` |
| **Description** | ~~W2 listed production assert…~~ Doc + Slice 1 assert done. |
| **Suggested fix** | ~~…~~ Done. |

### ARCH-003 — Flatten/session dual state without shared selector strategy *(new)*

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Category** | Architecture |
| **Status** | **Fixed** (2026-07-19, remediation Slice 5) — documented dual-ownership in `useFlattenExport`; page selects mesh identity vs seams; flatten snapshot stays hook-local |
| **Files** | `app/page.tsx`, `src/ui/useFlattenExport.ts`, `src/state/meshSessionStore.ts` |
| **Description** | ~~Session and flatten snapshot dual ownership undocumented / page selected whole session.~~ Contract documented; selectors split; no separate flatten store. |
| **Suggested fix** | ~~…~~ Done. |

### LOGIC-004 — Topology degeneracy check is index-only, not geometric

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Category** | Logic |
| **Status** | **Accepted / documented** (ADR 0001 Slice 0 + code comments Slice 4) — geometric area test deferred |
| **Files** | `src/logic/mesh/buildTopology.ts`, `faceDegeneracy.ts` |
| **Description** | Only duplicate **indices** are degenerate. Collinear / zero-area triangles with three distinct indices pass into unfold. **Documented as ADR 0001 v1 out-of-scope**. |
| **Suggested fix** | ~~Optional geometric test…~~ Doc + comments done for v1. |

### LOGIC-005 — Degenerate-face skip uses `console.warn`, not structured warnings

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Category** | Logic / Documentation Alignment |
| **Status** | **Fixed** (2026-07-19, remediation Slice 4) — no `console.warn`; load path toasts `skippedDegenerateFaceCount` |
| **Files** | `buildTopology.ts`, `meshSessionStore.ts` |
| **Description** | ~~Topology skip logged to console.~~ Count remains on `Topology`; session toasts on load. |
| **Suggested fix** | ~~…~~ Done. |

### LOGIC-006 — Duplicated BFS tree vs `unfoldIsland` (tear-detection drift risk)

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Category** | DRY / Logic |
| **Status** | **Mitigated** (2026-07-19, Slice 1 + Slice 2) — production assert in `analyzeUnfoldedIsland`; face/edge helpers shared via `faceUtils` (LOGIC-007). Full shared BFS walker still optional; assert remains safety net. |
| **Files** | `buildUnfoldTreeEdges.ts`, `unfoldIsland.ts`, `analyzeUnfoldedIsland.ts`, `faceUtils.ts` |
| **Description** | Tear detection depends on mirroring unfold BFS (ADR 0003 W2). Queue/slot walk still duplicated; face/edge helper drift reduced; size mismatch **throws**. |
| **Suggested fix** | Optional: extract shared BFS walker later; assert remains. |

### LOGIC-007 — Duplicated face/edge helpers (DRY)

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Category** | DRY |
| **Status** | **Fixed** (2026-07-19, remediation Slice 2) — `src/logic/mesh/faceUtils.ts` |
| **Files** | `faceUtils.ts`; call sites: `unfoldIsland.ts`, `buildUnfoldTreeEdges.ts`, `partitionIslands.ts`, `unfoldEdge2d.ts`, `resolvePick.ts` |
| **Description** | ~~`faceVertices` / `readFaceVertices`, `directedEdgeForSlot`, `edgeKeyForFace`, `EDGE_SLOTS` near-copies.~~ Centralized. |
| **Suggested fix** | ~~…~~ Done. |

### LOGIC-008 — `parseEdgeKey` duplicated / inconsistent

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Category** | DRY |
| **Status** | **Fixed** (2026-07-19, remediation Slice 2) — `parseEdgeKey` beside `makeEdgeKey` |
| **Files** | `edgeKey.ts`; callers: `displaySeamSegments.ts`, `seamSegments2d.ts`, `detectTears.ts` |
| **Description** | ~~Local `parseEdgeKey` in two modules; `detectTears` inlined `.split(",").map(Number)`.~~ Unified on `parseInt`. |
| **Suggested fix** | ~~…~~ Done. |

### LOGIC-009 — `detectTears` scans entire mesh edge map per island

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Category** | Performance |
| **Status** | **Fixed** (2026-07-19, remediation Slice 3) — island-local edge walk via `edgeKeyForFace` |
| **Files** | `src/logic/unfold/detectTears.ts` |
| **Description** | ~~Iterates all `topology.edgeToFaces` filtered by island set → O(mesh edges) per island.~~ Now O(island faces). |
| **Suggested fix** | ~~…~~ Done. |

### LOGIC-010 — `segment2dForFaceSlot` uses O(n) `indexOf` in hot paths

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Category** | Performance |
| **Status** | **Fixed** (2026-07-19, remediation Slice 3) — `buildFaceSoupIndexMap` once per island analysis |
| **Files** | `src/logic/unfold/unfoldEdge2d.ts`, callers in `detectCollisions` / `detectTears` |
| **Description** | ~~Called per edge pair in collision/tear detection; linear scan per call.~~ Optional `Map` lookup. |
| **Suggested fix** | ~~…~~ Done. |

### LOGIC-011 — Triple SAT + double triangle clipping in collision detection

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Category** | Performance |
| **Status** | **Fixed** (2026-07-19, remediation Slice 3) — one SAT + `clipOverlappingTriangles`; area/centroid from same polygon |
| **Files** | `detectCollisions.ts`, `geom2d/triangle2d.ts` |
| **Description** | ~~Per candidate pair: ≈ 3× SAT + 2× clip.~~ Hot path is 1× SAT + 1× clip. |
| **Suggested fix** | ~~…~~ Done. |

### LOGIC-012 — Tolerance constants fragmented

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Category** | DRY / Architecture |
| **Status** | **Fixed** (2026-07-19, remediation Slice 2) — `WELD_EPSILON`, `CONVEXITY_EPS`, `PICK_EDGE_FRACTION` exported from `tolerances.ts` |
| **Files** | `tolerances.ts`, `weldVertices.ts`, `polygonConvexity.ts`, `resolvePick.ts` |
| **Description** | ~~Fragmented local epsilons.~~ Centralized; weld/convexity alias `SAT_EPS`; pick fraction documented as scale-relative. |
| **Suggested fix** | ~~…~~ Done. |

### LOGIC-013 — STL degenerate detection uses exact float equality

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Category** | Logic |
| **Status** | **Fixed** (2026-07-19, remediation Slice 4) — epsilon compare via `WELD_EPSILON` |
| **Files** | `src/logic/io/stl/parseStl.ts` |
| **Description** | ~~Exact `===` missed near-coincident corners.~~ Uses weld epsilon. |
| **Suggested fix** | ~~…~~ Done. |

### LOGIC-014 — Seam segment export silently drops missing geometry

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Category** | Logic |
| **Status** | **Fixed** (2026-07-19, remediation Slice 4) — `skipped` diagnostics folded into `unfoldMesh` warnings |
| **Files** | `seamSegments2d.ts`, `unfoldMesh.ts` |
| **Description** | ~~Silent `continue`.~~ Skips reported with reasons. |
| **Suggested fix** | ~~…~~ Done. |

### LOGIC-015 — `listSeamSegments2d` does not validate seam eligibility

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Category** | Logic |
| **Status** | **Fixed** (2026-07-19, remediation Slice 4) — filters via `canSelectAsSeam` |
| **Files** | `seamSegments2d.ts`, `edgeEligibility.ts` |
| **Description** | ~~Any key drawn.~~ Ineligible keys skipped with diagnostics. |
| **Suggested fix** | ~~…~~ Done. |

### LOGIC-024 — Island order / orphans *(mitigated)*

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Status** | Largely mitigated by LOGIC-001/002 fixes; orphan faces skipped in partition; partial unfold returns warnings |
| **Files** | `partitionIslands.ts`, `unfoldMesh.ts` |
| **Description** | Remaining risk is reporting index confusion (see LOGIC-025), not full-mesh hard fail. |

### STATE-003 — Full island re-partition on every seam toggle

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Category** | Performance |
| **Status** | **Fixed** (2026-07-19, remediation Slice 5) — `seamsContentKey` + page memo deps on mesh/topology/seams content; empty `clearAllSeams` is a no-op |
| **Files** | `meshSessionStore.ts` (`computeSessionStats`, `seamsContentKey`), `app/page.tsx` |
| **Description** | ~~`useMemo([session])` re-partitioned on every new session object.~~ Partition runs only when mesh, topology, or seam *contents* change. |
| **Suggested fix** | ~~…~~ Done. |

### STATE-006 — Escape key collapses sidebar on desktop

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Category** | Logic / UX |
| **Status** | **Fixed** (2026-07-27, remediation Slice 6) — Escape closes sidebar on mobile overlay only |
| **Files** | `src/ui/layout/useSidebarState.ts` |
| **Description** | ~~Escape closed whenever open, including desktop in-flow sidebar.~~ |
| **Suggested fix** | ~~…~~ Done. |

### UI-001 — Duplicated post-load scale reset

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Category** | DRY |
| **Status** | **Fixed** (2026-07-27, Slice 7) — `useMeshLoadHandlers` + `onBeforeMeshLoad` |
| **Files** | `useMeshLoadHandlers.ts`, `useViewportPreferences.ts`, `app/page.tsx` |
| **Description** | ~~Duplicate scale reset in pick vs demo paths.~~ |
| **Suggested fix** | ~~…~~ Done. |

### UI-002 — `AppSidebar` prop drilling (~40 props)

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Category** | Architecture |
| **Status** | **Mitigated** (2026-07-27, Slice 7) — five grouped prop objects; card-level context still optional |
| **Files** | `app/page.tsx`, `AppSidebar.tsx`, `appSidebarProps.ts` |
| **Description** | ~~~40 flat props from page.~~ Grouped `layout` / `session` / `flatten` / `view` / `demo`. |
| **Suggested fix** | Further split into sidebar cards + hooks if prop groups grow again. |

### UI-003 — 2D preview duplicates export SVG structure

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Category** | DRY |
| **Status** | **Fixed** (2026-07-27, Slice 7) — `listTier1Faces` / `listTier1Seams` in `tier1Preview.ts` |
| **Files** | `UnfoldViewer2D.tsx`, `tier1Preview.ts` |
| **Description** | ~~Face/seam iteration duplicated.~~ Quality overlay remains viewer-only by design. |
| **Suggested fix** | ~~…~~ Done for tier-1 faces/seams. |

### UI-004 — Synchronous flatten blocks UI thread

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Category** | Performance |
| **Status** | **Deferred** (PoC) — per [ADR 0004](decisions/0004-tech-debt-remediation-strategy.md) Decision 1; [remediation Deferred](plans/archive/qa-audit-remediation.md#deferred) |
| **Files** | `src/ui/useFlattenExport.ts` |
| **Description** | `unfoldMesh` (+ quality) runs sync in `try/finally`. Loading overlay covers parse only. |
| **Suggested fix** | Worker, chunked yield, or explicit flatten progress UI — revisit when real meshes block the main thread. |

### UI-008 — 2D viewer always shows seams; export has toggle

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Category** | Logic / UX |
| **Status** | **Fixed** (2026-07-19, remediation Slice 5) — `UnfoldViewer2D` `showSeams` shares `includeSeamsInExport` |
| **Files** | `UnfoldViewer2D.tsx`, `useFlattenExport.ts`, `app/page.tsx` |
| **Description** | ~~Preview always mapped seams; export had a separate toggle.~~ Same flag drives preview and SVG export. |
| **Suggested fix** | ~~…~~ Done. |

### LAYOUT-001 — Layout constants duplicated in TS and CSS

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Category** | DRY |
| **Status** | **Fixed** (2026-07-27, Slice 6) — `applyLayoutTokensToDocument` + `LAYOUT_BREAKPOINT_PX`; CSS `@media` literals documented |
| **Files** | `src/ui/layout/constants.ts`, `applyLayoutTokens.ts`, `app/globals.css` |
| **Description** | ~~Breakpoint / widths duplicated.~~ TS pushes token values on mount. |
| **Suggested fix** | ~~…~~ Done (media queries still use px literals — CSS limitation). |

### LAYOUT-002 — Stale `containerHeight` for split aria max

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Category** | Logic |
| **Status** | **Fixed** (2026-07-27, Slice 6) — `ResizeObserver` on viewport container |
| **Files** | `useResizableSplit.ts` |
| **Description** | ~~Height read during render without ResizeObserver.~~ |
| **Suggested fix** | ~~…~~ Done. |

### LAYOUT-004 — SSR/hydration sidebar flash

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Category** | Logic |
| **Status** | **Fixed** (2026-07-27, Slice 6) — mobile-first SSR snapshot; sidebar storage deferred to `useEffect` |
| **Files** | `useMediaQuery.ts`, `useSidebarState.ts` |
| **Description** | ~~SSR desktop default + storage in `useState` init.~~ |
| **Suggested fix** | ~~…~~ Done. |

### LAYOUT-008 — Stored split height not clamped on init

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Category** | Logic |
| **Status** | **Fixed** (2026-07-27, Slice 6) — clamp stored split after container measure |
| **Files** | `useResizableSplit.ts`, `readLayoutStorage.ts` |
| **Description** | ~~Corrupt/huge storage until drag.~~ |
| **Suggested fix** | ~~…~~ Done. |

### LAYOUT-009 — Peek `setPointerCapture` may starve range slider

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Category** | Logic |
| **Status** | **Fixed** (2026-07-27, Slice 6) — peek without pointer capture |
| **Files** | `usePeekThrough.ts`, `PeekThroughControl.tsx` |
| **Description** | ~~Wrapper capture stole range drags.~~ |
| **Suggested fix** | ~~…~~ Done. |

### LAYOUT-010 — Layout storage read during `useState` init

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Category** | Logic |
| **Status** | **Fixed** (2026-07-27, Slice 6) — sidebar/split storage after mount |
| **Files** | `readLayoutStorage.ts`, layout hooks |
| **Description** | ~~Hydration mismatch from sync storage read.~~ |
| **Suggested fix** | ~~…~~ Done. |

### A11Y-002 — Mobile tabs lack keyboard tab pattern

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Category** | Logic / a11y |
| **Status** | **Fixed** (2026-07-27, Slice 6) — roving `tabIndex` + ArrowLeft/Right on tablist |
| **Files** | `ViewportChrome.tsx` |
| **Description** | ~~Missing keyboard pattern.~~ |
| **Suggested fix** | ~~…~~ Done. |

### A11Y-003 — Split separator not keyboard-resizable

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Category** | Logic / a11y |
| **Status** | **Fixed** (2026-07-27, Slice 6) — ArrowUp/Down on separator + focus ring |
| **Files** | `ViewportChrome.tsx`, `useResizableSplit.ts` |
| **Description** | ~~No keyboard resize.~~ |
| **Suggested fix** | ~~…~~ Done. |

### IO-001 — STL format heuristic can prefer binary over ASCII

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Category** | Logic |
| **Status** | **Fixed** (2026-07-19, remediation Slice 4) — ASCII-first when `solid…`; binary fallback if ASCII fails and size layout is valid |
| **Files** | `parseStl.ts` |
| **Description** | ~~`solid…` + binary-sized length → binary.~~ Prefer ASCII then fall back. |
| **Suggested fix** | ~~…~~ Done. |

### IO-002 — No max file / triangle budget on client load

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Category** | Performance / Logic |
| **Status** | **Fixed** (2026-07-19, remediation Slice 4) — `loadBudgets.ts`: 50 MiB / 500k tris |
| **Files** | `loadBudgets.ts`, `parseStl.ts`, `parseObj.ts`, `meshSessionStore.ts` |
| **Description** | ~~No soft max.~~ Clear errors before heavy allocate/decode. |
| **Suggested fix** | ~~…~~ Done. |

### VIEW-001 — PickableMesh drag guard can leave stale pointer state

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Category** | Logic |
| **Status** | **Fixed** (2026-07-27, Slice 6) — cancel/leave + document pointer cleanup |
| **Files** | `PickableMesh.tsx` |
| **Description** | ~~Stale `pointerDown` on cancel/leave.~~ |
| **Suggested fix** | ~~…~~ Done. |

### APP-001 — `page.tsx` is a large orchestrator

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Category** | Architecture |
| **Status** | **Mitigated** (2026-07-27, Slice 7) — `useHomeSession`, `AppLayout`, load/view hooks |
| **Files** | `app/page.tsx`, `useHomeSession.ts`, `AppLayout.tsx` |
| **Description** | ~~Monolithic wiring.~~ Page composes hooks + layout shell + viewport. |
| **Suggested fix** | Further card extraction if page grows again. |

### ARCH-001 — Broad Zustand selector re-renders entire page on seam toggle

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Category** | Performance / Architecture |
| **Status** | **Fixed** (2026-07-19, remediation Slice 5) — page splits mesh identity / seams / chrome / actions; `UnfoldViewer2D` memoized |
| **Files** | `app/page.tsx` |
| **Description** | ~~Wholesale `session` selection.~~ Granular selectors; further AppSidebar decomposition remains Optional Slice 7. |
| **Suggested fix** | ~~…~~ Done at page level. |

### VIEW-006 — OrbitControls stuck after mobile Flatten → 2D tab *(new)*

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Category** | Logic / UX |
| **Status** | **Fixed** (2026-07-27, Slice 6) — `SyncGlToPanel` ResizeObserver; `mobilePanel` → `"3d"` on mesh load |
| **Files** | `app/page.tsx`, `ViewportChrome.tsx`, `MeshViewport.tsx`, `syncGlToPanel.ts`, `globals.css` |
| **Description** | ~~Canvas 0×0 when 3D tab hidden after Flatten.~~ |
| **Suggested fix** | ~~…~~ Done. |
| **Repro** | Narrow viewport → load mesh → Flatten → 2D tab → 3D tab — orbit should work without refresh. |

---

## Low

Consolidated Low-severity items (includes fixed rows for history). **Open** rows are counted in [Findings count](#findings-count).

| ID | Category | Files | Description | Suggested fix | Status |
|----|----------|-------|-------------|---------------|--------|
| **PERF-002** *(new)* | Performance | `spatialGrid.ts` | Per-call rebuild of index map + string-keyed `seen` (`${lo},${hi}`) on dense meshes | Index by soup position; numeric pair keys | **Fixed** (Slice 3, 2026-07-19) — soup-index array + `lo * stride + hi` |
| **DOC-002** *(new)* | Documentation Alignment | ADR 0002 | “Deferred to Step 2+” lists shipped features | Mark superseded / point at plans + ADR 0003 | **Fixed** (Slice 0, 2026-07-19) |
| **STATE-005** | Logic | `meshSessionStore.ts` | Undocumented double `rAF` before parse | Worker / `startTransition` / document intent | Open |
| **UI-005** | Logic | `ToastStack.tsx` | `ToastItem` effect depends on `onDismiss` | Stable ref or omit from deps | Open |
| **UI-007** | DRY | `AppSidebar.tsx` | Redundant nested `stats ?` / `session ?` | Simplify | Open |
| **LAYOUT-005** | DRY | `ViewportChrome.tsx` | Dead re-export `SPLIT_2D_MIN` | Remove | Open |
| **LAYOUT-006** | Performance | `usePeekThrough.ts` | Bind object new every render | Memoize | **Fixed** (Slice 6) |
| **LAYOUT-007** | Architecture | `AppLayout.tsx` | Mobile backdrop in page | Move into shell | **Fixed** (Slice 7) |
| **VIEW-002** | Logic | `MeshViewport.tsx` | Camera refit may miss control target first frame | `useLayoutEffect` / ref callback | Open |
| **VIEW-003** | DRY | `MeshViewport.tsx` | Empty vs loaded OrbitControls diverge | Share config | Open |
| **VIEW-004** | Logic | `SeamOverlay.tsx` | `linewidth={2}` ignored on most WebGL | Document or mesh-line | Open |
| **VIEW-005** | Logic | `page.tsx` | Toasts were inside `viewport3d` (hidden on mobile 2D tab) | **Fixed** — `ToastStack` is now a page sibling of `ViewportChrome` | **Fixed** |
| **APP-002** | Architecture | demo API, `src/data/demoModels.ts` | Catalog under `src/data/` | Move from `src/ui/` | **Fixed** (Slice 7) |
| **APP-003** | DRY | `demoLoadMessages.ts` | Demo error strings duplicated | Shared mapper | **Fixed** (Slice 7) |
| **ARCH-002** | Architecture | `page.tsx` | Was imperative `getState()` after load | Largely improved via boolean return; keep returning structured `{ ok }` if more fields needed | Mostly mitigated |
| **IO-003** | Logic | `parseObj.ts` | `parseInt` accepts prefixes (`"12abc"`) | Full-token integer match | **Fixed** (Slice 4, 2026-07-19) |
| **LOGIC-016** | DRY | `types.ts` | `MeshFace` exported unused | Remove or use | Open |
| **LOGIC-017** | Documentation Alignment | `placeTriangle2d.ts` | `placeRootTriangleCCW` preserves stored winding | Rename | Open |
| **LOGIC-018** | Architecture | `placeTriangle2d.ts` | `Vec2 & { z }` instead of `Vec3` | Introduce `Vec3` | Open |
| **LOGIC-019** | DRY | `resolvePick.ts` | Local 3D segment distance vs `geom2d/segment2d` | Shared 3D helper if tuned together | Open |

---

## Info (known limits / acceptable PoC tradeoffs)

| ID | Files | Description |
|----|-------|-------------|
| **LOGIC-020** | `parseObj.ts`, ADR 0001 | Fan triangulation on concave n-gons — documented; UI toasts `concave_ngon` |
| **LOGIC-021** | `polygonConvexity.ts` | Degenerate normals → “not concave”; non-planar polys may miss warning |
| **LOGIC-022** | `unfoldIsland.ts` | Finiteness tested; not asserted in production post-unfold |
| **LOGIC-023** | `detectCollisions.ts`, `detectTears.ts` | Closed cube, no seams → many collisions + tears; intentional per ADR 0003 |
| **UI-006** | `page.tsx` | Was deferred mobile auto-switch to 2D — **now implemented** (`handleFlatten` → `setMobilePanel("2d")`). Reclassified from deferred Info to **shipped behavior**. |
| **APP-002-sec** | demo API route | Allowlist + disk/bundled fallback; path traversal mitigated |
| **ARCH-SoC** | `src/logic/` | Zero React/Three imports — intentional hard boundary; keep |

---

## Layout slice health check ([mobile-responsive-layout](plans/archive/mobile-responsive-layout.md))

| Expectation | QA verdict |
|-------------|------------|
| Constants + CSS tokens | **Done** — Slice 6 token sync (LAYOUT-001 fixed) |
| Hooks: media / sidebar / split / peek | Done |
| `closeIfMobile` only after successful major actions | **Correct** |
| Peek scoped `pointer-events` CSS | **Correct** |
| Desktop in-flow vs mobile overlay + backdrop | **Correct** |
| Escape + aria + tabs + separator | **Done** — Slice 6 (STATE-006, A11Y-002/003) |
| `prefers-reduced-motion` | **Correct** |
| Auto-switch to 2D after flatten | **Implemented** (UI-006) |
| Persist sidebar / split | Done — Slice 6 hydration/clamp (LAYOUT-004/008/010) |
| Toasts visible across mobile panels | **Fixed** (VIEW-005) |
| Post-Flatten mobile 3D orbit | **Fixed** (VIEW-006, Slice 6) |

---

## Quality overlay slice ([step-3-quality-overlay](plans/archive/step-3-quality-overlay.md))

| Expectation | QA verdict |
|-------------|------------|
| Toast after flatten via `qualitySummary` | **Correct** |
| Overlay in `UnfoldViewer2D`; toggle in Flatten card | **Correct** |
| Caps (50/50) with truncation hints | **Correct** (`QUALITY_OVERLAY_MAX_*`) |
| Does not set `UnfoldMeshResult.error` | **Correct** (ADR 0003) |
| Shared tier-1 collision/tear colors | **Correct** (`TIER1_COLLISION_*`, `TIER1_TEAR_*`) |
| No Zustand quality fields | **Correct** (hook-local overlay state) |

---

## ADR compliance summary

| Contract | Status |
|----------|--------|
| Packed triangulated `MeshModel`, 0-based indices | Compliant |
| `EdgeKey` seam identity | Compliant |
| Triangle-soup unfold (no `Map<VertexIndex, Vec2>`) | Compliant |
| `unfoldIsland` does not read seams | Compliant |
| XY flatten plane | Compliant |
| Quality detection orthogonal to unfold | Compliant |
| `meshLoadVersion` not bumped on seam toggles | Compliant |
| Surface degenerate/non-manifold limits to user | **Partial** — counts + I/O toasts; topology `console.warn` weak spot |
| `src/logic/` free of React/Three.js | Compliant |
| ADR docs match shipped I/O + Step 2/3 scope | **Compliant** (Slices 0–1) |

---

## What looks solid

- **SoC:** `src/logic/` provably free of React/Three; pick resolution and seam segments live in logic; Three boundary is `meshModelToGeometry` + viewer.
- **ADR 0002 discipline:** parent-soup-copy BFS; no per-vertex 2D map regression.
- **Load lifecycle:** `loadSeq`, preserve-on-failure, seam/`meshLoadVersion` invariant.
- **Defense in depth:** weld + topology skip + partition orphan skip + partial unfold warnings.
- **Quality pipeline:** orthogonal analyze pass, scale-aware tolerances, UI caps without mutating logic results.
- **Tests:** Vitest suite grew through quality overlay and remediation (33 files / 168 tests as of 2026-07-28); colocated with logic.
- **Layout extraction:** sidebar/chrome/hooks keep the shell maintainable relative to the old monolith.
- **GPU cleanup:** geometry dispose in viewport/overlay paths.

---

## Recommended fix priority

1. ~~Critical/High from 2026-07-14~~ — **Done**
2. ~~**DOC-001 / DOC-002 / DOC-003**~~ — **Done** (Slice 0, 2026-07-19)
3. ~~**TEAR-001 + LOGIC-006**~~ — **Done** (Slice 1; shared BFS walker optional)
4. ~~**LOGIC-025**~~ — **Done** (Slice 1)
5. ~~**LOGIC-007 / LOGIC-008 / LOGIC-012**~~ — **Done** (Slice 2, 2026-07-19)
6. ~~**LOGIC-011 / LOGIC-010 / LOGIC-009** (+ PERF-002)~~ — **Done** (Slice 3, 2026-07-19)
7. ~~**LOGIC-004/005/013–015 + IO-001/002/003**~~ — **Done** (Slice 4, 2026-07-19)
8. ~~**STATE-003 / ARCH-001** — scale readiness~~ — Slice 5; UI-004 Web Worker still deferred per ADR 0004
9. ~~**VIEW-006** — mobile post-Flatten orbit lock~~ — Slice 6 (2026-07-27)
10. ~~**LAYOUT-009/008/010 + A11Y-002/003**~~ — Slice 6 (2026-07-27)
11. ~~**UI-003 / UI-002 / APP-001**~~ — Slice 7 (2026-07-27)

---

## Findings count

*Updated 2026-07-28 after remediation Slices 0–7. Individual finding rows above remain the audit-time writeups; status columns note Slice fixes where applicable.*

| Severity | Open | Fixed / mitigated / deferred |
|----------|------|------------------------------|
| Critical | 0 | 1 (LOGIC-001) |
| High | 0 | 9 |
| Medium | 0 actionable open | Slices 0–7; **UI-004 deferred** (not counted as open backlog) |
| Low | **11** | See [Low](#low) table (`STATE-005`, `UI-005`, `UI-007`, `LAYOUT-005`, `VIEW-002`–`004`, `LOGIC-016`–`019`) |
| Info | 0 fixes required | PoC limits + shipped behaviors (e.g. UI-006) |
| **Open total (Low only)** | **11** | Plus optional refactors (e.g. LOGIC-006 shared BFS walker) |

---

## Category index (remaining work)

| Category | Notable IDs |
|----------|-------------|
| **Performance** | **UI-004** — deferred Web Worker flatten ([ADR 0004](decisions/0004-tech-debt-remediation-strategy.md)) |
| **DRY / polish (Low)** | LOGIC-016–019, LAYOUT-005, VIEW-003, UI-007 |
| **Logic / UX (Low)** | STATE-005, UI-005, VIEW-002, VIEW-004 |
| **Architecture** | UI-002, APP-001 — mitigated Slice 7; further card split optional |
| **SoC** | No open violations — keep `logic/` boundary |

---

*Original Staff audit refresh: 2026-07-19. Remediation complete: 2026-07-27. Re-run a full audit after major pipeline, session, or ADR changes.*
