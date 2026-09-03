# 3DFlatter — Agent Instructions

Web PoC that turns 3D polygonal meshes into 2D flat patterns (Pepakura-style): load mesh → define seams → partition islands → unfold → export.

**Stack:** Next.js 16, React 19, Three.js / `@react-three/fiber`, Zustand, Vitest.

**PoC constraints:** zero material thickness; mesh import via OBJ v1 (`v` + `f`) or STL (ASCII/binary) at the I/O boundary; flattened output in the **XY plane**.

Human overview: [README.md](README.md). **PoC (frozen):** [docs/plans/poc/PROJECT_SUMMARY.md](docs/plans/poc/PROJECT_SUMMARY.md), plans [docs/plans/poc/](docs/plans/poc/README.md), ADRs [0001–0004](docs/decisions/poc/). **Product (active):** [PRODUCT_ROADMAP.md](PRODUCT_ROADMAP.md), plans [docs/plans/product/](docs/plans/product/README.md), ADRs **0100+** in [docs/decisions/product/](docs/decisions/product/). Optional local notes: [thoughts.txt](thoughts.txt) (gitignored).

---

## Commands

```bash
npm install
npm run dev          # local dev server
npm test             # vitest run — src/**/*.test.ts
npm run lint
npm run build
```

Before marking work complete: run `npm test`. When touching TypeScript or React, also run `npm run lint`. For mesh/topology/cuts/isolation/unfold (Tier B), also satisfy [Algorithmic & slice Done criteria](#algorithmic--slice-done-criteria) — green tests alone are not Done.

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
| [docs/](docs/) | ADRs and plans | **Must follow** PoC ADRs in `decisions/poc/`; product in `decisions/product/`; roadmaps in [docs/plans/](docs/plans/README.md) and [PRODUCT_ROADMAP.md](PRODUCT_ROADMAP.md) |

**Core contracts** live in [src/logic/mesh/types.ts](src/logic/mesh/types.ts): `MeshModel`, `Topology`, `EdgeKey`, `SeamRegistry`.

Reuse existing helpers instead of reimplementing: `makeEdgeKey`, `buildTopology`, `partitionIslands`, `unfoldIsland`, `canSelectAsSeam`, `parseObj`, `parseStl`, `toggleSeam`, etc. Grep `src/logic/` before adding new utilities.

---

## How to work

### Before writing code

- Read relevant existing modules and [ADR 0001](docs/decisions/poc/0001-mesh-model-and-topology.md).
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
- For Tier B logic: report red-before-green status, adversarial fixtures added, and whether Red Team QA is filed (see [Done criteria](#algorithmic--slice-done-criteria)).

---

## Boundaries

### Always

- Follow [ADR 0001](docs/decisions/poc/0001-mesh-model-and-topology.md): triangulated mesh, 0-based indices, `EdgeKey` seam identity, XY flatten plane.
- Follow [ADR 0002](docs/decisions/poc/0002-unfold-step-1-hinge-island.md): triangle-soup 2D output, parent-soup-copy BFS — **never** reintroduce `Map<VertexIndex, Vec2>` for unfold placement.
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
- Add or update tests when changing: OBJ/STL parsing, topology, island partition, seam eligibility, pick resolution, unfold (`unfoldIsland`, `unfoldMesh`, layout), isolation, cut materialize.
- Prefer **small but topologically rich** inline fixtures over large OBJ files. Small ≠ topologically trivial.
- **Local-only assets** (gitignored): `3d_models/` for manual QA meshes; `tests/` for optional local fixtures. Do not commit large mesh files — keep Vitest fixtures inline in `testMeshes.ts` / colocated `*Fixtures.ts`.
- Prefer `*.adversarial.test.ts` for edge / landmine suites (see [src/logic/cuts/materializeCutStrokes.adversarial.test.ts](src/logic/cuts/materializeCutStrokes.adversarial.test.ts)).

---

## Algorithmic & slice Done criteria

Lesson from P2-E2 Slice 1: first-try green Vitest is unsurprising when fixtures are toys that collude with the implementation. **Green tests alone never mean Done** for math/topology work. See [docs/plans/product/qa-isolation-slice1.md](docs/plans/product/qa-isolation-slice1.md) and [docs/plans/product/qa-audits.md](docs/plans/product/qa-audits.md).

### Applicability (tiers)

| Tier | When | Requirement |
|------|------|-------------|
| **A** | Every change | `npm test` green; `npm run lint` when TS/React touched; list unhandled edge cases in the summary |
| **B–D** | Mesh, topology, dual graphs, seams, cuts, isolation, unfold, geom2d, any `src/logic/` math; viewer/state that wraps that logic | Fixture mandates + red-before-green + Red Team audit before Done |
| UI chrome / layout / copy only | Tier A + manual/smoke verify | Red Team optional unless math contracts change |

### Tier B — Fixture mandates

Before implementing or claiming a logic slice Done, tests **must** include inline Vitest fixtures that cover **at least** the categories relevant to the change:

| Category | What it must exercise | Example |
|----------|----------------------|---------|
| **Branched** | Second dual path / shared ring / T-junction | Two tubes on a shared loop; barrier on limb A must not flood limb B |
| **Gapped / incomplete barrier** | Missing segment, open cycle, wrap-around | Incomplete bracelet → whole-component warn, not silent wrong isolate |
| **Disjoint / multi-component** | Two bodies or two masked islands | Extract → `partitionIslands` length ≥ 2; index contracts |
| **Non-manifold / orphan / degenerate** | `edgeToFaces.length > 2`, orphans, zero-area | Warn or hard-stop **visible in result**; never silent “as if manifold” |
| **ADR-target stress** | The failure the epic exists for | e.g. isolation: stroke-derived fences without relying on opaque walked faces |

Happy-path toys (unit quad, diamond, tiny prism) are smoke only — they **do not** count toward the adversarial set.

**Anti-collusion — agents must not:**

- Build fixtures that only use exact midpoints / perfect keys so `locate` cannot miss, without also testing vertex-ring snaps, off-surface / `locate === none`, hop-cap truncation, empty / single-point / overlapping inputs.
- Rename bands “arm / torso” on a **single cylinder** and claim torso-leak coverage.
- Assert only `size > 0`, `.toBeTruthy()`, or `.not.toBe("inside")` for contracts that have a known oracle.
- Ship integration tests that would still pass if a critical input were ignored (e.g. flood that “works” with `fenceEdges` emptied).

**Oracle discipline:** for each primary contract, at least one test must be a **counterfactual oracle**:

- Exact expected `EdgeKey` set (⊇ or ===), face set, mask bits, warning codes, or island count; **or**
- An explicit **ablation**: same inputs with one barrier channel removed → **must fail** the success assertion.

**Scale honesty:** dense production assets (~84k tris) stay gitignored / manual QA. The slice summary **must** state what dense behavior is unproven by Vitest (perf, hop caps, hitch risk). Characterizing tests on small branched/gapped meshes are mandatory; “try the avatar later” does **not** waive Tier B.

### Tier C — Test-first / red–green

For any new behavior or bugfix in Tier B scope, follow this order and **report it** in the completion summary:

1. **Policy / oracle** — quote ADR or state the expected outcome in one sentence. If policy is ambiguous → **ask** before coding.
2. **Failing tests first** — add adversarial + oracle tests; run Vitest; **show red** (or show existing tests already fail for the right reason).
3. **Implement** the minimal logic to go green.
4. **Refuse to “fix tests”** by weakening assertions, deleting fixtures, or matching the buggy implementation.

If prior red cannot be demonstrated (pure refactor, identical behavior), say so and still add **characterizing** tests that would fail under a known wrong alternative.

**Before writing production code**, answer in the plan/summary:

- If we ignored the critical barrier channel (fences / seams / mask / …), would the suite still pass?
- If the barrier had a one-edge gap, do we assert the warn/wrap outcome?
- Is there a **branched** fixture for any “does not leak” claim?

Any “no” → add that test **before** implementation.

Product / Cursor plans for Tier B slices **must** list adversarial fixtures, tests that must be red under wrong semantics, and explicit non-goals. “Implement module + happy tests” is an incomplete plan.

### Tier D — Red Team QA before Done

A Tier B slice is **Done** only when all of the following hold:

1. `npm test` (and `npm run lint` if TS/React touched) green.
2. Tier B fixture + oracle rules satisfied.
3. A **Red Team audit pass** completed and filed (below).
4. **No open Critical/High** findings, or each is **explicitly waived** in the QA SSOT with owner + reason.
5. The **next epic slice is blocked** until (4) — same pattern as ISO-S1 → Slice 2.

**Red Team pass rules:**

- Separate turn / prompt from implementation (or a dedicated subagent). Auditor **must not** edit production or test code in the audit pass.
- Treat fixtures and assertions as **evidence, not proof**.
- Output: working SSOT under `docs/plans/product/` + index row in [docs/plans/product/qa-audits.md](docs/plans/product/qa-audits.md).
- Finding IDs: `<EPIC-OR-SLICE>-NNN` (e.g. `ISO-S1-001`). Severity: Critical / High / Medium / Low.

**Required checklist (audit must answer):**

1. **Fixture adequacy** — Max faces? Branched? Gapped? Non-manifold? Disjoint? Or only toys?
2. **Tautology hunt** — Would key tests pass if a critical barrier channel were ignored?
3. **ADR alignment** — Implementation vs ADR (fallbacks, warnings, index contracts).
4. **Silent failure** — Non-manifold, truncated walks, empty inputs: warned or hidden?
5. **Downstream landmines** — Empty subset → topology throw; remapped face ids; combined barriers.
6. **Perf honesty** — Asymptotics on ADR-scale meshes; what Vitest cannot prove.
7. **Decision queue** — Ambiguous product/geometry policy listed before remediation coding.

**Canonical Red Team prompt** (paste into a fresh chat):

```text
You are Red Team QA for 3DFlatter. Scope: [paths / slice / ADR].
Do NOT edit production or test code. Read ADR + plan + implementation + colocated tests.

Assume first-try green is suspicious. Fixtures and assertions are evidence, not proof.

Deliver:
1. Verdict (proven / not proven for ADR target).
2. Fixture table (faces, topology traits, what claim they support).
3. Findings table: ID, Severity, Issue, why tests miss it, proposed characterizing test.
4. Tautology / ablation notes (“still green if X ignored”).
5. Decision queue for policy forks.
6. Index blurb for docs/plans/product/qa-audits.md.

Use severity Critical/High/Medium/Low. Prefer Vitest landmines over vague advice.
Working SSOT: docs/plans/product/qa-<slice>.md
```

**Agent self-check before saying Done** (Tier B) — if any item fails, do **not** mark Done:

- [ ] Adversarial fixtures present (branched / gapped / disjoint / non-manifold as relevant)
- [ ] At least one ablation or exact-oracle test for the core contract
- [ ] Failing tests existed (or characterizing tests named) before the fix
- [ ] Red Team audit filed; High/Critical closed or waived
- [ ] Unproven dense/manual cases listed in the summary

---

## Planning workflow

- **PoC (frozen):** [docs/plans/poc/](docs/plans/poc/README.md) — historical specs in `poc/archive/`; do not add product features to [docs/plans/poc/PROJECT_SUMMARY.md](docs/plans/poc/PROJECT_SUMMARY.md).
- **Product (active):** [PRODUCT_ROADMAP.md](PRODUCT_ROADMAP.md) + [docs/plans/product/](docs/plans/product/README.md); architecture in **ADR 0100+** under [docs/decisions/product/](docs/decisions/product/). Deferred / parked work: [PRODUCT_ROADMAP.md — Deferred backlog](PRODUCT_ROADMAP.md#deferred-backlog-not-scheduled). Promote Cursor plans into `docs/plans/product/`.
- **Plan / Ask mode:** next phase step, tradeoffs, ADR impact — don't implement yet.
- **Agent mode:** one incremental step from an approved plan / ADR.
- **Review / Red Team pass:** separate prompt after a Tier B slice lands — see [Algorithmic & slice Done criteria](#algorithmic--slice-done-criteria); do not mark Done or start the next epic slice until High/Critical are closed or waived.
