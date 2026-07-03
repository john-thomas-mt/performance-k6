# CI Agent Comparison — AWS Agent vs. Azure Custom Momentus Agent

Side-by-side of the same k6 load run executed on two different self-hosted CI agents, to decide whether the agent choice affects results or throughput headroom. Both runs used the identical script, scenario, profile, and thresholds — only the executing agent differs. Figures are extracted from each run's `report.html` (application metrics), `resource-usage.csv` (agent OS metrics), and `gc-usage.csv` (k6 Go-runtime metrics). For the same run executed locally from a laptop across a 10→100 VU sweep — and why its numbers reflect the VPN network path rather than the SUT — see [local-load-sweep.md](local-load-sweep.md).

## Run parameters — identical across both

| Parameter | Value |
|---|---|
| Script | `source/tests/load.spec.ts` |
| Scenario | `navigation` |
| Profile | `load` — 5m ramp / 10m sustain / 2m ramp-down |
| Peak VUs | 100 |
| Wall duration | ~17.5 min (endOffset 1,050,000 ms) |
| Thresholds | `checks rate>0.95`, `http_req_failed rate<0.05`, tagged `http_req_duration p(95)` limits (2–3 s) |

The only difference is the executing agent:

| | AWS Agent | Momentus Agent (Azure custom) |
|---|---|---|
| Work dir | `C:/NeoLoad/_work/1/s` | `C:/AZE1-CICD-02/vsts-agent-win-x64-3.245.0/_work/2/s` |
| Total RAM (derived from used/percent) | **~32 GB** | **~16 GB** |
| CPU baseline (idle sample) | ~5% | ~3% |

## Application performance — functionally equivalent

Both runs passed: **100% checks, 0% request failures**, well under all latency thresholds. The system under test behaved the same regardless of agent; the Momentus agent's app-side latency was marginally *lower* (within run-to-run noise).

### Throughput & reliability

| Metric | AWS | Momentus | Δ |
|---|---:|---:|---:|
| Iterations | 24,674 | 24,924 | +1.0% |
| HTTP requests | 73,869 | 74,575 | +1.0% |
| Request rate | 72.2/s | 73.0/s | +1.1% |
| Data received | 1.14 GB | 1.15 GB | +0.7% |
| Data sent | 57.1 MB | 57.0 MB | −0.2% |
| Checks passed | 100% | 100% | 0 |
| Requests failed | 0% | 0% | 0 |

### Response time — `http_req_duration` (ms)

| Stat | AWS | Momentus | Δ |
|---|---:|---:|---:|
| avg | 429.8 | 417.9 | −2.8% |
| med | 284.7 | 284.5 | −0.1% |
| p90 | 1,040 | 998 | −4.0% |
| p95 | 1,177 | 1,133 | −3.8% |
| p99 | 1,414 | 1,368 | −3.3% |
| max | 2,245 | 2,211 | −1.5% |

`http_req_waiting` (pure server TTFB) tracks this within ±0.1% of `http_req_duration`, confirming the difference is server-response time, not client overhead. Per-group `http_req_duration` p95 was likewise 3–4% lower on Momentus for both **1. Login** (1,333 → 1,292 ms) and **3. Open Navigation Screen** (992 → 951 ms).

### Connection-phase timings — the only notable deviation

Every metric where the Momentus agent is meaningfully "worse" is a **load-generator-side network phase**, not application behaviour. The large percentages come from near-zero baselines; absolute values are sub-millisecond to ~100 ms and are amortised away by keep-alive (avg blocked/connecting ≈ 0 on both).

| Phase (ms) | AWS | Momentus | Δ |
|---|---:|---:|---:|
| http_req_blocked max | 37.0 | 100.9 | +173% |
| http_req_connecting max | 5.1 | 32.5 | +539% |
| http_req_tls_handshaking max | 20.2 | 26.9 | +33% |
| http_req_sending max | 16.9 | 34.7 | +105% |
| http_req_receiving avg | 0.08 | 0.67 | +740% |

These reflect the Momentus agent's own network stack (DNS/TCP connect/TLS/socket buffering) and do not affect throughput or measured app latency. Treat as an agent/network-environment characteristic, not an app finding.

## Load-generator resource usage (`resource-usage.csv`)

1,013 (AWS) / 1,010 (Momentus) one-second samples over the run. **Neither agent was a bottleneck** — CPU stayed under 20% at p95 and RAM well within capacity on both, so the measurement reflects the SUT, not the generator (the [cardinal rule](load-architecture-and-workload-modeling.md): keep the generator below ~80% CPU).

| Metric | Stat | AWS | Momentus | Δ |
|---|---|---:|---:|---:|
| CPU % | avg | 13.2 | 11.9 | −9.9% |
| | p95 | 19.9 | 18.8 | −5.5% |
| | max | 51.1 | 43.6 | −14.7% |
| RAM used (MB) | avg | 2,603 | 3,432 | +31.9% |
| | max | 2,663 | 3,475 | +30.5% |
| RAM % of total | avg | 8.1 | 21.0 | — (different capacity) |
| Net RX (kB/s) | avg | 1,142 | 1,154 | +1.1% |
| | max | 2,059 | 2,160 | +4.9% |
| Net TX (kB/s) | avg | 70.2 | 71.1 | +1.2% |
| load1 | max | 4.0 | 4.0 | 0% |

Reading:

- **CPU** — Momentus ran slightly cooler (avg 11.9% vs 13.2%, peak 43.6% vs 51.1%). Both have large headroom; CPU% is normalised so this is directly comparable across the two machines.
- **RAM** — Momentus used ~830 MB more in absolute terms (3.4 GB vs 2.6 GB), and because it is a ~16 GB box vs the AWS ~32 GB box, that reads as 21% vs 8% of total. Still comfortably within capacity — no memory pressure on either.
- **Network** — near-identical (~1.15 MB/s RX, ~70 kB/s TX), consistent with the matching request throughput.
- **load1** — negligible on both (median 0, one transient spike to 4.0 each).

## k6 Go-runtime health (`gc-usage.csv`) — near-identical

The k6 process itself behaved the same on both agents, confirming the generator was healthy rather than degraded:

| Metric | AWS | Momentus |
|---|---:|---:|
| Heap in-use (avg / max, MB) | 180 / 244 | 182 / 248 |
| GC cycles (total) | 89 | 88 |
| GC pause max (ms) | 1.2 | 14.0 |
| Goroutines (avg / max) | 240 / 289 | 240 / 293 |
| Total allocations (MB) | 7,529 | 7,591 |

The single 14 ms GC pause on Momentus (vs 1.2 ms on AWS) is one isolated spike and immaterial at this scale.

## Verdict

- **The application under test performed identically** on both agents: equal throughput, zero failures, 100% checks, and response times within ~4% (marginally better on Momentus).
- **Both agents are heavily under-utilised at 100 VUs** — CPU < 20% p95, RAM within capacity, load1 ≈ 0. Either has ample headroom to push well beyond 100 VUs before becoming the bottleneck.
- **Differences are environmental, not functional:** the AWS agent is a larger box (~32 GB, slightly higher CPU draw); the Momentus agent is smaller (~16 GB, ~830 MB higher RAM footprint, higher — but still tiny — connection-setup latency).
- **Recommendation:** either agent is fit for purpose at this load level. Use the Momentus custom agent as the default (self-hosted, matching pipeline). If connection-setup noise or a much larger VU target becomes a concern, the AWS agent's extra RAM gives more scaling headroom. Neither choice changes the measured result for the SUT.
