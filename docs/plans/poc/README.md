# PoC plans (Phase 1 — frozen)

**PoC delivery is complete.** The **Shipped** table below is the historical record. Do not add product features here.

**PoC phase summary:** [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md)  
**PoC QA audit:** [qa-audit.md](qa-audit.md)

**Product work:** [product/README.md](../product/README.md) and [PRODUCT_ROADMAP.md](../../../PRODUCT_ROADMAP.md).

**ADRs:** [decisions/poc/](../../decisions/poc/) (0001–0004).

Optional local scratch: [thoughts.txt](../../../thoughts.txt) (gitignored).

```mermaid
flowchart LR
  load["Load mesh (OBJ / STL)"]
  topo["Topology"]
  seams["Seams"]
  islands["Islands"]
  unfold["Unfold"]
  quality["Quality detect"]
  export["Export"]
  shell["UI shell"]
  load --> topo --> seams --> islands --> unfold --> quality --> export
  shell -.-> load
  shell -.-> export
```

---

## Status — Shipped (PoC)

| Phase | Topic | Status | Detail |
|-------|-------|--------|--------|
| Step 1 | Hinge-island unfold (triangle soup) | **Complete** | [ADR 0002](../../decisions/poc/0002-unfold-step-1-hinge-island.md) |
| I/O | STL import (ASCII / binary) | **Complete** | `src/logic/io/stl/parseStl` |
| Step 2 | `unfoldMesh` + layout + 2D viewer | **Complete** | [archive/step-2-flattening.md](archive/step-2-flattening.md) |
| Step 2 stretch | 2D seam overlay on blueprint | **Complete** | [archive/step-2-seam-overlay.md](archive/step-2-seam-overlay.md) |
| Export | SVG preview (tier 1) | **Complete** | `src/logic/export/svg/` |
| Step 3 | Unfold quality detection (3a + 3b) | **Complete** | [ADR 0003](../../decisions/poc/0003-unfold-quality-detection.md), [archive/step-3-quality-detection.md](archive/step-3-quality-detection.md) |
| Step 3 stretch | Quality overlay in 2D viewer | **Complete** | [archive/step-3-quality-overlay.md](archive/step-3-quality-overlay.md) |
| UI shell | Responsive layout (sidebar, split, mobile tabs, peek) | **Complete** | [archive/mobile-responsive-layout.md](archive/mobile-responsive-layout.md) |
| QA | Audit remediation (Slices 0–7) | **Complete** | [ADR 0004](../../decisions/poc/0004-tech-debt-remediation-strategy.md), [archive/qa-audit-remediation.md](archive/qa-audit-remediation.md), [qa-audit.md](qa-audit.md) |

---

## Shipped deliverables (quick reference)

| Area | Key modules |
|------|-------------|
| I/O | `parseObj`, `parseStl`, `polygonConvexity`, `weldVertices` |
| Topology | `buildTopology`, `partitionIslands` |
| Seams | `seamRegistry`, `edgeEligibility`, `resolvePick` |
| geom2d | `tolerances`, `segment2d`, `triangle2d`, `spatialGrid`, `vec2` |
| Unfold | `unfoldIsland`, `unfoldMesh`, `layoutIslands`, `seamSegments2d` |
| Quality (Step 3) | `soupToTriangles`, `buildUnfoldTreeEdges`, `detectCollisions`, `detectTears`, `analyzeUnfoldedIsland` |
| Export | `buildSvgDocument`, `tier1Preview` |
| UI | `MeshViewport`, `UnfoldViewer2D`, `useFlattenExport`, `src/ui/layout/*` |

Manual regression (Step 2): load cube → seam top face → Flatten → two separated islands + red cut lines (MT-1 … MT-6 in [step-2 archive](archive/step-2-flattening.md)).

---

## Archive

| Plan | Description |
|------|-------------|
| [step-2-flattening.md](archive/step-2-flattening.md) | Orchestration, layout, `UnfoldViewer2D`, manual test table |
| [step-2-seam-overlay.md](archive/step-2-seam-overlay.md) | `listSeamSegments2d`, `UnfoldMeshResult.seamSegments` |
| [step-3-quality-detection.md](archive/step-3-quality-detection.md) | ADR 0003 wiring: collision + tear detection |
| [step-3-quality-overlay.md](archive/step-3-quality-overlay.md) | 2D viewer overlay + toast + Flatten card toggle |
| [mobile-responsive-layout.md](archive/mobile-responsive-layout.md) | Collapsible sidebar, 2D split, mobile tabs, peek-through |
| [qa-audit-remediation.md](archive/qa-audit-remediation.md) | Sliced tech-debt fixes from [qa-audit.md](qa-audit.md) |

---

## How to add a PoC archive doc (historical only)

PoC is closed — only add here when correcting archival accuracy. New work belongs under [../product/](../product/).
