# k6 Local Load Capacity

How much load a single local k6 instance can generate, the binding constraints, and concrete expectations for the dev laptop used in this project. Figures are from official Grafana k6 documentation unless noted; laptop-specific numbers are an extrapolation, not a documented benchmark.

## Official single-machine ceiling

From the [running-large-tests guide](https://grafana.com/docs/k6/latest/testing-guides/running-large-tests/):

> A single instance of k6 can run **30,000–40,000 simultaneous VUs**. In some cases, this number of VUs can generate up to **300,000 HTTP requests per second (RPS)**.

When to go multi-machine ([distributed tests](https://grafana.com/docs/k6/latest/testing-guides/running-distributed-tests/)):

> Unless you need more than **100,000–300,000 requests per second**, a single instance of k6 is likely sufficient.

Caveats on these numbers:

- Explicitly conditional — "depending on available resources," "in some cases," "up to." It assumes a **well-provisioned, OS-tuned Linux server** with many fast cores.
- Applies to **protocol (HTTP) VUs only**, not browser VUs.
- The 300k RPS is effectively a localhost best case; real network + system-under-test (SUT) response time bind you far sooner.

Distributed/multi-machine execution is recommended only when: the SUT must be hit from multiple IPs, a fully-optimized single node still cannot produce the required load, or Kubernetes is already the preferred ops environment.

## Binding constraints

### 1. CPU — usually the wall

- k6 is "heavily multi-threaded and will effectively utilize all available CPU cores." Go's `GOMAXPROCS` defaults to the logical core count.
- Grafana recommends keeping CPU utilization **under ~80%** (leave ~20% idle). Driving all cores to 100% throttles k6 itself and **distorts response-time metrics** — at that point you are measuring the load generator, not the SUT.

### 2. Memory — rarely the limit for HTTP

- Documented **~1–5 MB per simple protocol VU** (1,000 VUs ≈ 1–5 GB). Source: [running-large-tests](https://grafana.com/docs/k6/latest/testing-guides/running-large-tests/), [fine-tune-os](https://grafana.com/docs/k6/latest/set-up/fine-tune-os/).
- Tests with file uploads or large imported JS modules can hit **tens of MB per VU**, because **each VU holds its own copy of every JS module and imported data file**.
- Mitigation: [`SharedArray`](https://grafana.com/docs/k6/latest/javascript-api/k6-data/sharedarray/) shares data across VUs. Documented benchmark (100 VUs): at 100,000 data lines, **238 MB shared vs 8.3 GB unshared (~30×)**. A 30–40 MB data file imported normally is copied into every VU.
- `--compatibility-mode=base` is **no longer worth it** as a memory optimization — the historical win (dropping the core.js polyfill, ~2 MB/VU) has been baked into the default extended mode since k6 v0.31.0.

### 3. OS / network limits — hit before RAM

- Open file descriptors, **ephemeral port exhaustion**, and a **~65,535 sockets-per-IP** ceiling.
- ⚠️ All the specific tuning numbers in the k6 docs (1024 fd default, port range `32768–60999`, `ulimit`/`sysctl` commands) are **Linux-only**. On **Windows 11** the ephemeral-port range and handle limits are tuned via `netsh` and are not enumerated in the k6 docs — expect to hit Windows network limits sooner unless tuned.

## Protocol VUs vs browser VUs

Browser VUs are dramatically heavier: each k6 runner **spawns its own Chromium process** ("CPU and memory-heavy"). Rule of thumb ~**1 vCPU + 0.5–1 GB RAM per browser VU**. One community report saw >3 GB RAM and >80% CPU at just **20+ browser VUs** on an 8-core/64 GB machine. The 30k–40k figure does **not** apply to browser VUs.

## This project's laptop: Intel Core i7-1260P, 32 GB RAM, Windows 11

12 physical / 16 logical cores, ~2.1 GHz base. The numbers below are an order-of-magnitude **extrapolation** from official sizing — a mobile CPU at 2.1 GHz base with thermal/power throttling falls well short of the high-core servers the 30k–40k figure assumes.

| Workload             | Realistic on this laptop                        | Binding constraint                             |
| -------------------- | ----------------------------------------------- | ---------------------------------------------- |
| Simple HTTP API VUs  | low-thousands up to **~10,000** protocol VUs    | **CPU first**, then Windows port/socket limits |
| Requests/sec (HTTP)  | **tens of thousands RPS** (SUT-dependent)       | CPU + SUT response time                        |
| Browser/Chromium VUs | **~5–20**                                       | CPU + RAM per browser process                  |
| RAM                  | not the limit — covers ~6,000–30,000 simple VUs | —                                              |

**Bottom line:** for HTTP API load testing this laptop can realistically push a few thousand VUs / tens of thousands of RPS before CPU saturates — plenty for most API perf work. CPU is the wall, not the 32 GB RAM.

Practical reminders:

- Watch CPU during runs and keep it <80%. If k6's own CPU pegs, the latency numbers reflect the laptop, not the SUT.
- Real-network reality check: against QE over VPN, SUT response time and network bandwidth bind you long before k6 does. Treat 300k RPS as irrelevant to over-the-network testing.
- Use `SharedArray` for anything in `data/` that grows, to avoid per-VU copies.

## Sources

- https://grafana.com/docs/k6/latest/testing-guides/running-large-tests/
- https://grafana.com/docs/k6/latest/testing-guides/running-distributed-tests/
- https://grafana.com/docs/k6/latest/set-up/fine-tune-os/
- https://grafana.com/docs/k6/latest/javascript-api/k6-data/sharedarray/
- https://grafana.com/docs/k6/latest/set-up/set-up-distributed-k6/browser-tests/
- https://grafana.com/docs/k6/latest/using-k6/javascript-typescript-compatibility-mode/
