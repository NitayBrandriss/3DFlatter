# 3DFlatter — Agent Instructions

Web PoC that turns 3D polygonal meshes into 2D flat patterns (Pepakura-style): load mesh → define seams → partition islands → unfold → export.

**Stack:** Next.js 16, React 19, Three.js / `@react-three/fiber`, Zustand, Vitest.

**PoC constraints:** zero material thickness, OBJ v1 only (`v` + `f`), flattened output in the **XY plane**.

Human roadmap: [README.md](README.md). Architectural contracts: [docs/decisions/](docs/decisions/) — [ADR 0001](docs/decisions/0001-mesh-model-and-topology.md) (mesh/topology), [ADR 0002](docs/decisions/0002-unfold-step-1-hinge-island.md) (unfold Step 1). Plans & backlog: [docs/plans/README.md](docs/plans/README.md).

---

## Commands

```bash
npm install
npm run dev          # local dev server
npm test             # vitest run — src/**/*.test.ts
npm run lint
npm run build
```

Before marking work complete: run `npm test`. When touching TypeScript or React, also run `npm run lint`.

---

## Architecture

Pipeline: **load → topology → seams → islands → unfold → export**

| Path | Purpose | Rules |
|------|---------|-------|
| [src/logic/](src/logic/) | Pure geometry, topology, seams, I/O | **No React, no Three.js** — must be unit-testable |
| [src/viewer/](src/viewer/) | 3D viewport, picking, overlays | Three.js / R3F only; delegate math to `logic/` |
| [src/state/](src/state/) | Zustand session orchestration | Wires I/O → topology → UI side effects |
| [src/ui/](src/ui/) | Non-3D UI components | Keep thin |
| [app/](app/) | Next.js routes | Orchestration, not heavy geometry |
| [docs/](docs/) | ADRs and plans | **Must follow** ADRs in `decisions/`; roadmap in [docs/plans/README.md](docs/plans/README.md) |

**Core contracts** live in [src/logic/mesh/types.ts](src/logic/mesh/types.ts): `MeshModel`, `Topology`, `EdgeKey`, `SeamRegistry`.

Reuse existing helpers instead of reimplementing: `makeEdgeKey`, `buildTopology`, `partitionIslands`, `unfoldIsland`, `canSelectAsSeam`, `parseObj`, `toggleSeam`, etc. Grep `src/logic/` before adding new utilities.

---

## How to work

### Before writing code

- Read relevant existing modules and [ADR 0001](docs/decisions/0001-mesh-model-and-topology.md).
- State which pipeline stage the change touches and what depends on it.
- If requirements, UX, or geometry behavior are unclear, **ask** rather than guess.

### While implementing

- **Minimal, focused diffs** — solve the requested step only; no drive-by refactors.
- **Extend before invent** — prefer editing existing functions and files over new abstractions.
- **No one-off helpers** for 1–2 lines; inline unless reused or clarifying non-obvious logic.
- **Best practice over workarounds** — fix root cause; if a workaround is unavoidable, comment why and flag it.
- **Match local style** — naming, types, file layout, test colocation (`*.test.ts` next to source).
- **Comments sparingly** — only non-obvious geometry, topology, or ADR-driven decisions.
- Write readable, maintainable code with explicit types; avoid cleverness.

### After implementing

- Summarize what changed, how to verify manually (e.g. load OBJ, toggle a seam), and open questions.
- List edge cases **not** handled yet instead of silently ignoring them.

---

## Boundaries

### Always

- Follow [ADR 0001](docs/decisions/0001-mesh-model-and-topology.md): triangulated mesh, 0-based indices, `EdgeKey` seam identity, XY flatten plane.
- Follow [ADR 0002](docs/decisions/0002-unfold-step-1-hinge-island.md): triangle-soup 2D output, parent-soup-copy BFS — **never** reintroduce `Map<VertexIndex, Vec2>` for unfold placement.
- Keep `src/logic/` free of React and Three.js imports.
- Colocate Vitest tests for non-trivial logic changes.
- Preserve existing public types in `types.ts` unless explicitly changing architecture.

### Ask first

Stop and get user approval before:

- **Large or architectural changes**: new data models, new dependencies, folder moves, API rewrites.
- **ADR conflicts**: anything that changes mesh representation, edge identity, or 2D convention.
- **Scope expansion**: features from a future README phase not requested in the current task.
- **Deleting code or files** without understanding why they exist.
- **Git**: commits, pushes, PRs — only when the user explicitly asks.

### Never

- Add dependencies without approval.
- Commit secrets or `.env` files.
- Paper over geometry bugs with silent fallbacks (e.g. ignore non-manifold edges without user-visible feedback).
- Create duplicate utilities when an equivalent exists in `src/logic/`.

---

## Domain guardrails

- **Seams** are `Set<EdgeKey>` — never float-based edge matching.
- **Non-manifold and degenerate faces** are known PoC limits; surface them (toast / warning), don't hide them.
- **Fan triangulation** is v1-only; concave n-gons are a known risk per ADR — don't patch with hacks; ask if support is needed.
- **Display vs logic:** viewport normalization lives in [src/viewer/displayNormalization.ts](src/viewer/displayNormalization.ts); don't mix display scaling into topology code.
- **State:** seam toggles must not bump `meshLoadVersion` (see [src/state/meshSessionStore.ts](src/state/meshSessionStore.ts)) — preserve that invariant.

---

## Testing

- Tests run in Node ([vitest.config.ts](vitest.config.ts)); keep logic tests Three.js-free.
- Add or update tests when changing: OBJ parsing, topology, island partition, seam eligibility, pick resolution, unfold (`unfoldIsland`, `unfoldMesh`, layout).
- Prefer small fixtures in [src/logic/io/obj/testMeshes.ts](src/logic/io/obj/testMeshes.ts) over large OBJ files.
- **Local-only assets** (gitignored): `3d_models/` for manual QA meshes; `tests/` for optional local fixtures. Do not commit large mesh files — keep Vitest fixtures inline in `testMeshes.ts`.

---

## Planning workflow

- **Plans hub:** [docs/plans/README.md](docs/plans/README.md) — status, backlog, links to archived specs.
- **Plan / Ask mode:** next phase step, tradeoffs, ADR impact — don't implement yet.
- **Agent mode:** one incremental step from an approved plan.
- **Review pass:** separate prompt to scan for bugs and ADR violations after a slice lands.
