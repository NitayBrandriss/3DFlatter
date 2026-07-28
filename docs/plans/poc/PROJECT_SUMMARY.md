# 3DFlatter — PoC Phase Summary

**Document:** Summary of **Phase 1 (proof of concept) only** — not the product roadmap.

**Purpose:** A single narrative for presenting the PoC: what was built, how it was phased, what was intentionally deferred, and how human + Cursor collaboration was organized.

**Status (PoC):** **Frozen and closed** (2026-07-28). The PoC pipeline is complete; QA audit remediation finished (Slices 0–7). This document is **historical** — it will not be updated with product-phase features.

**Product work:** See **[PRODUCT_ROADMAP.md](../../../PRODUCT_ROADMAP.md)** at the repo root (active phases, ADR 0100+).

PoC delivery detail: [README.md](README.md) (this folder) and [archive/](archive/).

---

## What this is

**3DFlatter** is a browser-based proof of concept that turns triangulated 3D polygon meshes into **2D flat cut patterns** (Pepakura-style workflow): load a model, mark **seams** on edges, **flatten** into separated islands in the XY plane, inspect quality, and **export SVG**.

| Layer | Role |
|-------|------|
| `src/logic/` | Pure TypeScript geometry, topology, unfold, export — **no React, no Three.js** |
| `src/viewer/` | 3D viewport, picking, seam overlays (React Three Fiber) |
| `src/state/` | Zustand session (mesh load, seams, toasts) |
| `src/ui/` | 2D blueprint viewer, layout shell, download helpers |
| `app/` | Next.js page orchestration |

**Stack:** Next.js 16, React 19, Three.js / `@react-three/fiber`, Zustand, Vitest.

**Test baseline:** `npm test` — 33 files, 168 tests (logic-heavy; run locally for current counts).

---

## End-to-end pipeline

```mermaid
flowchart LR
  load["Load mesh\n(OBJ / STL)"]
  topo["Topology"]
  seams["Manual seams"]
  islands["Partition islands"]
  unfold["Unfold + layout"]
  quality["Quality detect"]
  export["SVG export"]
  load --> topo --> seams --> islands --> unfold --> quality --> export
```

---

## Phases delivered

Work was tracked in [README.md](README.md) with detailed specs under [archive/](archive/). Architecture contracts live in [decisions/poc/](../../decisions/poc/) (ADRs 0001–0004).

| Phase | What shipped | Contract / plan |
|-------|----------------|-----------------|
| **Foundation** | `MeshModel`, `Topology`, `EdgeKey` seams, island partition, OBJ import | [ADR 0001](../../decisions/poc/0001-mesh-model-and-topology.md) |
| **Step 1 — Unfold core** | Hinge-island BFS, triangle-soup 2D output (no global vertex→UV map) | [ADR 0002](../../decisions/poc/0002-unfold-step-1-hinge-island.md) |
| **Step 2 — Product path** | `unfoldMesh`, `layoutIslands`, Flatten action, `UnfoldViewer2D`, split viewport | [archive/step-2-flattening.md](archive/step-2-flattening.md) |
| **Step 2 stretch** | Red seam segments on the 2D blueprint | [archive/step-2-seam-overlay.md](archive/step-2-seam-overlay.md) |
| **I/O** | STL ASCII/binary, vertex welding, convexity warnings on n-gons | `parseStl`, ADR 0001 amendments |
| **Export** | SVG **tier 1** (preview-style document) | `src/logic/export/svg/` |
| **Step 3 — Quality** | Intra-island collision (SAT) + edge tear detection; detect-only, does not block unfold | [ADR 0003](../../decisions/poc/0003-unfold-quality-detection.md), [archive/step-3-quality-detection.md](archive/step-3-quality-detection.md) |
| **Step 3 stretch** | Quality overlay in 2D viewer, summary toasts, Flatten-card toggle | [archive/step-3-quality-overlay.md](archive/step-3-quality-overlay.md) |
| **UI shell** | Responsive sidebar, 2D split, mobile tabs, peek-through layout | [archive/mobile-responsive-layout.md](archive/mobile-responsive-layout.md) |
| **QA remediation** | Staff audit findings fixed in ordered slices (docs + engine + UI polish) | [ADR 0004](../../decisions/poc/0004-tech-debt-remediation-strategy.md), [archive/qa-audit-remediation.md](archive/qa-audit-remediation.md) |

---

## Decisions that shaped the PoC

These are worth calling out when presenting the design:

1. **Seams are discrete topology** — `Set<EdgeKey>`, never float-based edge matching ([ADR 0001](../../decisions/poc/0001-mesh-model-and-topology.md)).
2. **Unfold output is triangle soup** — the same 3D vertex index can appear at different 2D positions on different faces; required for slits, darts, and honest SVG paths ([ADR 0002](../../decisions/poc/0002-unfold-step-1-hinge-island.md)).
3. **Quality is orthogonal** — collisions and tears are reported for the user; they do not silently “fix” geometry ([ADR 0003](../../decisions/poc/0003-unfold-quality-detection.md)).
4. **Session stability** — seam toggles do not bump `meshLoadVersion`; flatten results stay valid until a new mesh load.
5. **Remediation over big-bang refactor** — prefer targeted Zustand selectors and memoization before Web Workers for flatten ([ADR 0004](../../decisions/poc/0004-tech-debt-remediation-strategy.md)).

---

## Intentionally out of scope (this phase)

The PoC goal was a **credible end-to-end demo**, not production CAM or automatic pattern design.

| Topic | Why deferred |
|-------|----------------|
| **Material thickness / tabs / glue flaps** | Zero-thickness assumption for geometry and export |
| **SVG tier 2 (manufacturing / laser)** | Preview export shipped; cut-order and machine-ready paths are backlog |
| **Auto seam suggestions / AI-assisted seaming** | Phase 2; manual seams prove the pipeline |
| **GLB / glTF import** | OBJ + STL at the I/O boundary for v1 |
| **Half-edge mesh / robust non-manifold repair** | Documented limits; user-visible warnings instead of silent fixes |
| **Concave n-gon triangulation beyond fan** | Fan triangulation with warnings; known PoC risk per ADR 0001 |
| **Web Worker flatten (`UI-004`)** | Large async architecture; main-thread flatten acceptable for modest meshes |
| **Remaining Low/Info audit polish** | Non-blocking maintainability items ([qa-audit.md](../../qa-audit.md) deferred table) |

Product-phase successors (freeform cuts, tabs, pagination, etc.) are **out of scope for this document**. See **[PRODUCT_ROADMAP.md](../../../PRODUCT_ROADMAP.md)**.

---

## Known PoC limits (honest edge cases)

- Non-manifold edges, degenerate faces, and very large meshes may warn or perform poorly.
- Flatten and quality analysis run **synchronously** on the main thread.
- Export is suitable for **preview and portfolio demos**, not guaranteed laser-ready without tier 2.

---

## How we worked (human + Cursor)

This repository was built as an **incremental, contract-first** collaboration: you steered product and acceptance; Cursor Agent implemented bounded slices against documented rules.

### Division of responsibility

| You | Cursor (Agent) |
|-----|----------------|
| Goals, UX priorities, “what good looks like” on real meshes | Implementation in `src/logic/` and wiring in UI/state |
| Manual QA on `3d_models/` and demo flows | Unit tests, lint, minimal diffs per slice |
| Approving architecture changes, new dependencies, scope expansion | Following [AGENTS.md](../../../AGENTS.md) and ADRs; asking when unclear |

### Workflow habits that kept quality high

1. **Plans as source of truth** — PoC specs under [this folder](README.md); product specs under [plans/product/](../product/) and [PRODUCT_ROADMAP.md](../../../PRODUCT_ROADMAP.md).
2. **ADRs before drift** — mesh model, unfold soup, quality detection, and remediation strategy are written down so agents and humans share the same contracts.
3. **One slice per pass** — especially QA remediation: Slice 0 (docs) → 1 (correctness) → … → 7 (UI structure), each gated on `npm test` and often `npm run lint`.
4. **Visual QA for geometry** — for algorithmic DRY/perf changes, unit tests were required but **not sufficient**; complex seamed models were flattened and inspected on the 2D canvas ([ADR 0004](../../decisions/poc/0004-tech-debt-remediation-strategy.md) Decision 2).
5. **Pure logic boundary** — all heavy geometry stays testable in Node without Three.js, which made refactors during QA low-risk.
6. **Review-oriented stops** — large architectural moves (workers, new data models, tier-2 export) were explicitly **ask-first**, not slipped in during bugfix slices.

### Typical session loop

1. Pick the next row or slice from [README.md](README.md) (PoC) or [PRODUCT_ROADMAP.md](../../../PRODUCT_ROADMAP.md) (product).
2. Agent reads relevant ADR + archive spec + existing helpers in `src/logic/`.
3. Implement the smallest change that satisfies “Done when” in the plan.
4. Run tests (and lint when touching TS/React); you spot-check in the browser when geometry or layout changed.
5. Update plan checkboxes; PoC archive under `docs/plans/poc/archive/`, product under `docs/plans/product/`.

---

## How to run and verify

```bash
npm install
npm run dev    # http://localhost:3000
npm test
npm run lint
npm run build
```

**Quick manual path:** load demo or OBJ/STL → enable seam mode → click edges → **Flatten** → inspect 2D blueprint (seams + optional quality overlay) → download SVG.

Regression notes for Step 2: cube with a top-face seam → two separated islands and cut lines (see manual table in [step-2-flattening archive](archive/step-2-flattening.md)).

---

## Where to read next

| Audience | Start here |
|----------|------------|
| Recruiters / quick overview | [README.md](../../../README.md) |
| PoC phase summary (this doc) | **This file** |
| **Product roadmap (active)** | **[PRODUCT_ROADMAP.md](../../../PRODUCT_ROADMAP.md)** |
| PoC phase specs (archive) | [README.md](README.md) |
| PoC architecture (0001–0004) | [decisions/poc/](../../decisions/poc/) |
| Product plans & ADRs (0100+) | [plans/product/](../product/) · [decisions/product/](../../decisions/product/) |
| Contributors & agents | [AGENTS.md](../../../AGENTS.md) |
| Audit history | [qa-audit.md](../../qa-audit.md) |

---

## Closing line for presentations

**3DFlatter demonstrates a full Pepakura-style pipeline in the browser** — clean separation between testable computational geometry and a Three.js seam editor — with explicit architecture docs, phased delivery, and a completed QA hardening pass. **Post-PoC product development** continues under [PRODUCT_ROADMAP.md](../../../PRODUCT_ROADMAP.md).
