# k6 Architecture, Capacity & Open-Source Nature

How k6 is built, how much load one instance can actually generate, how load generation and workload
composition should be structured, and why k6's open-source design is a strategic advantage over
NeoLoad's proprietary, licensed stack. Facts about k6 internals and capacity are from official Grafana
k6 documentation (linked at the end); the load-architecture guidance draws on k6, Gatling, JMeter, and
general performance-testing practice.

## 1. What k6 is, architecturally

k6 is a **single self-contained binary written in Go**. There is no controller to install, no agent
service to license, no SaaS orchestrator required. You give the binary a script and it runs the test.

The pieces that matter:

| Element                   | What it is                                                                                                                         | Why it matters here                                                                                                 |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Go core**               | The engine is written in Go, a compiled, highly concurrent language                                                                | High load from one process; no JVM/runtime to provision                                                             |
| **Goroutine-based VUs**   | Each virtual user is a lightweight goroutine, not an OS thread                                                                     | Thousands of VUs from one modest machine (see §2)                                                                   |
| **Sobek JS/TS runtime**   | An embedded JavaScript engine (Sobek) runs the test scripts; TypeScript is transpiled (types stripped)                             | Tests are ordinary TS/JS — the basis for AI authoring, see [ai-assisted-authoring.md](./ai-assisted-authoring.md)   |
| **Scenarios + executors** | Declarative workload shapes (constant/ramping VUs, constant/ramping arrival rate, per-VU/shared iterations, externally-controlled) | The production load model is expressed as config, not GUI clicks (see §3)                                           |
| **xk6 extensions**        | The Go core can be extended with community/custom modules                                                                          | No vendor gatekeeping on new protocols or outputs                                                                   |
| **Pluggable outputs**     | Results stream to HTML, JSON/CSV, Prometheus, Grafana Cloud, etc.                                                                  | We choose where results go — no mandated SaaS store, see [k6-reporting-approaches.md](./k6-reporting-approaches.md) |

Because it is one binary that is CLI-first, k6 drops into any CI system as a normal command. That is
why it runs on the org's existing self-hosted agents with no special infrastructure
(see [running-load-on-our-agents.md](./running-load-on-our-agents.md)).

### A note on TypeScript

k6 runs TS by stripping the types at parse time (TypeScript is enabled by default from k6 v0.57) — it
does **not** type-check. This repo therefore keeps a `tsc --noEmit` compilation gate in CI as the only
check that catches type errors, since `k6 inspect` never will. This is a deliberate, documented
arrangement, not a gap.

## 2. How much load one k6 instance can generate

### The official single-machine ceiling

From the Grafana [running-large-tests guide](https://grafana.com/docs/k6/latest/testing-guides/running-large-tests/):

> A single instance of k6 can run **30,000–40,000 simultaneous VUs**. In some cases, this number of VUs
> can generate up to **300,000 HTTP requests per second (RPS)**.

And on when a single instance is enough (same [running-large-tests guide](https://grafana.com/docs/k6/latest/testing-guides/running-large-tests/)):

> Unless you need more than **100,000–300,000 requests per second**, a single instance of k6 is likely
> sufficient.

Caveats on those numbers:

- They are explicitly conditional — "depending on available resources," "in some cases," "up to." They
  assume a **well-provisioned, OS-tuned Linux server** with many fast cores.
- They apply to **protocol (HTTP) VUs only**, not browser VUs.
- The 300k RPS is effectively a localhost best case; real network + system-under-test (SUT) response
  time bind you far sooner.

Distributed/multi-machine execution is warranted only when the SUT must be hit from multiple IPs, a
fully-optimized single node still cannot produce the required load, or Kubernetes is already the
preferred ops environment ([running distributed tests](https://grafana.com/docs/k6/latest/testing-guides/running-distributed-tests/)).
This suite is far below any of those thresholds.

### Binding constraints

**CPU — usually the wall.** k6 is heavily multi-threaded and uses all available cores (Go's
`GOMAXPROCS` defaults to the logical core count). Grafana recommends keeping CPU utilization **under
~80%** — driving all cores to 100% throttles k6 itself and **distorts response-time metrics**, at which
point you are measuring the load generator, not the SUT.

**Memory — rarely the limit for HTTP.** Documented **~1–5 MB per simple protocol VU** (1,000 VUs ≈ 1–5
GB). Tests with file uploads or large imported JS modules can hit **tens of MB per VU**, because each
VU holds its own copy of every JS module and imported data file. Mitigation: `SharedArray` shares data
across VUs — a documented 100-VU benchmark at 100,000 data lines used **238 MB shared vs 8.3 GB
unshared (~30×)**. (`--compatibility-mode=base` is **no longer** a useful memory optimization — the
historical win was baked into the default since k6 v0.31.0.)

**OS / network limits — hit before RAM.** Open file descriptors, **ephemeral port exhaustion**, and a
**~65,535 sockets-per-IP** ceiling. All the specific tuning numbers in the k6 docs (fd defaults, port
ranges, `ulimit`/`sysctl`) are **Linux-only**; on **Windows 11** the equivalents are tuned via `netsh`,
so expect to hit Windows network limits sooner unless tuned.

### Protocol VUs vs browser VUs

Browser VUs are dramatically heavier: each runner **spawns its own Chromium process**. Rule of thumb
~**1 vCPU + 0.5–1 GB RAM per browser VU**; one community report saw >3 GB RAM and >80% CPU at just
**20+ browser VUs** on an 8-core/64 GB machine. The 30k–40k figure does **not** apply to browser VUs.
This suite is protocol-based, so the high ceiling applies.

### What this means for the project's hardware

The developer laptop used here is an Intel Core i7-1260P, 32 GB RAM, Windows 11 (12 physical / 16
logical cores, ~2.1 GHz base). The figures below are an order-of-magnitude **extrapolation** from
official sizing — a mobile CPU at 2.1 GHz falls well short of the high-core servers the 30k–40k figure
assumes:

| Workload             | Realistic on this laptop                        | Binding constraint                             |
| -------------------- | ----------------------------------------------- | ---------------------------------------------- |
| Simple HTTP API VUs  | low-thousands up to **~10,000** protocol VUs    | **CPU first**, then Windows port/socket limits |
| Requests/sec (HTTP)  | **tens of thousands RPS** (SUT-dependent)       | CPU + SUT response time                        |
| Browser/Chromium VUs | **~5–20**                                       | CPU + RAM per browser process                  |
| RAM                  | not the limit — covers ~6,000–30,000 simple VUs | —                                              |

**Bottom line:** for HTTP API load testing this laptop can push a few thousand VUs / tens of thousands
of RPS before CPU saturates — plenty for most API perf work, and far beyond this suite's needs. CPU is
the wall, not the 32 GB RAM. In practice, though, over-VPN network round-trip binds a laptop long
before k6 does — which is why real load numbers come from the CI agents, not the laptop (see
[running-load-on-our-agents.md](./running-load-on-our-agents.md)).

## 3. How load is generated and composed

Two decisions get conflated and must be kept separate: **how** load is generated (one process/machine
vs many) and **how** the workload is composed (journeys blended concurrently vs run in isolation).
They are independent axes.

### Axis 1 — generation topology: single vs distributed

**Default to a single load generator; distribute only when you outgrow it.** This is consistent across
k6, Gatling, and JMeter. Async/event-driven tools (k6 goroutines, Gatling actors, Locust gevent) push
very high load from one process; JMeter's thread-per-VU model saturates sooner.

**The cardinal rule: the load generator must never become the bottleneck.** If it saturates, you
measure the client, not the SUT. In practice:

- Keep the generator **below ~80% CPU** (100% CPU throttles the tool and distorts latency).
- Watch **network throughput**, **ephemeral ports** (~65k sockets per source IP), and **file descriptors**.
- Run the generator on a **machine separate from the SUT**.

**Distribute across multiple machines only when** you genuinely exceed one node's capacity, **or** you
need geographic distribution / traffic from multiple source IPs (single-source load can hide
bottlenecks that only surface with distributed origins). Distribution is coordinated by a controller
(JMeter controller-worker, k6-operator on Kubernetes, Gatling Enterprise clustering) whose
coordination/aggregation cost is why you don't reach for it early.

**Anti-pattern:** spawning multiple load-generating processes on the _same_ machine to "add load." They
contend for the same CPU, NIC, and port range — you get a noisier generator, not more load. Multiple
processes are only meaningful spread across multiple **machines**.

### Axis 2 — workload composition: blended vs isolated

**Model production reality: a blended concurrent mix — but keep it one coherent workload, and keep test
_types_ separate.**

- **Run different journeys concurrently as one blended workload** for capacity/stress tests. That is
  what production is — many journeys hitting the system at once. Only a blended run surfaces real
  interaction effects: DB lock contention across operation types, shared-cache eviction, connection-pool
  exhaustion. Per-journey-in-a-vacuum runs miss them.
- **Also keep isolated single-journey runs — for a different purpose:** clean per-endpoint SLA baselines
  and regression detection, where cross-journey noise is unwanted.
- **Do not mix workload _models_ or test _types_ in one run.** Keep load, stress, and soak in separate
  suites — different shapes, durations, and success criteria.

**Open vs closed models** must match the SUT's real traffic and cannot be blended in one test. An
**open model** admits new VUs at a fixed _rate_ regardless of system state (public/unbounded traffic;
arrival-rate executors) — use for public-facing APIs. A **closed model** holds a fixed concurrent
population; a new VU starts only as one finishes — use for controlled populations. Testing an open
system with a closed model produces artificially optimistic results, because real users don't slow
their arrival rate when the system slows.

### How this maps to this repo

The two axes together **reinforce** the single-process, multi-scenario design rather than pointing at
splitting:

- **Generation:** the target is an internal QE app, well under the threshold where distribution is
  warranted — so a **single k6 process** is the correct generator. The Windows resource sampler
  captured during runs is the generator-headroom monitoring this guidance requires.
- **Composition (load):** a realistic load test _wants_ the journeys running **concurrently in one
  process** — exactly what k6 `scenarios` in one entry file provide, which also preserves the single
  shared `setup()`. So the single-process blended-scenario model isn't just a k6 convenience; it's the
  performance-fidelity-correct way to model blended production load.
- **Composition (drift gate):** the smoke aggregate is a **correctness/drift** check (one iteration per
  journey), **not** a load test — isolation there is about clean per-endpoint verification.

Reach for distribution (multiple machines) only if the app under test ever needs load beyond a single
node's capacity, or origin traffic from multiple IPs — not by spawning parallel processes on one box.

## 4. Open source: what it buys us

k6 is distributed under the **AGPL-3.0 license** and maintained by **Grafana Labs**. For a testing tool
we run internally against our own application, the practical consequences are all upside:

- **No license fee, no seat limit.** Every engineer — and the AI — can author and run tests. Contrast
  NeoLoad, where authoring needs the licensed GUI and a seat.
- **No usage metering.** We are not billed per virtual-user-hour or per cloud load-generator minute to
  run load on our own hardware.
- **No vendor lock-in.** The source is open, the format is code in git, and the extension path (xk6) is
  open. If Grafana's commercial offering ever stops fitting, the engine and our tests are unaffected.
- **Transparency and community.** Behaviour is verifiable in the source; the ecosystem of extensions,
  examples, and documentation is public.

### The AGPL question, addressed

AGPL-3.0's copyleft obligations are triggered by **distributing** the software or **offering it as a
network service to third parties**. Our use is neither: we run the unmodified k6 binary as an internal
tool to test our own application, and we do not ship a modified k6 to anyone. This is the ordinary,
intended way to use k6 and carries no distribution obligation. (If the org ever chose to fork and
distribute a modified k6, that would be a different conversation — it is not on the table.)

## 5. The contrast with NeoLoad's model

| Dimension                | NeoLoad (proprietary)                   | k6 (open source)                                |
| ------------------------ | --------------------------------------- | ----------------------------------------------- |
| Source                   | Closed                                  | Open (AGPL-3.0), auditable                      |
| Cost to run our own load | Recurring license + SaaS + LG capacity  | Free binary on owned hardware                   |
| Orchestration            | NeoLoad controller + NeoLoad Web SaaS   | None required — a CLI command in CI             |
| Extensibility            | Vendor-controlled                       | Open (xk6), plus any JS/TS library-style module |
| Test artifact            | GUI-built XML project                   | TypeScript in git                               |
| Lock-in                  | High (tool, format, and hosted results) | Low (open format, self-hosted)                  |

The architecture and the licensing reinforce the same conclusion the rest of the docs reach from cost
and workflow angles: k6 puts the org in control of its own performance testing — the hardware, the
data, the tests, and the tooling — instead of renting all four.

## Sources

- [Grafana k6 documentation](https://grafana.com/docs/k6/latest/)
- [k6 license — AGPL-3.0](https://github.com/grafana/k6/blob/master/LICENSE.md)
- [k6 JavaScript/TypeScript compatibility mode](https://grafana.com/docs/k6/latest/using-k6/javascript-typescript-compatibility-mode/)
- [k6 scenarios & executors](https://grafana.com/docs/k6/latest/using-k6/scenarios/)
- [k6 extensions (xk6)](https://grafana.com/docs/k6/latest/extensions/)
- [Running large tests — single-instance capacity](https://grafana.com/docs/k6/latest/testing-guides/running-large-tests/)
- [Running distributed tests](https://grafana.com/docs/k6/latest/testing-guides/running-distributed-tests/)
- [Fine-tune OS](https://grafana.com/docs/k6/latest/set-up/fine-tune-os/)
- [SharedArray](https://grafana.com/docs/k6/latest/javascript-api/k6-data/sharedarray/)
- [Browser tests — distributed setup](https://grafana.com/docs/k6/latest/set-up/set-up-distributed-k6/browser-tests/)
- [Gatling — workload models](https://gatling.io/blog/workload-models-in-load-testing) · [scalability testing](https://gatling.io/blog/scalability-testing)
- [Microsoft Well-Architected — performance testing](https://learn.microsoft.com/en-us/azure/well-architected/performance-efficiency/performance-test)
- [StormForge — open vs closed workloads](https://stormforge.io/blog/open-closed-workloads/)
