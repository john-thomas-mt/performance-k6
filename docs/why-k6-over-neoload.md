# Why k6 Over NeoLoad — Decision Summary

The case for moving Momentus Enterprise performance testing off Tricentis NeoLoad and onto Grafana
k6. This is the spine document: it states the decision, the reasons in priority order, and the risks,
then points to the detailed topic docs for the evidence behind each claim. Audience is leadership — cost,
risk, and strategic fit lead; the depth lives in the linked docs.

## The decision in one line

Replace a proprietary, GUI-authored, per-seat-and-per-VU-licensed tool (NeoLoad) with an open-source,
code-authored, self-hosted engine (k6) that runs on CI/CD agents we already own and is authorable and
maintainable with AI assistance — recovering the recurring license spend and collapsing the per-release
maintenance effort, with no loss of measurement fidelity.

## What each tool is

|                   | NeoLoad (today)                                                             | k6 (proposed)                                                   |
| ----------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Vendor / license  | Tricentis (commercial, proprietary); NeoLoad 2024.1                         | Grafana Labs; **AGPL-3.0 open source**, free binary             |
| Authoring         | GUI ("User Paths"), stored as an XML project tree                           | TypeScript/JavaScript code in a normal git repo                 |
| Where load runs   | NeoLoad controller + load generators, orchestrated via **NeoLoad Web SaaS** | A single k6 binary on **our own CI/CD agents** (or any laptop)  |
| Results / storage | NeoLoad Web SaaS (hosted)                                                   | Local HTML report; optional Grafana Cloud free tier             |
| Versioning model  | Per-release **script duplication** (a full copy per version)                | One parameterized script; version handled by config             |
| Who can author    | Performance engineers with the NeoLoad GUI + a seat                         | Any engineer with the repo — and Claude, driving the same tools |

Sources for the NeoLoad side: the Enterprise Performance Suite `README.md` and project tree in the
sibling `performance` repo. Sources for the k6 side: [Grafana k6 documentation](https://grafana.com/docs/k6/latest/)
and the [k6 license](https://github.com/grafana/k6/blob/master/LICENSE.md).

## Why — in priority order

### 1. Cost: stop paying recurring license fees; reuse hardware we already own

NeoLoad is a recurring commercial cost — the tool license, NeoLoad Web SaaS, and cloud load-generator
capacity all bill on a subscription/usage basis. k6 is free and open source, and the load runs on the
**self-hosted CI/CD agents the org already operates**. We have already proven those agents carry the
load with large headroom to spare. The cost model is in [cost-comparison.md](./cost-comparison.md), with
the measured agent evidence in [running-load-on-our-agents.md](./running-load-on-our-agents.md).

### 2. AI-assisted authoring and maintenance

Because k6 tests are **plain TypeScript in a git repo**, Claude can author, port, verify, and maintain
them end-to-end using the same browser and CLI tools an engineer uses. NeoLoad's GUI/XML model has no
equivalent surface for an AI agent to drive reliably. This is the largest force-multiplier in the
switch and the reason the migration itself is tractable — see [ai-assisted-authoring.md](./ai-assisted-authoring.md).

### 3. Open architecture, no vendor lock-in

k6 is a single Go binary running lightweight goroutine-based virtual users, scriptable in TS/JS and
extensible in Go (xk6). It is CLI-first and integrates into any CI system without a proprietary
controller or SaaS orchestrator. The design, capacity, load-modeling guidance, and the open-source
posture are covered in [k6-architecture-and-open-source.md](./k6-architecture-and-open-source.md).

### 4. Runs natively on our CI/CD agents

Load executes on the org's existing self-hosted Azure pipeline agents (and, for comparison, an AWS
agent) with no special infrastructure. Both agents were tested at 100 VUs and sat well under 20% CPU —
ample room to push further, and the laptop is network-bound over VPN rather than underpowered, so
scripting stays local while real load comes from the agents. Evidence in
[running-load-on-our-agents.md](./running-load-on-our-agents.md).

### 5. Maintainability: parameterize instead of re-record

NeoLoad's blanket "re-record per release" policy produces a full duplicate script per version. Analysis
of the NeoLoad tree showed those per-version copies are **mechanical duplicates, not real re-recordings**
— the only genuine drift across three releases was a single grid-column index shift. k6 handles this
with one parameterized script plus a version-matrix check, eliminating the duplication entirely. The
conversion approach and the roadmap to a fully migrated suite are in
[conversion-strategy-and-roadmap.md](./conversion-strategy-and-roadmap.md).

## What does _not_ change

- **The environment and the app under test** — same PERF environment, same version matrix.
- **Measurement fidelity** — the same journeys, thresholds, and SLAs; the AWS-vs-Momentus agent run
  showed identical application behaviour regardless of generator.
- **The load model** — the batch-rotation suite and progressive standalone model from the performance
  strategy are reproduced in k6 profiles, not abandoned (see
  [conversion-strategy-and-roadmap.md](./conversion-strategy-and-roadmap.md) and
  [k6-architecture-and-open-source.md](./k6-architecture-and-open-source.md)).

## Risks and how they're handled

| Risk                                                              | Mitigation                                                                                                                                                                                                                                                                                                                                                                                                               |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| No hosted results store like NeoLoad Web                          | Every run writes a self-contained HTML report. If we want hosted dashboards and retention, Grafana Cloud's free tier covers it. See [k6-reporting-approaches.md](./k6-reporting-approaches.md) for the reporting options and [cost-comparison.md](./cost-comparison.md) for the cost model.                                                                                                                              |
| Migration effort for the full suite                               | The port is phased and AI-assisted, with a per-journey verify gate before anything is trusted. Most per-version NeoLoad scripts collapse into a single k6 script, so the real effort is far smaller than the raw script count suggests. See [conversion-strategy-and-roadmap.md](./conversion-strategy-and-roadmap.md).                                                                                                  |
| Hosted, visual per-group timing breakdown weaker than NeoLoad Web | Per-group timings are already available in the terminal with no new code — k6 emits a `group_duration` metric per group, shown in the end-of-test summary under `--summary-mode full`. What's weaker is the _hosted, visual_ breakdown NeoLoad Web gives out of the box; if that becomes a regular need, a local Grafana + Prometheus setup provides it. See [k6-reporting-approaches.md](./k6-reporting-approaches.md). |

## Where to go next

The whole `docs/` set is indexed in [README.md](./README.md). For the full detail behind each point,
read the linked topic docs above in the order they appear.
