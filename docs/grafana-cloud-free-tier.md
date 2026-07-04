# Grafana Cloud Free Tier for k6 Load Testing

Whether adopting Grafana Cloud (free tier) adds value for a team running k6 locally, covering free-tier limits, the two ways to stream local runs to the cloud, and cost gotchas. Figures from official Grafana documentation unless noted; pricing is time-sensitive — re-check [grafana.com/pricing](https://grafana.com/pricing/) before committing.

## What the free tier includes

"Free forever," no credit card. Per month:

| Resource                               | Free tier limit |
| -------------------------------------- | --------------- |
| k6 virtual user hours (VUh)            | **500 / month** |
| Prometheus active series               | 10,000          |
| Logs / Traces / Profiles               | 50 GB each      |
| Grafana users (visualization seats)    | 3               |
| Retention (all data, incl. k6 results) | **14 days**     |
| Support                                | Community       |

Test **configs** and user data persist indefinitely — only **result data** rolls off at 14 days (rolling auto-delete).

## Two ways to get local k6 runs into Grafana Cloud

The key decision — very different cost models.

### Path A — Grafana Cloud k6

`k6 cloud run --local-execution` (or legacy `k6 run --out cloud`)

- Test executes on your machine; results stream to the managed k6 web app.
- Polished real-time dashboard, **single-pane comparison of client-side k6 metrics vs system metrics**, team collaboration out of the box.
- ⚠️ **Still consumes VUh from the 500/month quota even though execution is local.** "Local execution" does not mean free. Docs: "k6 cloud run --local-execution will consume VUH or test runs from your subscription."

### Path B — Prometheus remote-write

`k6 run -o experimental-prometheus-rw`

- Streams metrics into Grafana Cloud's Prometheus; you build/use Grafana dashboards yourself.
- ✅ **Does NOT burn k6 VUh** — counts against the 10,000-active-series cap instead.
- ⚠️ That 10k cap is easy to blow with **high-cardinality tags** (e.g. URLs containing UUIDs — a documented k6 issue). Needs tag trimming / relabeling.
- Env vars: `K6_PROMETHEUS_RW_SERVER_URL`, `K6_PROMETHEUS_RW_USERNAME`, `K6_PROMETHEUS_RW_PASSWORD`. Push interval defaults to 5s.

The two run modes differ in execution location too: plain `k6 cloud run` (without `--local-execution`) uploads the script and runs the test **entirely on Grafana Cloud infrastructure**; `--local-execution` runs locally and only streams results.

## VUh math

`VUh = (max VUs × test duration in minutes) / 60`

- Minimum **1 VUh per test** (2 VUh if a test uses both protocol and browser VUs).
- Browser VUs billed at **10×** protocol VUs.
- Duration rounds up to the next minute of actual execution.
- Example: a 50-VU, 12-min protocol test ≈ 10 VUh → 500/month ≈ **~50 such runs**.

Two myths were **refuted** during research: VUh is _not_ rounded up per-VU, and preallocated open-model VUs do _not_ each bill a full hour. So the "open execution is prohibitively expensive" concern does not hold.

## Past the free tier

Pro tier: **$19/month** platform fee (includes 500 VUh) → then **$0.15/VUh** pay-as-you-go, 8×5 email support. Retention rises to 13 months (metrics) / 30 days (others).

## Recommendation for this project

For a small team running k6 locally and wanting visualization + short-term storage + collaboration, the free tier adds clear value with near-zero setup.

- **Start with Path A** (Grafana Cloud k6) to evaluate — the single-pane k6-vs-system view and shared dashboards are the real win over rolling your own; 500 VUh is plenty for evaluation.
- **Switch to Path B** (Prometheus remote-write) if you hit the 500 VUh ceiling or run frequently — lower-cost, no VUh, at the cost of building dashboards and watching cardinality.
- The **14-day retention** is the most likely reason to need Pro — free won't hold long-term perf regression baselines. Mitigation: keep summary metrics via the no-VUh Prometheus path and/or archive run summaries in-repo.

Open questions worth answering before committing:

- What a representative Momentus load/stress run actually costs in VUh.
- Whether 14 days is enough for baselining.
- Whether current test tags would stay under 10k active Prometheus series on Path B.

## Sources

- https://grafana.com/pricing/
- https://grafana.com/products/cloud/free-tier/
- https://grafana.com/products/cloud/k6/
- https://grafana.com/docs/k6/latest/results-output/real-time/cloud/
- https://grafana.com/docs/k6/latest/results-output/real-time/prometheus-remote-write/
- https://grafana.com/docs/k6/latest/results-output/real-time/grafana-cloud-prometheus/
- https://grafana.com/docs/grafana-cloud/cost-management-and-billing/manage-invoices/understand-your-invoice/performance-testing-invoice/
- https://github.com/grafana/k6/issues/3761
