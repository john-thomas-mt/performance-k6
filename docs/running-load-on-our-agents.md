# Running Load on Our Own CI/CD Agents

k6 load runs on the CI/CD agents the org already owns and operates — no proprietary controller, no
cloud load-generator rental. This doc covers where load runs, the measured proof that our agents carry
the target load with large headroom, and why the developer laptop is a fine _scripting_ generator but
not the place to read real load numbers. Figures are extracted from each run's `report.html` (k6 web
dashboard), `resource-usage.csv` (OS sampler), and `gc-usage.csv` (k6 Go-runtime metrics).

## Where load runs

k6 is a single CLI binary, so a load run is just a pipeline job. Three execution locations are in play:

- **Self-hosted Azure "Momentus" agent** — the org's custom CI agent, the default target for real load.
- **AWS agent** — a second self-hosted agent, tested here as a comparison point.
- **Developer laptop** — for scripting, smoke, and small sanity loads.

No special infrastructure is provisioned for any of them; k6 runs the same way in each. The rest of this
doc is the evidence that this arrangement measures the system under test (SUT) faithfully.

## Agent vs agent — the app performs identically regardless of generator

The same k6 load run was executed on both self-hosted agents — identical script, scenario, profile, and
thresholds. Only the executing agent differs.

### Run parameters (identical across both)

| Parameter     | Value                                                                                   |
| ------------- | --------------------------------------------------------------------------------------- |
| Script        | `source/tests/load.spec.ts`                                                             |
| Scenario      | `navigation`                                                                            |
| Profile       | `load` — 5m ramp / 10m sustain / 2m ramp-down                                           |
| Peak VUs      | 100                                                                                     |
| Wall duration | ~17.5 min                                                                               |
| Thresholds    | `checks rate>0.95`, `http_req_failed rate<0.05`, tagged `http_req_duration p(95)` 2–3 s |

The only difference:

|                     | AWS Agent | Momentus Agent (Azure custom) |
| ------------------- | --------- | ----------------------------- |
| Total RAM           | ~32 GB    | ~16 GB                        |
| CPU baseline (idle) | ~5%       | ~3%                           |

### Application performance — functionally equivalent

Both runs passed: **100% checks, 0% request failures**, well under all latency thresholds. The SUT
behaved the same regardless of agent; the Momentus agent's app-side latency was marginally _lower_
(within run-to-run noise).

**Throughput & reliability**

| Metric          |     AWS | Momentus |     Δ |
| --------------- | ------: | -------: | ----: |
| Iterations      |  24,674 |   24,924 | +1.0% |
| HTTP requests   |  73,869 |   74,575 | +1.0% |
| Request rate    |  72.2/s |   73.0/s | +1.1% |
| Data received   | 1.14 GB |  1.15 GB | +0.7% |
| Checks passed   |    100% |     100% |     0 |
| Requests failed |      0% |       0% |     0 |

**Response time — `http_req_duration` (ms)**

| Stat |   AWS | Momentus |     Δ |
| ---- | ----: | -------: | ----: |
| avg  | 429.8 |    417.9 | −2.8% |
| med  | 284.7 |    284.5 | −0.1% |
| p90  | 1,040 |      998 | −4.0% |
| p95  | 1,177 |    1,133 | −3.8% |
| p99  | 1,414 |    1,368 | −3.3% |
| max  | 2,245 |    2,211 | −1.5% |

`http_req_waiting` (pure server TTFB) tracks this within ±0.1%, confirming the difference is
server-response time, not client overhead. The only metrics where Momentus looked "worse" were
load-generator-side network phases (blocked/connecting/TLS/sending), all sub-millisecond to ~100 ms off
near-zero baselines and amortised away by keep-alive — an agent/network characteristic, not an app
finding.

### Generator resource usage — neither agent was a bottleneck

~1,010 one-second samples per run. Both agents stayed **under 20% CPU at p95** with RAM within capacity,
so the measurement reflects the SUT, not the generator (the cardinal rule — keep the generator below
~80% CPU; see [k6-architecture-and-open-source.md](./k6-architecture-and-open-source.md)).

| Metric         | Stat |   AWS | Momentus |
| -------------- | ---- | ----: | -------: |
| CPU %          | avg  |  13.2 |     11.9 |
|                | p95  |  19.9 |     18.8 |
|                | max  |  51.1 |     43.6 |
| RAM used (MB)  | avg  | 2,603 |    3,432 |
| RAM % of total | avg  |   8.1 |     21.0 |
| Net RX (kB/s)  | avg  | 1,142 |    1,154 |

Momentus ran slightly cooler on CPU; it used ~830 MB more RAM in absolute terms and, being a ~16 GB box
vs the AWS ~32 GB box, that reads as 21% vs 8% of total — still comfortably within capacity. The k6
Go-runtime health (heap in-use ~180 MB, ~88 GC cycles, ~240 goroutines) was near-identical on both,
confirming the generator was healthy rather than degraded.

### Verdict

- The **application performed identically** on both agents: equal throughput, zero failures, 100%
  checks, response times within ~4% (marginally better on Momentus).
- **Both agents are heavily under-utilised at 100 VUs** — CPU < 20% p95, RAM within capacity. Either has
  ample headroom to push well beyond 100 VUs before becoming the bottleneck.
- **Differences are environmental, not functional.**
- **Recommendation:** either agent is fit for purpose. Use the **Momentus custom agent as the default**
  (self-hosted, matching pipeline); the AWS agent's extra RAM gives more scaling headroom if a much
  larger VU target ever becomes a concern. Neither choice changes the measured result for the SUT.

## Laptop capacity sweep — a network-bound generator, not a weak one

The same run was executed from a developer laptop (~32 GB RAM, Windows) at four VU levels against PERF
**over VPN**, to see how a local generator scales and how it compares to the agents.

### Scaling — throughput & latency

| VUs | iterations | req/s | checks % | fail % | avg ms | p95 ms | p99 ms |
| --: | ---------: | ----: | -------: | -----: | -----: | -----: | -----: |
|  10 |      2,413 |   7.0 |    99.85 |   0.15 |    434 |    564 |    618 |
|  20 |      4,767 |  13.9 |    99.70 |   0.30 |    468 |    567 |    644 |
|  50 |     11,500 |  33.6 |    99.89 |   0.11 |    508 |    742 |    907 |
| 100 |     14,371 |  42.1 |   100.00 |   0.00 |  1,219 |  1,863 |  2,090 |

Clean scaling to 50 VUs (~230 iters/VU), then a hard plateau at 100 (only +25% for 2× the VUs) as
per-request latency roughly triples. Reliability is excellent throughout (99.7–100% checks).

### Generator resources — idle at every level

| VUs | cpu avg % | cpu p95 % | ram used MB | ram % |
| --: | --------: | --------: | ----------: | ----: |
|  10 |       8.1 |      16.4 |      13,012 |  40.1 |
|  20 |       7.1 |      10.9 |      13,207 |  40.7 |
|  50 |       9.0 |      13.1 |      13,321 |  41.0 |
| 100 |       9.4 |      13.4 |      13,291 |  40.9 |

The laptop sat at **~9% CPU and ~40% RAM even at 100 VUs** — nowhere near saturation. So the plateau is
**not** the machine running out of capacity.

### 100 VU — laptop vs agents (same VUs, different network path)

|                 | Laptop (VPN) | AWS agent | Momentus agent |
| --------------- | -----------: | --------: | -------------: |
| req rate /s     |     **42.1** |      72.2 |           73.0 |
| req_dur avg ms  |    **1,219** |       430 |            418 |
| req_dur p95 ms  |    **1,863** |     1,177 |          1,133 |
| cpu avg %       |          9.4 |      13.2 |           11.9 |
| net rx avg kB/s |          806 |     1,142 |          1,154 |

The laptop pushed ~42 req/s vs the agents' ~72–73 req/s at ~2.8× the latency — **while sitting at 9% CPU
with bandwidth to spare** (RX peaked at 2,677 kB/s, far above its 806 kB/s average). CPU, RAM, and
bandwidth all show large headroom, so the binding constraint is the **VPN network round-trip**: the
agents have a fast, close path to PERF; the laptop does not.

### Takeaway

- **The laptop is not a weak generator — it is a network-constrained one.** At 100 VUs it was 91% idle
  on CPU; the ceiling was the VPN path, not the hardware.
- **This is the cardinal rule in action:** when the generator's network is the bottleneck, you measure
  the client, not the SUT. Over VPN, laptop latency/throughput numbers describe the link.
- **Practical guidance:** run scripting, smoke, and small sanity loads locally; run **real load numbers
  from the CI agents**, which give the truer read of the SUT.

## Why this is the "accessibility" win over NeoLoad

- **The capacity is already ours.** Real load runs on agents the org owns and pays for regardless — a
  scheduled pipeline job, not rented cloud load-generator capacity metered by NeoLoad Web.
- **No special setup.** k6 is a CLI binary; any agent that can run a command can run the load.
- **Headroom to grow.** Both agents idle at 100 VUs, so there is room to push far higher before any
  distribution question arises (single-instance ceiling in
  [k6-architecture-and-open-source.md](./k6-architecture-and-open-source.md)).

The cost consequence of running on owned hardware is drawn out in [cost-comparison.md](./cost-comparison.md).

## Sources

- k6 web dashboard, OS resource sampler, and Go-runtime metrics from the project's own CI runs (`.azure/scripts/` samplers; `report.html` / `resource-usage.csv` / `gc-usage.csv`)
- [Running large tests](https://grafana.com/docs/k6/latest/testing-guides/running-large-tests/) — the "keep the generator below ~80% CPU" cardinal rule
