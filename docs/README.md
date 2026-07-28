# Documentation index

## Project narrative

**[PROJECT_SUMMARY.md](PROJECT_SUMMARY.md)** — PoC scope, phased delivery, deferred work, and human + Cursor workflow (presentation-oriented).

## Architecture decisions (ADRs)

| ADR | Topic |
|-----|-------|
| [0001 — Mesh model and topology](decisions/0001-mesh-model-and-topology.md) | Mesh representation, seams, topology contracts |
| [0002 — Unfold Step 1 (hinge island)](decisions/0002-unfold-step-1-hinge-island.md) | Triangle-soup unfold, BFS hinge placement |
| [0003 — Unfold quality detection](decisions/0003-unfold-quality-detection.md) | Intra-island collision (3a) + edge tears (3b), detect-and-report |
| [0004 — Tech-debt remediation strategy](decisions/0004-tech-debt-remediation-strategy.md) | QA remediation policy (selectors vs workers, visual QA gates) |

## Plans & roadmap

**Single folder for plans:** **[plans/README.md](plans/README.md)** (status table + links). Specs live in [plans/archive/](plans/archive/) — geometry phases and UI shell plans together. Do not keep the only copy under `.cursor/plans/`.

**Backlog:** **Planned** rows in [plans/README.md](plans/README.md). Optional local notes: [thoughts.txt](../thoughts.txt) (gitignored).

For agent and contributor workflow, see [AGENTS.md](../AGENTS.md) at the repo root.
