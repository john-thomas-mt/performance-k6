# Momentus k6 Performance — Docs

The detailed reference docs behind the k6 performance-testing project. Each doc is a self-contained,
in-depth treatment of one topic — together they make **the case for switching to k6 and record how the
migration is done**. The measured data, sourced rationale, and the migration tracker all live here.

Start with [why-k6-over-neoload.md](./why-k6-over-neoload.md) — it is the overview and links to
everything else in reading order.

## Topic docs — the case for k6 over NeoLoad

| Doc                                                                        | Topic                                                                                                                    |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| [why-k6-over-neoload.md](./why-k6-over-neoload.md)                         | Overview — the one-line thesis, reasons in priority order, risks                                                         |
| [ai-assisted-authoring.md](./ai-assisted-authoring.md)                     | Using Claude for performance testing, and why k6's code-in-git model fits                                                |
| [k6-architecture-and-open-source.md](./k6-architecture-and-open-source.md) | k6's design, single-machine capacity, load-generation & workload modeling, and its open-source (AGPL) nature             |
| [running-load-on-our-agents.md](./running-load-on-our-agents.md)           | Running load on our own CI/CD agents — agent-vs-agent proof, laptop sweep, why it's the accessibility win                |
| [cost-comparison.md](./cost-comparison.md)                                 | NeoLoad license/SaaS/metered-LG vs free k6 on owned agents (framework + placeholders), plus the Grafana Cloud cost model |
| [k6-reporting-approaches.md](./k6-reporting-approaches.md)                 | Reporting options evaluated and why the built-in web dashboard was kept                                                  |

## Project reference

| Doc                                                                      | What it covers                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [codebase-structure.md](./codebase-structure.md)                         | How the `source/` test suite is organized — layers, dependency order, and how a run flows through them                                                                                                                                                                                             |
| [runtime-correlated-payloads.md](./runtime-correlated-payloads.md)       | Design & risk analysis for fetching save payloads at runtime instead of hardcoding column tables — metric-skew and bug-coverage risks, with live evidence                                                                                                                                          |
| [neoload-timing-parity.md](./neoload-timing-parity.md)                   | The measured runs behind matching k6 `group_duration` to NeoLoad transaction time, and the per-page-batching model they led to (superseded on the connection-reuse question by the doc below)                                                                                                      |
| [neoload-connection-reuse-model.md](./neoload-connection-reuse-model.md) | Why NeoLoad reused connections (it ran over HTTP/2), so keep-alive-off was never a faithful match; the finding that retired the `noConnReuse` / `batchPerHost` / `forceHttp1` knobs                                                                                                                |
| [ci-pipelines.md](./ci-pipelines.md)                                     | The two Azure Pipelines in `.azure/workflows/` — queue-time parameters, secret handling, and the reasoning behind each step of the load-run pipeline (the YAML itself is comment-free)                                                                                                             |
| [datadog-live-metrics.md](./datadog-live-metrics.md)                     | Streaming live run metrics to Datadog for an in-flight health view — the agentless OTLP route, what was measured, the query rules averages and percentiles depend on, why the metrics avoid the k6 integration's namespace, the manual percentile toggle, and why the artifacts stay authoritative |

## Conventions for these docs

- Factual claims about a tool cite that tool's **official documentation** (linked in each doc's Sources).
- Docs are written for a leadership audience, with the engineering depth kept in-line rather than split
  into separate appendices.
