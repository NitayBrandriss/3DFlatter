# 3DFlatter — QA Code Audit

**Date:** 2026-07-19 (Staff/Principal refresh of 2026-07-14 audit; Slice 0 ADR sync applied same day)  
**Scope:** `src/logic/`, `src/state/`, `src/ui/` (incl. `layout/`), `src/viewer/`, `app/`, `docs/decisions/`, `docs/plans/`  
**Method:** Deep static review against ADRs 0001–0003, AGENTS.md, plans hub + archives (incl. quality overlay + mobile layout), prior audit IDs. Code read + grep SoC verification + `npm test` / `npm run lint`. **No application code changes** — this file only.  
**Test baseline:** `npm test` — **29 files, 138 tests, all passing** (was 28 / 122 on 2026-07-14).  
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

**2026-07-19 focus:** ADR validity + doc drift, SoC, DRY, performance, and edge-case logic. ADRs 0001–0003 are still the right foundation; the main gaps are **documentation lag** (STL, shipped Step 2+ features, tear-kind taxonomy vs code) and a **Medium backlog** (BFS/helper duplication, flatten on UI thread, seam-toggle repartition, collision double-clip). No new Critical/High geometry defects found.

**Resolved since last audit:** STATE-004 (failed load no longer bumps `meshLoadVersion`), VIEW-005 (toasts are page-level, not buried in the 3D panel), UI-006 (mobile now auto-switches to 2D after successful flatten).

---

## Changes since 2026-07-14

| Status | Notes |
|--------|--------|
| **Resolved** | STATE-004, VIEW-005; UI-006 implemented; DOC-001/002/003 (Slice 0); **TEAR-001, LOGIC-025, LOGIC-006 assert** (Slice 1); **LOGIC-007, LOGIC-008, LOGIC-012** (Slice 2); **LOGIC-009, LOGIC-010, LOGIC-011, PERF-002** (Slice 3) |
| **New Medium** | TEAR-001, LOGIC-025, DOC-001, DOC-003, ARCH-003 |
| **New Low** | DOC-002 (PERF-002 fixed Slice 3) |
| **Reconfirmed open** | LOGIC-004–006/013–015, STATE-003/006, UI-001–004/008, LAYOUT-*, A11Y-002/003, IO-001/002, ARCH-001, VIEW-001, APP-001 |
| **Baseline** | Tests +16; quality overlay slice shipped (`qualitySummary.ts`, overlay caps, Flatten-card toggle) |

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
| Surface degenerate/non-manifold to user | **Partial** — I/O toasts + sidebar counts; topology skip still `console.warn` (LOGIC-005) |
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

- Broad `useShallow` of whole `session` + `computeSessionStats` → full `partitionIslands` on every seam toggle (ARCH-001, STATE-003). Fine for PoC meshes; will hurt at scale.
- Dual ownership of “pattern validity” (session seams vs flatten snapshot) is intentional but easy to misuse when adding derived flags — keep documenting the version contract.
- **Suggestion (optional, ask first):** a thin `useFlattenStore` or session selectors (`meshIdentity` vs `seams`) if flatten/export/overlay keep growing. Do **not** collapse everything into one god store.

### Separation of concerns

| Layer | Verdict |
|-------|---------|
| `src/logic/` | **Clean** — pure geometry/I/O; no React/Three |
| `src/viewer/` | Correct Three/R3F boundary; pick math delegated to `resolvePick`; display normalization stays out of topology |
| `src/state/` | Thin orchestration over logic; appropriate |
| `src/ui/` | Mostly thin; `AppSidebar` prop surface and `page.tsx` orchestration remain the main maintainability costs (UI-002, APP-001) |
| `app/` | Routes + demo API; APP-002 still notes demo catalog living under `ui/` |

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
| **Files** | `app/page.tsx`, `src/ui/useFlattenExport.ts`, `src/state/meshSessionStore.ts` |
| **Description** | Session (Zustand) and flatten snapshot (hook) are correctly version-gated, but the page still selects the entire session and re-derives expensive stats. As features accrete (quality overlay already did), the orchestrator becomes the bottleneck rather than the store design itself. |
| **Suggested fix** | Split Zustand selectors (mesh identity vs seams); memoize islands by seams content hash; keep flatten local unless remount survival becomes a requirement. |

### LOGIC-004 — Topology degeneracy check is index-only, not geometric

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Category** | Logic |
| **Files** | `src/logic/mesh/buildTopology.ts`, `faceDegeneracy.ts` |
| **Description** | Only duplicate **indices** are degenerate. Collinear / zero-area triangles with three distinct indices pass into unfold. **Documented as ADR 0001 v1 out-of-scope** (Slice 0). |
| **Suggested fix** | Optional geometric test at import/topology (would require ADR amend). Doc portion done. |

### LOGIC-005 — Degenerate-face skip uses `console.warn`, not structured warnings

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Category** | Logic / Documentation Alignment |
| **Files** | `src/logic/mesh/buildTopology.ts` |
| **Description** | AGENTS.md: surface degenerate issues to users. Topology skip logs to console; UI shows count but load path does not toast like OBJ/STL warnings. Pure logic should not call `console.warn`. |
| **Suggested fix** | Return warnings from `buildTopology` (or filter at I/O) and thread through session toasts. |

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
| **Files** | `src/logic/io/stl/parseStl.ts` (`verticesEqual`) |
| **Description** | Exact `===` misses near-coincident corners within weld epsilon. |
| **Suggested fix** | Epsilon compare aligned with `weldVertices` / `SAT_EPS`. |

### LOGIC-014 — Seam segment export silently drops missing geometry

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Category** | Logic |
| **Files** | `src/logic/unfold/seamSegments2d.ts` |
| **Description** | Missing incidents / placement / corners → `continue` with no warning. |
| **Suggested fix** | Structured skipped-seam diagnostics. |

### LOGIC-015 — `listSeamSegments2d` does not validate seam eligibility

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Category** | Logic |
| **Files** | `seamSegments2d.ts`, `edgeEligibility.ts` |
| **Description** | Any key in `seams.seams` is drawn; stale/boundary/non-manifold keys yield silent empties. |
| **Suggested fix** | Filter via `canSelectAsSeam` or `incidents.length === 2`. |

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
| **Files** | `meshSessionStore.ts` (`computeSessionStats`), `app/page.tsx` |
| **Description** | `useMemo([session])` + new session object on each toggle → `partitionIslands` every pick. |
| **Suggested fix** | Memoize on seams hash; or cheap counters vs full partition. |

### STATE-006 — Escape key collapses sidebar on desktop

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Category** | Logic / UX |
| **Files** | `src/ui/layout/useSidebarState.ts` |
| **Description** | Escape closes whenever open, including desktop in-flow sidebar. |
| **Suggested fix** | Gate with `!isDesktop` / overlay-only (product decision). |

### UI-001 — Duplicated post-load scale reset

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Category** | DRY |
| **Files** | `app/page.tsx` (`onPickFile`, `onLoadDemo`) |
| **Description** | Both paths `setModelScale(1)` then `loadMeshFile`. Success plumbing improved; scale reset still duplicated. |
| **Suggested fix** | Single `loadMeshFromFile` helper that resets view prefs. |

### UI-002 — `AppSidebar` prop drilling (~40 props)

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Category** | Architecture |
| **Files** | `app/page.tsx`, `AppSidebar.tsx` |
| **Description** | God-component wiring; new controls touch multiple files. |
| **Suggested fix** | Sidebar context or card components reading store/hooks. |

### UI-003 — 2D preview duplicates export SVG structure

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Category** | DRY |
| **Files** | `UnfoldViewer2D.tsx`, `tier1Preview.ts` |
| **Description** | React viewer mirrors tier-1 preview; colors shared, structure can still drift. Quality markers added in both places carefully — still duplicated render paths. |
| **Suggested fix** | Shared preview content builder or component. |

### UI-004 — Synchronous flatten blocks UI thread

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Category** | Performance |
| **Files** | `src/ui/useFlattenExport.ts` |
| **Description** | `unfoldMesh` (+ quality) runs sync in `try/finally`. Loading overlay covers parse only. |
| **Suggested fix** | Worker, chunked yield, or explicit flatten progress UI. |

### UI-008 — 2D viewer always shows seams; export has toggle

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Category** | Logic / UX |
| **Files** | `UnfoldViewer2D.tsx`, `useFlattenExport.ts` |
| **Description** | Preview always maps `seamSegments`; export respects `includeSeamsInExport`. |
| **Suggested fix** | Share the flag in the viewer. |

### LAYOUT-001 — Layout constants duplicated in TS and CSS

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Category** | DRY |
| **Files** | `src/ui/layout/constants.ts`, `app/globals.css` |
| **Description** | Breakpoint / widths / split values duplicated; `--layout-breakpoint` unused by `@media`. |
| **Suggested fix** | Single source of truth. |

### LAYOUT-002 — Stale `containerHeight` for split aria max

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Category** | Logic |
| **Files** | `useResizableSplit.ts` |
| **Description** | Height read during render without `ResizeObserver`. |
| **Suggested fix** | Subscribe to container resize. |

### LAYOUT-004 — SSR/hydration sidebar flash

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Category** | Logic |
| **Files** | `useMediaQuery.ts`, `useSidebarState.ts` |
| **Description** | SSR desktop default → mobile hydrate can flash open→closed; storage in `useState` init worsens mismatch. |
| **Suggested fix** | Mobile-first SSR default; defer storage to `useEffect`. |

### LAYOUT-008 — Stored split height not clamped on init

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Category** | Logic |
| **Files** | `useResizableSplit.ts`, `readLayoutStorage.ts` |
| **Description** | Corrupt/huge storage applies until drag. |
| **Suggested fix** | Clamp once container is measurable. |

### LAYOUT-009 — Peek `setPointerCapture` may starve range slider

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Category** | Logic |
| **Files** | `usePeekThrough.ts`, `PeekThroughControl.tsx` |
| **Description** | Wrapper capture can retarget moves away from `<input type="range">` mid-drag. |
| **Suggested fix** | Capture on the range, or skip capture + rely on CSS/`lostpointercapture`. |

### LAYOUT-010 — Layout storage read during `useState` init

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Category** | Logic |
| **Files** | `readLayoutStorage.ts`, layout hooks |
| **Description** | Feeds hydration mismatch (LAYOUT-004/008). |
| **Suggested fix** | Read storage after mount; clamp split after measure. |

### A11Y-002 — Mobile tabs lack keyboard tab pattern

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Category** | Logic / a11y |
| **Files** | `ViewportChrome.tsx` |
| **Description** | Roles present; missing ArrowLeft/Right + roving tabindex. |
| **Suggested fix** | WAI-ARIA tabs keyboard pattern. |

### A11Y-003 — Split separator not keyboard-resizable

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Category** | Logic / a11y |
| **Files** | `ViewportChrome.tsx`, `useResizableSplit.ts` |
| **Description** | `role="separator"` + aria values without ArrowUp/Down. |
| **Suggested fix** | Key adjust + clamp + persist. |

### IO-001 — STL format heuristic can prefer binary over ASCII

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Category** | Logic |
| **Files** | `parseStl.ts` (`detectStlFormat`) |
| **Description** | `solid…` + binary-sized length → `"binary"`. Edge-case ASCII can mis-parse. |
| **Suggested fix** | Prefer ASCII when `looksLikeAsciiStl` unless binary unmistakable; ASCII fallback on empty/failed binary. |

### IO-002 — No max file / triangle budget on client load

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Category** | Performance / Logic |
| **Files** | `parseStl.ts`, `meshSessionStore.ts` |
| **Description** | No soft max bytes/faces → freeze/OOM risk. |
| **Suggested fix** | Soft limits + clear user error before allocate/decode. |

### VIEW-001 — PickableMesh drag guard can leave stale pointer state

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Category** | Logic |
| **Files** | `PickableMesh.tsx` |
| **Description** | Clears `pointerDown` only on mesh `pointerUp`; cancel/leave/lost capture can leave stale state. |
| **Suggested fix** | `onPointerCancel` / leave / document `pointerup` cleanup. |

### APP-001 — `page.tsx` is a large orchestrator

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Category** | Architecture |
| **Files** | `app/page.tsx` |
| **Description** | Wires store, flatten, viewport prefs, demo, layout, both viewports. Improved vs pre-layout monolith; still hard to test. |
| **Suggested fix** | `HomePageShell`, `useViewportPreferences`, `useDemoLoader`. |

### ARCH-001 — Broad Zustand selector re-renders entire page on seam toggle

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Category** | Performance / Architecture |
| **Files** | `app/page.tsx` |
| **Description** | Wholesale `session` selection invalidates sidebar/chrome/overlays on every seam pick. |
| **Suggested fix** | Split selectors: mesh-only vs seams/stats. |

---

## Low

| ID | Category | Files | Description | Suggested fix | Status |
|----|----------|-------|-------------|---------------|--------|
| **PERF-002** *(new)* | Performance | `spatialGrid.ts` | Per-call rebuild of index map + string-keyed `seen` (`${lo},${hi}`) on dense meshes | Index by soup position; numeric pair keys | **Fixed** (Slice 3, 2026-07-19) — soup-index array + `lo * stride + hi` |
| **DOC-002** *(new)* | Documentation Alignment | ADR 0002 | “Deferred to Step 2+” lists shipped features | Mark superseded / point at plans + ADR 0003 | **Fixed** (Slice 0, 2026-07-19) |
| **STATE-005** | Logic | `meshSessionStore.ts` | Undocumented double `rAF` before parse | Worker / `startTransition` / document intent | Open |
| **UI-005** | Logic | `ToastStack.tsx` | `ToastItem` effect depends on `onDismiss` | Stable ref or omit from deps | Open |
| **UI-007** | DRY | `AppSidebar.tsx` | Redundant nested `stats ?` / `session ?` | Simplify | Open |
| **LAYOUT-005** | DRY | `ViewportChrome.tsx` | Dead re-export `SPLIT_2D_MIN` | Remove | Open |
| **LAYOUT-006** | Performance | `usePeekThrough.ts` | Bind object new every render | Memoize | Open |
| **LAYOUT-007** | Architecture | `page.tsx` | Mobile backdrop in page; sidebar in hook | Move into shell/sidebar | Open |
| **VIEW-002** | Logic | `MeshViewport.tsx` | Camera refit may miss control target first frame | `useLayoutEffect` / ref callback | Open |
| **VIEW-003** | DRY | `MeshViewport.tsx` | Empty vs loaded OrbitControls diverge | Share config | Open |
| **VIEW-004** | Logic | `SeamOverlay.tsx` | `linewidth={2}` ignored on most WebGL | Document or mesh-line | Open |
| **VIEW-005** | Logic | `page.tsx` | Toasts were inside `viewport3d` (hidden on mobile 2D tab) | **Fixed** — `ToastStack` is now a page sibling of `ViewportChrome` | **Fixed** |
| **APP-002** | Architecture | demo API, `demoModels.ts` | API imports catalog from `src/ui/` | Move to `src/data/` or `src/config/` | Open |
| **APP-003** | DRY | `page.tsx`, API | Demo error strings partially duplicated | Shared mapper | Open |
| **ARCH-002** | Architecture | `page.tsx` | Was imperative `getState()` after load | Largely improved via boolean return; keep returning structured `{ ok }` if more fields needed | Mostly mitigated |
| **IO-003** | Logic | `parseObj.ts` | `parseInt` accepts prefixes (`"12abc"`) | Full-token integer match | Open |
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
| Constants + CSS tokens | Done; values still duplicated (LAYOUT-001) |
| Hooks: media / sidebar / split / peek | Done |
| `closeIfMobile` only after successful major actions | **Correct** |
| Peek scoped `pointer-events` CSS | **Correct** |
| Desktop in-flow vs mobile overlay + backdrop | **Correct** |
| Escape + aria + tabs + separator | Mostly done; keyboard gaps (A11Y-002/003); Escape on desktop (STATE-006) |
| `prefers-reduced-motion` | **Correct** |
| Auto-switch to 2D after flatten | **Now implemented** (UI-006) |
| Persist sidebar / split | Done; init unclamped + hydration-hostile (LAYOUT-004/008/010) |
| Toasts visible across mobile panels | **Fixed** (VIEW-005) |

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
- **Tests:** 138 passing, colocated; grew with quality overlay / summary helpers.
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
7. **STATE-003 / ARCH-001 / IO-002** — scale readiness (repartition, selectors, file budgets); UI-004 Web Worker deferred per ADR 0004
8. **LAYOUT-009/008/010 + A11Y-002/003** — layout hardening + keyboard a11y
9. **UI-003 / UI-002 / APP-001** — preview/export DRY and orchestrator slim-down

---

## Findings count

| Severity | Open | Fixed / mitigated (tracked) |
|----------|------|------------------------------|
| Critical | 0 | 1 (LOGIC-001) |
| High | 0 | 9 |
| Medium | ~27 | + DOC-001/003; LOGIC-007–012 (Slices 2–3) |
| Low | ~16 | + DOC-002 fixed; STATE-004, VIEW-005; PERF-002 (Slice 3) |
| Info | 7 | UI-006 now shipped behavior |
| **Open total** | **~50** | — |

*Counts approximate after Slices 0–3.*

---

## Category index (open items)

| Category | Notable IDs |
|----------|-------------|
| **Architecture** | ARCH-001, ARCH-003, UI-002, APP-001, APP-002, LAYOUT-007 |
| **Documentation Alignment** | LOGIC-005, LOGIC-017 — DOC-*/TEAR-001 addressed Slices 0–1 |
| **DRY** | LOGIC-006 (BFS walker optional), UI-001, UI-003, LAYOUT-001, LOGIC-016/019 |
| **Logic** | LOGIC-004/005/013–015, STATE-006, LAYOUT-*, VIEW-001, IO-001/003, A11Y-* |
| **Performance** | STATE-003, UI-004, IO-002, ARCH-001 |
| **SoC** | No open violations — keep `logic/` boundary |

---

*This document is a point-in-time Staff audit (refreshed 2026-07-19). Re-run after major pipeline, session, ADR, or layout changes.*
