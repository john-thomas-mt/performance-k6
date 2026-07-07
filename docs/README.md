# Momentus k6 Performance — Docs

The detailed reference docs behind the k6 performance-testing project. Each doc is a self-contained,
in-depth treatment of one topic — together they make **the case for switching to k6 and record how the
migration is done**. The measured data, sourced rationale, and the migration tracker all live here.

Start with [why-k6-over-neoload.md](./why-k6-over-neoload.md) — it is the overview and links to
everything else in reading order.

## Topic docs — the case for k6 over NeoLoad

| Doc                                                                        | Topic                                                                                                                                    |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| [why-k6-over-neoload.md](./why-k6-over-neoload.md)                         | Overview — the one-line thesis, reasons in priority order, risks                                                                         |
| [ai-assisted-authoring.md](./ai-assisted-authoring.md)                     | Using Claude for performance testing, and why k6's code-in-git model fits                                                                |
| [k6-architecture-and-open-source.md](./k6-architecture-and-open-source.md) | k6's design, single-machine capacity, load-generation & workload modeling, and its open-source (AGPL) nature                             |
| [running-load-on-our-agents.md](./running-load-on-our-agents.md)           | Running load on our own CI/CD agents — agent-vs-agent proof, laptop sweep, why it's the accessibility win                                |
| [cost-comparison.md](./cost-comparison.md)                                 | NeoLoad license/SaaS/metered-LG vs free k6 on owned agents (framework + placeholders), plus the Grafana Cloud cost model                 |
| [conversion-strategy-and-roadmap.md](./conversion-strategy-and-roadmap.md) | How NeoLoad scripts convert to k6 (filtering to the transaction spine), the live migration tracker, and the phased plan to full coverage |
| [k6-reporting-approaches.md](./k6-reporting-approaches.md)                 | Reporting options evaluated and why the built-in web dashboard was kept                                                                  |

## Project reference

| Doc                                              | What it covers                                                                                         |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| [codebase-structure.md](./codebase-structure.md) | How the `source/` test suite is organized — layers, dependency order, and how a run flows through them |

## Conventions for these docs

- Factual claims about a tool cite that tool's **official documentation** (linked in each doc's Sources).
- The migration backlog is a living tracker inside
  [conversion-strategy-and-roadmap.md](./conversion-strategy-and-roadmap.md); the NeoLoad `team/vus/`
  tree in the sibling `performance` repo is the authoritative flow set it mirrors.
- Docs are written for a leadership audience, with the engineering depth kept in-line rather than split
  into separate appendices.
