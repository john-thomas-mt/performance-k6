# Load Generation Architecture & Workload Modeling

Best-practice guidance for two decisions that get conflated: **how** load is generated (one process/machine vs many) and **how** the workload is composed (journeys blended concurrently vs run in isolation). Drawn from k6, Gatling, JMeter, and general performance-testing guidance — not k6 alone. For the single-machine capacity numbers this references, see [k6-local-load-capacity.md](./k6-local-load-capacity.md).

These are independent axes. "Single vs multiple processes" only has a right answer once you say _which_ axis you mean.

## Axis 1 — Generation topology: single generator vs distributed

**Default to a single load generator; distribute only when you outgrow it.** Consistent across k6, Gatling, and JMeter. Async/event-driven tools (k6 goroutines, Gatling actors, Locust gevent) push very high load from one process; JMeter's thread-per-VU model saturates sooner. k6's own ceiling and the threshold at which distribution becomes necessary live in [k6-local-load-capacity.md](./k6-local-load-capacity.md) — the short version is that a single node covers far more than this project needs.

**The cardinal rule: the load generator must never become the bottleneck.** If it saturates, you measure the client, not the system under test (SUT). In practice:

- Keep the generator **below ~80% CPU** (100% CPU throttles the tool and distorts latency).
- Watch **network throughput**, **ephemeral ports** (~65k sockets per source IP), and **file descriptors**.
- Run the generator on a **machine separate from the SUT**.

**Distribute across multiple machines only when:**

1. You genuinely exceed one node's capacity, **or**
2. You need **geographic distribution** / traffic from **multiple source IPs** — single-source load can hide bottlenecks that only surface with distributed origins.

Distribution is coordinated by a controller (JMeter controller-worker, k6-operator on Kubernetes, Gatling Enterprise clustering) that aggregates results. That coordination/aggregation cost is why you don't reach for it early.

**Anti-pattern:** spawning multiple load-generating processes on the _same_ machine to "add load." They contend for the same CPU, NIC, and port range — you don't get more load, you get a noisier generator. Multiple processes are only meaningful spread across multiple **machines**.

## Axis 2 — Workload composition: blended vs isolated

**Model production reality: a blended concurrent mix — but keep it one coherent workload, and keep test _types_ separate.**

- **Run different journeys concurrently as one blended workload** for capacity/stress tests. That is what production is — many journeys hitting the system at once. Only a blended run surfaces real interaction effects: DB lock contention across operation types, shared-cache eviction, connection-pool exhaustion. Per-journey-in-a-vacuum runs miss them.
- **Also keep isolated single-journey runs — for a different purpose:** clean per-endpoint SLA baselines and regression detection, where cross-journey noise is unwanted.
- **Do not mix workload _models_ or test _types_ in one run.** Keep load, stress, and soak in separate suites — different shapes, durations, and success criteria.

### Open vs closed models

The model must match the SUT's real traffic; they cannot be blended in one test.

- **Open model** — new VUs arrive at a fixed _rate_ regardless of system state (public/unbounded traffic; arrival-rate executors). Use for public-facing APIs.
- **Closed model** — a fixed concurrent population; a new VU starts only as one finishes. Use for controlled populations (ticketing, call centers).

Testing an open system with a closed model produces artificially optimistic results, because real users don't slow their arrival rate when the system slows.

## How this maps to this repo

The two axes together **reinforce** the single-process, multi-scenario design, rather than pointing at splitting:

- **Generation:** the target is an internal QE app, well under the threshold where distribution is warranted — so a **single k6 process** is the correct generator. The Windows resource sampler captured during runs is the generator-headroom monitoring this guidance requires; keep watching CPU/network on the generator during load runs.
- **Composition (load):** a realistic load test _wants_ the journeys running **concurrently in one process** — exactly what k6 `scenarios` in one entry file provide, which also preserves the single shared `setup()`. So the single-process blended-scenario model isn't just a k6 convenience; it's the performance-fidelity-correct way to model blended production load.
- **Composition (drift gate):** the smoke aggregate is a **correctness/drift** check (one iteration per journey), **not** a load test — isolation there is about clean per-endpoint verification, not load generation.

Reach for distribution (multiple machines) only if the app under test ever needs load beyond a single node's capacity, or origin traffic from multiple IPs — not by spawning parallel processes on one box.

## Sources

- https://grafana.com/docs/k6/latest/testing-guides/running-large-tests/
- https://grafana.com/docs/k6/latest/testing-guides/running-distributed-tests/
- https://gatling.io/blog/workload-models-in-load-testing
- https://gatling.io/blog/scalability-testing
- https://learn.microsoft.com/en-us/azure/well-architected/performance-efficiency/performance-test
- https://stormforge.io/blog/open-closed-workloads/
- https://abstracta.us/blog/performance-testing/workload-load-scenario-performance-testing/
- https://testkube.io/glossary/distributed-load-testing
