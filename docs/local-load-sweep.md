# Local Laptop Load Sweep (10 / 20 / 50 / 100 VUs)

A capacity sweep of the same k6 load run executed from a developer laptop at four VU levels, to see how a local generator scales and how it compares to the cloud CI agents. The headline: the laptop has ample CPU/RAM headroom but is **network-bound over VPN**, so its numbers measure the client path, not the system under test (SUT). For the cloud-agent comparison this references, see [ci-agent-comparison.md](ci-agent-comparison.md); for the bottleneck principle, [load-architecture-and-workload-modeling.md](load-architecture-and-workload-modeling.md). Figures are extracted from each run's `report.html` (k6 web dashboard) and `resource-usage.csv` (OS sampler mirroring the CI `.azure/scripts/` samplers).

## Run parameters

| Parameter | Value |
|---|---|
| Script | `source/tests/load.spec.ts` (`navigation` scenario) |
| Profile | `load` — 5m ramp / 10m sustain / 2m ramp-down (~17.5 min each) |
| VU levels | 10, 20, 50, 100 (set by editing the `load` profile target per run) |
| Target env | PERF (`performance.ungerboeck.net`) **over VPN** |
| Generator | Developer laptop, ~32 GB RAM (Windows) |

Each level was a full 17.5-min run, identical in shape to the CI runs — only the peak VU count and the generator differ.

## Scaling — throughput & latency

| VUs | iterations | iter/s | http_reqs | req/s | checks % | fail % | avg ms | p95 ms | p99 ms | max ms |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 10 | 2,413 | 2.36 | 7,222 | 7.0 | 99.85 | 0.15 | 434 | 564 | 618 | 60,000 |
| 20 | 4,767 | 4.65 | 14,224 | 13.9 | 99.70 | 0.30 | 468 | 567 | 644 | 60,000 |
| 50 | 11,500 | 11.24 | 34,400 | 33.6 | 99.89 | 0.11 | 508 | 742 | 907 | 60,000 |
| 100 | 14,371 | 14.07 | 43,046 | 42.1 | 100.00 | 0.00 | 1,219 | 1,863 | 2,090 | 3,776 |

Reading:

- **Clean scaling to 50 VUs, then a plateau.** Iterations roughly track VUs from 10→50 (≈230 iters/VU), then flatten hard at 100 (14,371 — only +25% for 2× the VUs).
- **Latency stays flat then jumps.** avg/p95 hold ~430–740 ms through 50 VUs, then roughly triple at 100 (p95 1,863 ms). Each request getting slower is why throughput plateaus while VUs double.
- **Reliability is excellent throughout** (99.7–100 % checks). The `60,000 ms` max at 10/20/50 is a single 60 s HTTP timeout per run — a transient VPN blip, not a load effect (the 100 VU run had none, max 3,776 ms).

## Generator resources — idle at every level

| VUs | cpu avg % | cpu p95 % | cpu max % | ram used MB | ram % |
|---:|---:|---:|---:|---:|---:|
| 10 | 8.1 | 16.4 | 88.5 | 13,012 | 40.1 |
| 20 | 7.1 | 10.9 | 60.6 | 13,207 | 40.7 |
| 50 | 9.0 | 13.1 | 24.1 | 13,321 | 41.0 |
| 100 | 9.4 | 13.4 | 26.4 | 13,291 | 40.9 |

The laptop sat at **~9 % CPU and ~40 % RAM even at 100 VUs**. (The 88.5 % CPU max at 10 VUs is a single transient spike — p95 is only 16.4 %.) The generator was nowhere near saturation, so the plateau above is **not** the machine running out of capacity.

## 100 VU — laptop vs cloud CI agents

Same VUs, same 17.5-min profile, **different network path**. This is not an agent-capacity ranking — it is a demonstration of what a VPN link does to a load generator.

| | Laptop (VPN) | AWS agent | Momentus agent |
|---|---:|---:|---:|
| iterations | 14,371 | 24,674 | 24,924 |
| http_reqs | 43,046 | 73,869 | 74,575 |
| req rate /s | **42.1** | 72.2 | 73.0 |
| req_dur avg ms | **1,219** | 430 | 418 |
| req_dur p95 ms | **1,863** | 1,177 | 1,133 |
| req_dur p99 ms | 2,090 | 1,414 | 1,368 |
| checks % | 100 | 100 | 99.99 |
| cpu avg % | 9.4 | 13.2 | 11.9 |
| ram used avg MB | 13,291 | 2,603 | 3,432 |
| net rx avg kB/s | 806 | 1,142 | 1,154 |

The laptop pushed **~42 req/s vs the agents' ~72–73 req/s at ~2.8× the latency — while sitting at 9 % CPU with bandwidth to spare** (rx peaked at 2,677 kB/s, far above its 806 kB/s average). CPU, RAM, and bandwidth all show large headroom, so the binding constraint is the **network round-trip**: the laptop reaches PERF over VPN, whereas the cloud agents have a fast, close path to PERF. Slower per-request latency means each VU completes fewer iterations, so throughput plateaus even though the machine idles.

## Takeaway

- **The laptop is not a weak generator — it is a network-constrained one.** At 100 VUs it was 91 % idle on CPU; the ceiling was the VPN path, not the hardware.
- **This is the cardinal rule in action** (see [load-architecture-and-workload-modeling.md](load-architecture-and-workload-modeling.md)): when the generator's network is the bottleneck, you measure the client, not the SUT. Over VPN, laptop latency/throughput numbers describe the link, not the application.
- **Practical guidance:** run scripting, smoke, and small sanity loads locally; run real load numbers from the cloud CI agents ([ci-agent-comparison.md](ci-agent-comparison.md)), which give the truer read of the SUT.

Per-level artifacts (`report-<n>vu.html`, `resource-usage-<n>vu.csv/.html`, `gc-usage-<n>vu.csv/.html`) are written to `temp/reports/` (gitignored, not committed).
