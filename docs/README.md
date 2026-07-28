# Documentation index

## Project narrative

| Doc | Role |
|-----|------|
| **[PROJECT_SUMMARY.md](PROJECT_SUMMARY.md)** | **PoC baseline (frozen)** — presentation history through QA remediation |
| **[PRODUCT_ROADMAP.md](../PRODUCT_ROADMAP.md)** | **Active product roadmap** — phases, ADR 0100+, implementation order |

## Architecture decisions (ADRs)

### PoC (0001–0004) — frozen contracts

| ADR | Topic |
|-----|-------|
| [0001 — Mesh model and topology](decisions/0001-mesh-model-and-topology.md) | Mesh representation, seams, topology contracts |
| [0002 — Unfold Step 1 (hinge island)](decisions/0002-unfold-step-1-hinge-island.md) | Triangle-soup unfold, BFS hinge placement |
| [0003 — Unfold quality detection](decisions/0003-unfold-quality-detection.md) | Intra-island collision (3a) + edge tears (3b), detect-and-report |
| [0004 — Tech-debt remediation strategy](decisions/0004-tech-debt-remediation-strategy.md) | QA remediation policy (selectors vs workers, visual QA gates) |

### Product (0100+) — post-PoC

Product ADRs are numbered **from 0100** to separate product architecture from the PoC record. They may `depends_on` PoC ADRs but should not rewrite PoC history in [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md).

| ADR | Topic |
|-----|-------|
| [0100 — Freeform cut strokes](decisions/0100-freeform-cut-strokes.md) | *Next — overlay strokes, lazy materialize on Flatten* |

## Plans

| Track | Location |
|-------|----------|
| PoC specs (complete) | [plans/README.md](plans/README.md) + [plans/archive/](plans/archive/) |
| Product specs | Linked from [PRODUCT_ROADMAP.md](../PRODUCT_ROADMAP.md) |

Optional local notes: [thoughts.txt](../thoughts.txt) (gitignored).

For agent and contributor workflow, see [AGENTS.md](../AGENTS.md) at the repo root.
