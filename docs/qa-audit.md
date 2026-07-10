# 3DFlatter — QA Code Audit

**Date:** 2026-07-10  
**Scope:** `src/logic/`, `src/state/`, `src/ui/`, `src/viewer/`, `app/`  
**Method:** Static review against ADRs 0001–0003, AGENTS.md boundaries, DRY/maintainability, and UX correctness. No code changes.  
**Test baseline:** `npm test` — 27 files, 116 tests, all passing.

---

## Severity scale

| Level | Meaning |
|-------|---------|
| **Critical** | Data loss, wrong geometry output, or broken core workflow for real inputs |
| **High** | Significant UX bug, race condition, or stuck UI state |
| **Medium** | Performance, maintainability, or inconsistent behavior under common use |
| **Low** | Minor polish, dead code, or fragile patterns unlikely to bite soon |
| **Info** | Documented PoC limits or acceptable tradeoffs |

---

## Executive summary

The pipeline architecture is sound: triangle-soup unfold (ADR 0002), `EdgeKey` seam identity, and logic/viewer separation are respected. **116 unit tests pass**, and core contracts are well tested in `src/logic/`.

The highest-risk gaps cluster around **degenerate-face lifecycle** (orphan faces in `MeshModel` can fail an entire flatten), **state/UI coupling** (flatten result clears on every seam toggle; no load race guard), and **duplicated unfold BFS logic** (tear detection can drift from unfold). Layout/responsive code has a **stuck resize state** bug and duplicated breakpoint constants between TS and CSS.

---

## Critical

### LOGIC-001 — Orphan degenerate faces can break entire mesh unfold

| Field | Detail |
|-------|--------|
| **Severity** | Critical |
| **Files** | `src/logic/mesh/buildTopology.ts`, `src/logic/mesh/partitionIslands.ts`, `src/logic/unfold/unfoldMesh.ts`, `src/logic/io/stl/parseStl.ts` |
| **Description** | `buildTopology` skips index-degenerate faces (duplicate vertex indices) but **leaves them in `MeshModel.faces`**. They have no adjacency, so `partitionIslands` puts each in its own 1-face island. `unfoldMesh` aborts on the **first** failed island and returns a global `error`, discarding all valid islands. STL import can produce this: one degenerate triangle + cube yields `faceCount === 13` with `skippedDegenerateFaceCount === 1` (`parseStl.test.ts`), but there is no unfold test for that scenario. |
| **Suggested fix** | Filter degenerate faces at import (with warnings), or exclude topology orphans during partition/unfold. Return per-island errors instead of failing the whole mesh. |

---

## High

### STATE-001 — No load-generation guard on async mesh load

| Field | Detail |
|-------|--------|
| **Severity** | High |
| **Files** | `src/state/meshSessionStore.ts` (`loadMeshFile`, L108–163) |
| **Description** | Rapid successive file picks (upload + demo overlap) can resolve out of order. An older `await` may overwrite a newer load because there is no monotonic `loadId` or `AbortController`. |
| **Suggested fix** | Increment a load token at start; ignore stale completions before `set()`. Optionally return `{ ok, error }` from `loadMeshFile`. |

### STATE-002 — Flatten result clears on every seam toggle

| Field | Detail |
|-------|--------|
| **Severity** | High |
| **Files** | `src/ui/useFlattenExport.ts` (L15–17), `src/state/meshSessionStore.ts` (`toggleSeamAt`, L178–181) |
| **Description** | `useFlattenExport` resets flatten via `useEffect(..., [session])`. Seam toggles replace the whole `session` object (`{ ...session, seams }`), so **every seam click clears the 2D result** even though mesh/topology are unchanged. Users must re-flatten after each seam edit. |
| **Suggested fix** | Key the effect on `session.mesh` + `meshLoadVersion` (or a stable mesh fingerprint), not the full session reference. |

### LOGIC-002 — `unfoldMesh` all-or-nothing error handling

| Field | Detail |
|-------|--------|
| **Severity** | High |
| **Files** | `src/logic/unfold/unfoldMesh.ts` (L21–31) |
| **Description** | One bad island (degenerate face, disconnected component, hinge failure) fails the entire flatten. Valid islands are discarded. Conflicts with ADR 0003 spirit of “detect and report” at the orchestration layer. |
| **Suggested fix** | Unfold islands independently; return partial `islands` plus structured per-island warnings. |

### LAYOUT-003 — Stuck resize state when container ref is null

| Field | Detail |
|-------|--------|
| **Severity** | High |
| **Files** | `src/ui/layout/useResizableSplit.ts` (L28–34) |
| **Description** | `setIsDragging(true)` and `document.body.classList.add("is-resizing")` run **before** container validation. If `containerRef.current` is null, early `return` leaves dragging/body class set with no pointer listeners — stuck resize cursor and selection lock. |
| **Suggested fix** | Validate container first, or clean up dragging/body class in the early-return path. |

### LOGIC-003 — Welding can create index-degenerate faces with no post-check

| Field | Detail |
|-------|--------|
| **Severity** | High |
| **Files** | `src/logic/mesh/weldVertices.ts`, `src/logic/io/obj/parseObj.ts`, `src/logic/io/stl/parseStl.ts` |
| **Description** | `weldVertices` remaps indices but never validates resulting triangles. Coincident corners that merge to the same index produce faces like `(0,0,0)` that survive into `MeshModel` and are only caught later in `buildTopology` (as orphans per LOGIC-001). |
| **Suggested fix** | After welding, drop or flag faces where `v0===v1 || v1===v2 || v2===v0`; surface as load warnings. |

---

## Medium

### LOGIC-004 — Topology degeneracy check is index-only, not geometric

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Files** | `src/logic/mesh/buildTopology.ts` (L13–15) |
| **Description** | Only duplicate **indices** are degenerate. Collinear / zero-area triangles with three distinct indices pass through topology and into unfold, potentially producing zero-area 2D soup or skewed hinges. |
| **Suggested fix** | Optional geometric degeneracy test (edge length or area threshold) at topology build or import. |

### LOGIC-005 — Degenerate-face skip uses `console.warn`, not structured warnings

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Files** | `src/logic/mesh/buildTopology.ts` (L63–66) |
| **Description** | ADR 0001 / AGENTS.md say degenerate issues should be user-visible. Topology skip only logs to console. UI shows `skippedDegenerateFaceCount` in sidebar, but load path does not emit a structured warning like OBJ `concave_ngon` or STL `degenerate_triangle`. Pure logic should not call `console.warn`. |
| **Suggested fix** | Return warnings from `buildTopology` (or filter at I/O) and thread through session state. |

### LOGIC-006 — Duplicated BFS tree vs `unfoldIsland` (tear-detection drift risk)

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Files** | `src/logic/unfold/buildUnfoldTreeEdges.ts`, `src/logic/unfold/unfoldIsland.ts`, `src/logic/unfold/analyzeUnfoldedIsland.ts` |
| **Description** | Tear detection depends on `buildUnfoldTreeEdges` mirroring `unfoldIsland` BFS exactly (ADR 0003 W2). Logic is duplicated (`EDGE_SLOTS`, queue walk, slot order). Tests assert tree size but **production has no runtime assertion**; drift would misclassify tree vs non-tree tears. |
| **Suggested fix** | Extract shared BFS walker, or assert `treeEdges.size === islandFaces.length - 1` when unfold succeeded. |

### LOGIC-007 — Duplicated face/edge helpers (DRY)

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Files** | `src/logic/unfold/unfoldIsland.ts`, `src/logic/unfold/buildUnfoldTreeEdges.ts`, `src/logic/unfold/soupBounds.ts`, `src/logic/mesh/partitionIslands.ts` |
| **Description** | `faceVertices` / `readFaceVertices`, `directedEdgeForSlot`, `edgeKeyForFace`, and corner lookup helpers are near-copies across modules. Increases risk of subtle slot-order bugs. |
| **Suggested fix** | Centralize in `src/logic/mesh/` (e.g. `faceUtils.ts`) beside `edgeKey.ts`. |

### LOGIC-008 — `parseEdgeKey` duplicated in three modules

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Files** | `src/logic/seams/displaySeamSegments.ts`, `src/logic/unfold/seamSegments2d.ts`, `src/logic/unfold/detectTears.ts` (L72–74) |
| **Description** | Edge key parsing is reimplemented instead of living beside `makeEdgeKey` in `edgeKey.ts`. `detectTears` uses `.split(",").map(Number)` inline while others define a local `parseEdgeKey`. |
| **Suggested fix** | Add `parseEdgeKey(key: EdgeKey): [VertexIndex, VertexIndex]` to `mesh/edgeKey.ts`. |

### LOGIC-009 — `detectTears` scans entire mesh edge map per island

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Files** | `src/logic/unfold/detectTears.ts` (L56–90) |
| **Description** | Iterates all `topology.edgeToFaces` entries and filters by `islandSet`. For large meshes with small islands this is O(mesh edges) per island. |
| **Suggested fix** | Build island edge list once from incident faces. |

### LOGIC-010 — `segment2dForFaceSlot` uses O(n) `indexOf` in hot paths

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Files** | `src/logic/unfold/unfoldEdge2d.ts` |
| **Description** | Called per edge pair in collision/tear detection. `result.faces.indexOf(faceId)` is linear per call. |
| **Suggested fix** | Build `Map<FaceIndex, soupIndex>` once per island analysis (same pattern as `unfoldIsland`'s `faceToSoupIndex`). |

### LOGIC-011 — Double triangle clipping in collision detection

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Files** | `src/logic/unfold/detectCollisions.ts`, `src/logic/geom2d/triangle2d.ts` |
| **Description** | `clipTriangleIntersection` and `clipTriangleArea` both run full Sutherland–Hodgman clipping; area path may re-clip internally. |
| **Suggested fix** | Compute intersection polygon once; derive area from that. |

### LOGIC-012 — Tolerance constants fragmented

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Files** | `src/logic/geom2d/tolerances.ts`, `src/logic/mesh/weldVertices.ts`, `src/logic/io/obj/polygonConvexity.ts`, `src/logic/seams/resolvePick.ts` |
| **Description** | `WELD_EPSILON`, polygon convexity `EPS`, and pick threshold `0.15` are separate from central `tolerances.ts`. Weld/pick/convexity do not reference documented `SAT_EPS`. |
| **Suggested fix** | Document and centralize weld epsilon and pick distance ratio in `tolerances.ts`. |

### LOGIC-013 — STL degenerate detection uses exact float equality

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Files** | `src/logic/io/stl/parseStl.ts` |
| **Description** | `verticesEqual` uses `===`. Near-coincident vertices within weld epsilon won't emit `degenerate_triangle` warnings but may cause bad topology after weld. |
| **Suggested fix** | Use epsilon-based comparison consistent with `weldVertices` / `SAT_EPS`. |

### LOGIC-014 — Seam segment export silently drops missing geometry

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Files** | `src/logic/unfold/seamSegments2d.ts` |
| **Description** | Missing topology incidents, face placement, or corner lookups `continue` with no warning. User can have seams in registry but fewer (or zero) 2D seam segments in export. |
| **Suggested fix** | Return skipped-seam diagnostics or structured warnings when a seam key cannot be resolved. |

### LOGIC-015 — `listSeamSegments2d` does not validate seam eligibility

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Files** | `src/logic/unfold/seamSegments2d.ts`, `src/logic/seams/edgeEligibility.ts` |
| **Description** | Export draws segments for any key in `seams.seams`, including stale or boundary/non-manifold edges if ever stored. |
| **Suggested fix** | Filter through `canSelectAsSeam` or require `incidents.length === 2`. |

### STATE-003 — Full island re-partition on every seam toggle

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Files** | `src/state/meshSessionStore.ts` (`computeSessionStats`), `app/page.tsx` (L52) |
| **Description** | `computeSessionStats` calls `partitionIslands` on every seam toggle because `page.tsx` memoizes on `session`. Large meshes will re-partition on each pick for sidebar stats. |
| **Suggested fix** | Memoize islands on seams content hash; or split cheap counters from full partition. |

### STATE-006 — Escape key collapses sidebar on desktop

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Files** | `src/ui/layout/useSidebarState.ts` |
| **Description** | Escape always calls `persistOverride(false)` when `sidebarOpen`, including on desktop — may collapse an open sidebar the user did not expect to be “dismissible.” |
| **Suggested fix** | Gate Escape with `!isDesktop` or only in drawer overlay mode. |

### UI-001 — Duplicated post-load success check

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Files** | `app/page.tsx` (`onPickFile`, `onLoadDemo`) |
| **Description** | Both paths duplicate: `setModelScale(1)` + `loadMeshFile` + `getState()` + `session !== null && error === null`. |
| **Suggested fix** | Extract `loadMeshFromFile(file): Promise<boolean>` helper. |

### UI-002 — `AppSidebar` prop drilling (~40 props)

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Files** | `app/page.tsx`, `src/ui/layout/AppSidebar.tsx` |
| **Description** | God-component wiring; any new control touches multiple files. |
| **Suggested fix** | Sidebar context or smaller cards (`FileCard`, `SeamCard`) reading from store/hooks. |

### UI-003 — 2D preview duplicates export SVG structure

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Files** | `src/ui/UnfoldViewer2D.tsx`, `src/logic/export/svg/tier1Preview.ts` |
| **Description** | React viewer manually renders polygons/lines mirroring `buildTier1PreviewContent`. Comment in `tier1Preview.ts` explicitly says “matching UnfoldViewer2D.” Styles/structure can drift from export. |
| **Suggested fix** | Shared `Tier1PreviewSvg` component or reuse `buildTier1PreviewContent` output. |

### UI-004 — Synchronous flatten blocks UI thread

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Files** | `src/ui/useFlattenExport.ts` (`onFlatten`) |
| **Description** | `unfoldMesh` runs synchronously inside `try/finally`. Large meshes freeze the viewport; loading overlay covers parse only, not flatten. |
| **Suggested fix** | Web Worker, `startTransition`, or explicit progress UI. |

### UI-006 — Mobile flatten does not switch to 2D panel

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Files** | `app/page.tsx`, `src/ui/layout/AppSidebar.tsx` |
| **Description** | Mobile flatten succeeds but `mobilePanel` stays `"3d"`. User must manually switch tabs to see the pattern. |
| **Suggested fix** | On successful flatten + `!isDesktop`, call `setMobilePanel("2d")`. |

### UI-008 — 2D viewer always shows seams; export has toggle

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Files** | `src/ui/UnfoldViewer2D.tsx`, `src/ui/useFlattenExport.ts` |
| **Description** | Preview always renders seam overlay; export respects `includeSeamsInExport`. Preview and export can disagree. |
| **Suggested fix** | Share the same flag in the viewer. |

### LAYOUT-001 — Layout constants duplicated in TS and CSS

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Files** | `src/ui/layout/constants.ts`, `app/globals.css` |
| **Description** | Breakpoint `769`, sidebar widths `360/80`, split `280/140/0.6` exist in both TS constants and CSS custom properties / media queries. Drift risk. |
| **Suggested fix** | Single source of truth — generate CSS vars from TS or read vars in hooks. |

### LAYOUT-002 — Stale `containerHeight` for split aria max

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Files** | `src/ui/layout/useResizableSplit.ts` (L66–67) |
| **Description** | `containerHeight` read during render from `containerRef.current` is stale (no `ResizeObserver`); `aria-valuemax` wrong after viewport resize until drag. |
| **Suggested fix** | Subscribe to `ResizeObserver` on `containerRef`. |

### LAYOUT-004 — SSR/hydration sidebar flash

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Files** | `src/ui/layout/useMediaQuery.ts`, `src/ui/layout/useSidebarState.ts` |
| **Description** | SSR `getServerSnapshot` returns `true` (desktop); mobile hydrates to `isDesktop === false`. `sidebarOpen = userOverride ?? isDesktop` can flash open→closed on first paint. |
| **Suggested fix** | Mobile-first SSR default, or suppress transition until hydrated. |

### LAYOUT-008 — Stored split height not clamped on init

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Files** | `src/ui/layout/useResizableSplit.ts`, `src/ui/layout/readLayoutStorage.ts` |
| **Description** | Corrupt/huge localStorage values apply until user drags. |
| **Suggested fix** | Clamp `readStoredNumber` result with `clampSplitHeight` once container is measurable. |

### VIEW-001 — PickableMesh drag guard can leave stale pointer state

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Files** | `src/viewer/PickableMesh.tsx` |
| **Description** | Drag guard only clears `pointerDown` on `pointerUp` on the mesh. Pointer leaving canvas / `pointercancel` / lost capture can leave stale `pointerDown`, so a later click may be treated as a short click. |
| **Suggested fix** | Add `onPointerCancel`, `onPointerLeave`, or document-level `pointerup` cleanup. |

### APP-001 — `page.tsx` is a large orchestrator

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Files** | `app/page.tsx` |
| **Description** | ~200+ lines wiring Zustand, flatten export, viewport prefs, demo fetch, layout hooks, backdrop, and both viewports. Hard to test and reason about. |
| **Suggested fix** | Split into `HomePageShell`, `useViewportPreferences`, `useDemoLoader`. |

### ARCH-001 — Broad Zustand selector re-renders entire page on seam toggle

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Files** | `app/page.tsx` (L35–50) |
| **Description** | `useShallow` selects `session` wholesale; seam toggles re-render sidebar, chrome, and overlays. Necessary for stats but over-invalidates unrelated UI. |
| **Suggested fix** | Split selectors: mesh-only subtree vs seams/stats. |

---

## Low

| ID | Files | Description | Suggested fix |
|----|-------|-------------|---------------|
| **STATE-004** | `meshSessionStore.ts` | Failed loads still bump `meshLoadVersion`, forcing Canvas remount with no mesh change | Only increment on successful load/clear |
| **STATE-005** | `meshSessionStore.ts` L110–111 | Double `requestAnimationFrame` before parse is undocumented; may not prevent jank on large files | Worker, `startTransition`, or document intent |
| **UI-005** | `ToastStack.tsx` | `ToastItem` effect depends on `onDismiss`; unstable callback would reset timers | Stable ref or omit from deps |
| **UI-007** | `AppSidebar.tsx` | `stats ?` nested inside `session ?` is redundant | Simplify conditionals |
| **LAYOUT-005** | `ViewportChrome.tsx` | Dead re-export `SPLIT_2D_MIN` (“for aria in parent if needed”) | Remove or wire up |
| **LAYOUT-006** | `usePeekThrough.ts` | `usePeekThroughBind` returns new handler object every render | `useMemo` bind object |
| **LAYOUT-007** | `app/page.tsx` | Mobile backdrop lives in page; sidebar state in hook | Move into `AppSidebar` or shell |
| **VIEW-002** | `MeshViewport.tsx` | Camera refit may miss control target on first frame | `useLayoutEffect` or refit in ref callback |
| **VIEW-003** | `MeshViewport.tsx` | Empty vs loaded scene use different OrbitControls config | Share one controls config |
| **VIEW-004** | `SeamOverlay.tsx` | `linewidth={2}` ignored on most WebGL platforms | Document or use mesh-line |
| **APP-002** | `app/api/demo-models/`, `demoModels.ts` | API route imports catalog from `src/ui/` | Move to `src/data/` or `src/config/` |
| **APP-003** | `app/page.tsx`, API route | Demo error strings partially duplicated | Single error-mapping helper |
| **ARCH-002** | `app/page.tsx` | Imperative `getState()` after `await` instead of return value from `loadMeshFile` | Return `{ ok, error }` from loader |
| **LOGIC-016** | `mesh/types.ts` | `MeshFace` interface exported but unused | Remove or use |
| **LOGIC-017** | `unfold/placeTriangle2d.ts` | `placeRootTriangleCCW` name implies forced CCW; preserves stored winding | Rename to `placeRootTriangle` |
| **LOGIC-018** | `unfold/placeTriangle2d.ts` | `readVertex3d` returns `Vec2 & { z: number }` | Introduce `Vec3` type |
| **LOGIC-019** | `seams/resolvePick.ts` | Local 3D `pointToSegmentDistanceSq` parallels `geom2d/segment2d.ts` | Shared 3D segment helper if tuned together |

---

## Info (known limits / acceptable PoC tradeoffs)

| ID | Files | Description |
|----|-------|-------------|
| **LOGIC-020** | `io/obj/parseObj.ts`, ADR 0001 | Fan triangulation on concave n-gons is documented risk; ensure UI always surfaces `concave_ngon` warnings |
| **LOGIC-021** | `io/obj/polygonConvexity.ts` | Degenerate normals return “not concave”; severely non-planar polygons get no concave warning |
| **LOGIC-022** | `unfold/unfoldIsland.ts` | Finiteness of `positions2d` tested but not asserted post-unfold in production |
| **LOGIC-023** | `detectCollisions.ts`, `detectTears.ts` | Closed cube with no seams reports many collisions + tears; intentional per ADR 0003 |

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
| Surface degenerate/non-manifold limits to user | **Partial** — counts in UI; console.warn and orphan faces are weak spots |
| `src/logic/` free of React/Three.js | Compliant |

---

## What looks solid

- **Test coverage:** 116 logic tests across topology, I/O, unfold, quality detection, export, and layout clamping.
- **Layer boundaries:** `displayNormalization.ts` stays Three.js-free; pick/overlay/render share `buildDisplayMeshAssets`.
- **GPU cleanup:** `geometry.dispose()` in `MeshViewport` and `SeamOverlay`.
- **Pick handler freshness:** `PickableMesh` uses `displayMeshRef.current` to avoid stale mesh in pick handler.
- **`useMediaQuery`:** Correct `useSyncExternalStore` pattern without hydration listener leaks.
- **Seam invariant:** `meshLoadVersion` correctly excluded from seam toggle path.

---

## Recommended fix priority

1. **LOGIC-001 / LOGIC-003 / LOGIC-004** — degenerate face lifecycle (import → topology → partition → unfold)
2. **STATE-002** — flatten cleared on seam toggle (high-impact UX)
3. **LAYOUT-003** — stuck resize state
4. **STATE-001** — load race guard
5. **LOGIC-002** — partial unfold results
6. **LOGIC-006 / LOGIC-007 / LOGIC-008** — dedupe BFS and face/edge helpers
7. **LOGIC-005 / LOGIC-012 / LOGIC-013** — structured warnings and tolerance consolidation
8. **UI-003 / LAYOUT-001** — DRY for preview/export and layout constants

---

## Findings count

| Severity | Count |
|----------|-------|
| Critical | 1 |
| High | 5 |
| Medium | 28 |
| Low | 16 |
| Info | 4 |
| **Total** | **54** |

---

*This document is a point-in-time audit. Re-run after major pipeline or layout changes.*
