# 3DFlatter — QA Code Audit

**Date:** 2026-07-14 (refresh of 2026-07-10 audit)  
**Scope:** `src/logic/`, `src/state/`, `src/ui/` (incl. `layout/`), `src/viewer/`, `app/`  
**Method:** Static re-review against ADRs 0001–0003, AGENTS.md, mobile layout plan, and prior audit IDs. Code read + spot verification; **no code changes**.  
**Test baseline:** `npm test` — **28 files, 122 tests, all passing** (post Critical/High fixes).  
**Lint baseline:** `npm run lint` — **passes** (`eslint .` via flat config; TOOL-001 fixed).

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

Architecture remains sound: triangle-soup unfold (ADR 0002), `EdgeKey` seam identity, and `src/logic/` free of React/Three.js. **117 unit tests pass.** The responsive layout slice landed in good structural shape (hooks extracted, peek CSS scoped correctly, auto-close gated on success).

**Critical + High (2026-07-14 fix pass):** Geometry lifecycle (LOGIC-001/002/003), load races/wipe (STATE-001/007/008), flatten-on-seam (STATE-002), resize stuck state (LAYOUT-003), Escape focus (A11Y-001), and lint (TOOL-001) are **addressed**. Remaining risk is Medium/Low backlog (DRY helpers, peek capture, hydration, etc.).

---

## Changes since 2026-07-10

| Status | Notes |
|--------|--------|
| **Still open** | All prior Critical/High findings re-verified in current code |
| **New High** | STATE-007, STATE-008, A11Y-001, TOOL-001 |
| **New Medium** | LAYOUT-009/010, A11Y-002/003, IO-001/002, LOGIC-024 |
| **Reclassified** | UI-006 → **Info** (explicitly deferred by mobile plan — not a regression) |
| **Layout QA** | Peek-through CSS + success-gated `closeIfMobile` match plan; pointer-capture on peek wrapper is a residual risk |

---

## Critical

### LOGIC-001 — Orphan degenerate faces can break entire mesh unfold

| Field | Detail |
|-------|--------|
| **Severity** | Critical |
| **Status** | **Fixed** (2026-07-14) — weld drops index-degenerate faces; `partitionIslands` skips topology orphans; `unfoldMesh` continues past failed islands |
| **Files** | `src/logic/mesh/buildTopology.ts`, `src/logic/mesh/partitionIslands.ts`, `src/logic/unfold/unfoldMesh.ts`, `src/logic/io/stl/parseStl.ts` |
| **Description** | ~~`buildTopology` skipped index-degenerate faces but left them in `MeshModel.faces`…~~ Addressed by weld filter + orphan skip + partial unfold. |
| **Suggested fix** | ~~…~~ Done. |

---

## High

### STATE-001 — No load-generation guard on async mesh load

| Field | Detail |
|-------|--------|
| **Severity** | High |
| **Status** | **Fixed** (2026-07-14) — monotonic `loadSeq` ignores stale completions |
| **Files** | `src/state/meshSessionStore.ts` (`loadMeshFile`) |
| **Description** | ~~…~~ |
| **Suggested fix** | ~~…~~ Done (`loadSeq` + boolean return). |

### STATE-007 — Failed load wipes previous good session *(new)*

| Field | Detail |
|-------|--------|
| **Severity** | High |
| **Status** | **Fixed** (2026-07-14) — failure keeps prior `session`, does not bump `meshLoadVersion` |
| **Files** | `src/state/meshSessionStore.ts` |
| **Description** | ~~…~~ |
| **Suggested fix** | ~~…~~ Done. |

### STATE-008 — `isLoading` not tied to in-flight generation *(new)*

| Field | Detail |
|-------|--------|
| **Severity** | High |
| **Status** | **Fixed** (2026-07-14) — only latest `loadSeq` clears `isLoading` / writes state |
| **Files** | `src/state/meshSessionStore.ts` |
| **Description** | ~~…~~ |
| **Suggested fix** | ~~…~~ Done. |

### STATE-002 — Flatten result clears on every seam toggle

| Field | Detail |
|-------|--------|
| **Severity** | High |
| **Status** | **Fixed** (2026-07-14) — flatten snapshot keyed on `meshLoadVersion` |
| **Files** | `src/ui/useFlattenExport.ts` |
| **Description** | ~~…~~ |
| **Suggested fix** | ~~…~~ Done. Re-flatten after seam edits for accuracy. |

### LOGIC-002 — `unfoldMesh` all-or-nothing error handling

| Field | Detail |
|-------|--------|
| **Severity** | High |
| **Status** | **Fixed** (2026-07-14) — partial islands + `warnings`; `error` only if zero succeed |
| **Files** | `src/logic/unfold/unfoldMesh.ts`, `src/logic/mesh/types.ts` |
| **Description** | ~~…~~ |
| **Suggested fix** | ~~…~~ Done. |

### LOGIC-003 — Welding can create index-degenerate faces with no post-check

| Field | Detail |
|-------|--------|
| **Severity** | High |
| **Status** | **Fixed** (2026-07-14) — `weldVertices` drops index-degenerate triangles; I/O wires counts/warnings |
| **Files** | `src/logic/mesh/weldVertices.ts`, `src/logic/io/obj/parseObj.ts`, `src/logic/io/stl/parseStl.ts` |
| **Description** | ~~…~~ |
| **Suggested fix** | ~~…~~ Done. |

### LAYOUT-003 — Stuck resize state when container ref is null

| Field | Detail |
|-------|--------|
| **Severity** | High |
| **Status** | **Fixed** (2026-07-14) — validate container before dragging/body class |
| **Files** | `src/ui/layout/useResizableSplit.ts` |
| **Description** | ~~…~~ |
| **Suggested fix** | ~~…~~ Done. |

### A11Y-001 — Escape closes sidebar but cannot restore focus *(new)*

| Field | Detail |
|-------|--------|
| **Severity** | High |
| **Status** | **Fixed** (2026-07-14) — focus open button in `useEffect` after close transition |
| **Files** | `src/ui/layout/useSidebarState.ts` |
| **Description** | ~~…~~ |
| **Suggested fix** | ~~…~~ Done. |

### TOOL-001 — `npm run lint` broken on Next.js 16 *(new)*

| Field | Detail |
|-------|--------|
| **Severity** | High |
| **Status** | **Fixed** (2026-07-14) — `eslint.config.mjs` + `"lint": "eslint ."` |
| **Files** | `package.json`, `eslint.config.mjs` |
| **Description** | ~~…~~ |
| **Suggested fix** | ~~…~~ Done. |

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
| **Files** | `src/logic/seams/displaySeamSegments.ts`, `src/logic/unfold/seamSegments2d.ts`, `src/logic/unfold/detectTears.ts` |
| **Description** | Edge key parsing is reimplemented instead of living beside `makeEdgeKey` in `edgeKey.ts`. `detectTears` uses `.split(",").map(Number)` inline while others define a local `parseEdgeKey`. |
| **Suggested fix** | Add `parseEdgeKey(key: EdgeKey): [VertexIndex, VertexIndex]` to `mesh/edgeKey.ts`. |

### LOGIC-009 — `detectTears` scans entire mesh edge map per island

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Files** | `src/logic/unfold/detectTears.ts` |
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

### LOGIC-024 — Island order makes orphan failures hit first *(new)*

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Status** | New (amplifier of LOGIC-001/002) |
| **Files** | `src/logic/mesh/partitionIslands.ts`, `src/logic/unfold/unfoldMesh.ts` |
| **Description** | Islands emit in ascending face-index order. A degenerate at face 0 fails flatten before any later valid island is attempted — deterministic full failure on common “bad triangle + mesh” STL shapes. |
| **Suggested fix** | Skip topology-orphan faces in partition, or unfold with partial results + per-island errors. |

### STATE-003 — Full island re-partition on every seam toggle

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Files** | `src/state/meshSessionStore.ts` (`computeSessionStats`), `app/page.tsx` |
| **Description** | `computeSessionStats` calls `partitionIslands` on every seam toggle because `page.tsx` memoizes on `session`. Large meshes will re-partition on each pick for sidebar stats. |
| **Suggested fix** | Memoize islands on seams content hash; or split cheap counters from full partition. |

### STATE-006 — Escape key collapses sidebar on desktop

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Files** | `src/ui/layout/useSidebarState.ts` |
| **Description** | Escape always closes when `sidebarOpen`, including on desktop. Matches the mobile layout plan’s a11y note, but desktop users may not expect an in-flow sidebar to be Escape-dismissible. |
| **Suggested fix** | Gate Escape with `!isDesktop` or only in drawer overlay mode (product decision). |

### UI-001 — Duplicated post-load success check

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Files** | `app/page.tsx` (`onPickFile`, `onLoadDemo`) |
| **Description** | Both paths duplicate: `setModelScale(1)` + `loadMeshFile` + `getState()` + `session !== null && error === null`. |
| **Suggested fix** | Extract `loadMeshFromFile(file): Promise<boolean>` helper, or return `{ ok }` from `loadMeshFile`. |

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
| **Description** | Breakpoint `769`, sidebar widths `360/80`, split `280/140/0.6` exist in both TS constants and CSS custom properties / media queries. `--layout-breakpoint` is unused by `@media` rules. Drift risk. |
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
| **Description** | SSR `getServerSnapshot` returns `true` (desktop); mobile hydrates to `isDesktop === false`. `sidebarOpen = userOverride ?? isDesktop` can flash open→closed on first paint. Reading `localStorage` in `useState` init (not `useEffect`) worsens mismatch. |
| **Suggested fix** | Mobile-first SSR default, defer storage read to `useEffect`, or suppress transition until hydrated. |

### LAYOUT-008 — Stored split height not clamped on init

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Files** | `src/ui/layout/useResizableSplit.ts`, `src/ui/layout/readLayoutStorage.ts` |
| **Description** | Corrupt/huge localStorage values apply until user drifts. Clamp only runs inside drag (`updateFromClientY`). |
| **Suggested fix** | Clamp `readStoredNumber` result with `clampSplitHeight` once container is measurable. |

### LAYOUT-009 — Peek `setPointerCapture` may starve range slider *(new)*

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Status** | New |
| **Files** | `src/ui/layout/usePeekThrough.ts`, `src/ui/layout/PeekThroughControl.tsx` |
| **Description** | Peek CSS correctly keeps `.peek-through-target { pointer-events: auto }`, but the wrapper calls `setPointerCapture` on pointerdown. In some browsers that can retarget moves away from the native `<input type="range">`, so the slider stops tracking mid-drag while drawer is ghosted. |
| **Suggested fix** | Prefer capture on the range itself, or skip capture and rely on CSS + `lostpointercapture` cleanup. Manual QA on mobile Chrome/Safari. |

### LAYOUT-010 — Layout storage read during `useState` init *(new)*

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Status** | New |
| **Files** | `src/ui/layout/readLayoutStorage.ts`, `useResizableSplit.ts`, `useSidebarState.ts` |
| **Description** | Client `useState(() => readStored*)` during SSR of `"use client"` pages: server gets fallback/`null`, client can get storage → hydration mismatch (feeds LAYOUT-004/008). Mobile plan recommended reading storage in `useEffect`. |
| **Suggested fix** | Defer storage read to `useEffect` after mount; clamp split once container is measured. |

### A11Y-002 — Mobile tabs lack keyboard tab pattern *(new)*

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Status** | New |
| **Files** | `src/ui/layout/ViewportChrome.tsx` |
| **Description** | Tabs expose `role="tablist"` / `tab` / `tabpanel` and `aria-selected`, but lack WAI-ARIA keyboard pattern (`ArrowLeft`/`ArrowRight`, roving `tabIndex`). |
| **Suggested fix** | Add roving tabindex + key handlers. |

### A11Y-003 — Split separator not keyboard-resizable *(new)*

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Status** | New |
| **Files** | `src/ui/layout/ViewportChrome.tsx`, `src/ui/layout/useResizableSplit.ts` |
| **Description** | `role="separator"` exposes `aria-valuemin/max/now` but has no `ArrowUp`/`ArrowDown` (or equivalent) to adjust height. |
| **Suggested fix** | Adjust `split2dPx` on keys; clamp + persist on keyup. |

### IO-001 — STL format heuristic can prefer binary over ASCII *(new)*

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Status** | New |
| **Files** | `src/logic/io/stl/parseStl.ts` |
| **Description** | If header looks like ASCII (`solid…`) but `byteLength` matches binary layout for the uint32 at offset 80, detector returns `"binary"`. Edge-case ASCII files can parse incorrectly or throw empty-binary errors. |
| **Suggested fix** | Prefer ASCII when `looksLikeAsciiStl` unless binary header is unmistakably valid; try ASCII fallback on empty/failed binary. |

### IO-002 — No max file / triangle budget on client load *(new)*

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Status** | New |
| **Files** | `src/logic/io/stl/parseStl.ts`, `src/state/meshSessionStore.ts` |
| **Description** | No soft max bytes / face count. Large STL/OBJ can allocate huge typed arrays / strings and freeze/OOM the tab. |
| **Suggested fix** | Soft limits with a clear user-facing error before allocate/decode. |

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
| **Description** | ~200+ lines wiring Zustand, flatten export, viewport prefs, demo fetch, layout hooks, backdrop, and both viewports. Harder to test than the extracted layout modules. |
| **Suggested fix** | Split into `HomePageShell`, `useViewportPreferences`, `useDemoLoader`. |

### ARCH-001 — Broad Zustand selector re-renders entire page on seam toggle

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Files** | `app/page.tsx` |
| **Description** | `useShallow` selects `session` wholesale; seam toggles re-render sidebar, chrome, and overlays. Necessary for stats but over-invalidates unrelated UI. |
| **Suggested fix** | Split selectors: mesh-only subtree vs seams/stats. |

---

## Low

| ID | Files | Description | Suggested fix |
|----|-------|-------------|---------------|
| **STATE-004** | `meshSessionStore.ts` | Failed loads still bump `meshLoadVersion`, forcing Canvas remount with no mesh change | Only increment on successful load/clear |
| **STATE-005** | `meshSessionStore.ts` | Double `requestAnimationFrame` before parse is undocumented; may not prevent jank on large files | Worker, `startTransition`, or document intent |
| **UI-005** | `ToastStack.tsx` | `ToastItem` effect depends on `onDismiss`; unstable callback would reset timers | Stable ref or omit from deps |
| **UI-007** | `AppSidebar.tsx` | `stats ?` nested inside `session ?` is redundant | Simplify conditionals |
| **LAYOUT-005** | `ViewportChrome.tsx` | Dead re-export `SPLIT_2D_MIN` | Remove unused export |
| **LAYOUT-006** | `usePeekThrough.ts` | `usePeekThroughBind` returns new handler object every render | Memoize bind object |
| **LAYOUT-007** | `app/page.tsx` | Mobile backdrop lives in page; sidebar state in hook | Move into `AppSidebar` or shell |
| **VIEW-002** | `MeshViewport.tsx` | Camera refit may miss control target on first frame | `useLayoutEffect` or refit in ref callback |
| **VIEW-003** | `MeshViewport.tsx` | Empty vs loaded scene use different OrbitControls config | Share one controls config |
| **VIEW-004** | `SeamOverlay.tsx` | `linewidth={2}` ignored on most WebGL platforms | Document or use mesh-line |
| **VIEW-005** *(new)* | `page.tsx`, `ViewportChrome.tsx` | Toasts live inside `viewport3d`; on mobile 2D tab they are hidden with the panel | Portal toasts to `.page` or keep a non-hidden stack |
| **APP-002** | `app/api/demo-models/`, `demoModels.ts` | API route imports catalog from `src/ui/` | Move to `src/data/` or `src/config/` |
| **APP-003** | `app/page.tsx`, API route | Demo error strings partially duplicated | Single error-mapping helper |
| **ARCH-002** | `app/page.tsx` | Imperative `getState()` after `await` instead of return value from `loadMeshFile` | Return `{ ok, error }` from loader |
| **IO-003** *(new)* | `parseObj.ts` | `parseInt` accepts prefixes (`"12abc"` → 12); can silently corrupt geometry | Require full-token integer match |
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
| **UI-006** | `page.tsx`, `AppSidebar.tsx` | Mobile flatten does **not** auto-switch to 2D tab — **explicitly deferred** by mobile layout plan (not a regression). Optional follow-up UX. |
| **APP-002-sec** | `app/api/demo-models/[id]/route.ts` | Demo IDs resolve via allowlist then disk/bundled fallback — path traversal mitigated. No action required. |

---

## Layout slice health check (mobile plan)

| Expectation | QA verdict |
|-------------|------------|
| Constants + CSS tokens | Done; values still duplicated (LAYOUT-001) |
| Hooks: media / sidebar / split / peek | Done |
| `closeIfMobile` only after successful major actions | **Correct** (better than early plan sketch) |
| Peek scoped `pointer-events` CSS | **Correct** |
| Desktop in-flow vs mobile overlay + backdrop | **Correct** |
| Escape + aria toggles + tab roles + separator values | Mostly done; focus + keyboard gaps (A11Y-001/002/003) |
| `prefers-reduced-motion` | **Correct** |
| Auto-switch to 2D after flatten | Out of scope by plan (UI-006 → Info) |
| Persist sidebar / split | Done, but init unclamped + hydration-hostile (LAYOUT-004/008/010) |

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
| Surface degenerate/non-manifold limits to user | **Partial** — counts in UI; `console.warn` and orphan faces are weak spots |
| `src/logic/` free of React/Three.js | Compliant |

---

## What looks solid

- **Test coverage:** 117 logic/layout tests across topology, I/O, unfold, quality detection, export, and `clampSplitHeight`.
- **Layer boundaries:** `displayNormalization.ts` stays Three.js-free; pick/overlay/render share display assets cleanly.
- **GPU cleanup:** `geometry.dispose()` in `MeshViewport` and `SeamOverlay`.
- **Pick handler freshness:** `PickableMesh` uses `displayMeshRef.current` to avoid stale mesh in pick handler.
- **`useMediaQuery`:** Correct `useSyncExternalStore` pattern.
- **Seam invariant:** `meshLoadVersion` correctly excluded from seam toggle path.
- **Layout extraction:** `AppSidebar` / `ViewportChrome` / layout hooks keep `page.tsx` thinner than the prior monolith.
- **Mobile UX gates:** Peek CSS exception + success-only auto-close are implemented carefully.

---

## Recommended fix priority

1. ~~**LOGIC-001 / LOGIC-003 / LOGIC-024 / LOGIC-002**~~ — **Done** (2026-07-14)
2. ~~**STATE-002**~~ — **Done**
3. ~~**STATE-007 / STATE-001 / STATE-008**~~ — **Done**
4. ~~**TOOL-001**~~ — **Done**
5. ~~**LAYOUT-003 / A11Y-001**~~ — **Done**
6. **LAYOUT-009 / LAYOUT-008 / LAYOUT-010** — peek capture + storage init hardening
7. **LOGIC-006 / LOGIC-007 / LOGIC-008** — dedupe BFS and face/edge helpers
8. **LOGIC-005 / LOGIC-012 / LOGIC-013 / IO-*** — warnings, tolerances, STL detection, file limits
9. **UI-003 / LAYOUT-001 / A11Y-002/003** — DRY preview/export, constants, keyboard a11y

---

## Findings count

| Severity | Count |
|----------|-------|
| Critical | 1 |
| High | 9 |
| Medium | 34 |
| Low | 19 |
| Info | 6 |
| **Total** | **69** |

---

*This document is a point-in-time audit (refreshed 2026-07-14). Re-run after major pipeline, session, or layout changes.*
