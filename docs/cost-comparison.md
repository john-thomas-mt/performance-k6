# Cost Comparison — NeoLoad vs k6

The cost model for running Momentus Enterprise performance testing on NeoLoad versus k6, including the
optional hosted-observability cost if we ever adopt Grafana Cloud. The NeoLoad side is a **framework
with placeholders** — dollar amounts are left as `<fill in>` rather than guessed, to be completed from
internal finance/procurement records. The k6 and Grafana-Cloud figures are real (k6 is free; Grafana
Cloud pricing is from official docs).

> How to use this: replace each `<…>` with the real figure. NeoLoad amounts come from the Tricentis/
> NeoLoad contract and NeoLoad Web subscription; k6 amounts are mostly zero because the tool is free and
> the hardware is already owned — the placeholders there are for the _marginal_ cost of using existing
> capacity, not new spend.

## The headline

NeoLoad is a **recurring subscription** cost with **usage-metered** load generation. k6 is a **free**
tool that runs on **CI/CD agents the org already owns and pays for regardless**. The switch converts a
recurring, per-VU-metered line item into (at most) a marginal use of existing hardware. The measured
proof that our owned agents carry the target load with large headroom is in
[running-load-on-our-agents.md](./running-load-on-our-agents.md).

## Cost elements, side by side

| Cost element                     | NeoLoad                                 | k6                                                                     | Notes                                                                                           |
| -------------------------------- | --------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| **Tool license**                 | `<annual license / subscription>`       | **$0** (AGPL-3.0 open source)                                          | NeoLoad 2024.1 is commercial; k6 is free                                                        |
| **Authoring seats**              | `<per-seat cost × seats>`               | **$0**                                                                 | NeoLoad authoring needs the licensed GUI + a seat; k6 authoring needs only the repo             |
| **Controller / orchestration**   | `<NeoLoad Web SaaS subscription>`       | **$0**                                                                 | k6 needs no controller or SaaS orchestrator — it is a CLI binary                                |
| **Load-generator capacity**      | `<cloud LG hours / capacity tier>`      | `<marginal cost of existing CI agents>` ≈ **$0 new**                   | k6 runs on already-owned self-hosted agents                                                     |
| **Results storage / dashboards** | Included in NeoLoad Web `<…>`           | **$0** built-in HTML; optional Grafana Cloud **free tier** (see below) | See [k6-reporting-approaches.md](./k6-reporting-approaches.md)                                  |
| **APM / backend monitoring**     | `<Datadog cost, if attributed>`         | Same (unchanged by tool choice)                                        | Not a differentiator — carried by both                                                          |
| **Maintenance labour**           | High — re-record per release, GUI-bound | Low — AI-assisted parameterize + verify                                | Quantify as engineer-hours/release → see [ai-assisted-authoring.md](./ai-assisted-authoring.md) |
| **Training / onboarding**        | NeoLoad GUI expertise required          | Repo + Claude; general TS skills                                       | Softer cost, but real                                                                           |

**Annual total:** NeoLoad `<sum>` per year vs k6 `<≈0 + marginal agent use>` per year. The delta is the
savings headline.

## Why "our own machines cut costs significantly"

Two independent things are being paid for in a commercial load-testing setup: the **tool** and the
**load-generation capacity**. k6 removes the first entirely (free) and lets us satisfy the second with
**hardware we already own and operate**:

- The org runs **self-hosted CI/CD agents** (Azure custom "Momentus" agent; an AWS agent was tested for
  comparison). Running k6 load on them is a scheduled pipeline job, not a new purchase.
- Those agents were measured at the target load (100 VUs) sitting **under 20% CPU with RAM within
  capacity** — real headroom, no need to buy bigger boxes.
- A developer laptop can generate scripting/smoke load for free too; it is **network-bound over VPN**,
  not underpowered, so real load numbers come from the close-to-SUT agents while authoring stays local.
- A single k6 instance covers far more than this suite needs before distribution is ever warranted, so
  there is no hidden "we'll need a cluster" cost.

All three of those points are evidenced in [running-load-on-our-agents.md](./running-load-on-our-agents.md)
and [k6-architecture-and-open-source.md](./k6-architecture-and-open-source.md). Net: the
load-generation line item, which NeoLoad meters and bills, becomes **marginal use of paid-for hardware**
under k6.

## Optional hosted observability — Grafana Cloud (if we choose it)

k6 requires **no** SaaS; the base case is **$0**, using the built-in local HTML report
([k6-reporting-approaches.md](./k6-reporting-approaches.md)). But if hosted dashboards, team seats, and
short-term retention are wanted, Grafana Cloud's **free tier** is available with near-zero setup. The
cost model is worth understanding because the two ways to stream local runs to the cloud bill very
differently.

### What the free tier includes

"Free forever," no credit card. Per month:

| Resource                               | Free tier limit |
| -------------------------------------- | --------------- |
| k6 virtual-user hours (VUh)            | **500 / month** |
| Prometheus active series               | 10,000          |
| Logs / Traces / Profiles               | 50 GB each      |
| Grafana users (visualization seats)    | 3               |
| Retention (all data, incl. k6 results) | **14 days**     |
| Support                                | Community       |

Test **configs** and user data persist indefinitely — only **result data** rolls off at 14 days.

### The key cost split — two ways to stream a local run

- **Path A — Grafana Cloud k6** (`k6 cloud run --local-execution`): test executes on your machine,
  results stream to the managed k6 app (polished dashboard, single-pane k6-vs-system view, team
  collaboration). ⚠️ **Still consumes VUh from the 500/month quota even though execution is local** —
  "local execution" does not mean free (it is billed at a 25% discount versus fully-hosted cloud
  execution, but still draws down the quota).
- **Path B — Prometheus remote-write** (`k6 run -o experimental-prometheus-rw`): streams metrics into
  Grafana Cloud's Prometheus; you build/use Grafana dashboards yourself. ✅ **Does NOT burn VUh** —
  counts against the 10,000-active-series cap instead. ⚠️ That cap is easy to blow with high-cardinality
  tags (URLs containing UUIDs), so it needs tag trimming.

(Plain `k6 cloud run` without `--local-execution` uploads the script and runs the whole test on Grafana
Cloud infrastructure — a different, fully-hosted execution model, out of scope here.)

### VUh math

`VUh = (max VUs × test duration in minutes) / 60`. Minimum 1 VUh per test; browser VUs bill at 10×
protocol VUs; duration rounds up to the next minute. Example: a 50-VU, 12-min protocol test ≈ 10 VUh →
500/month ≈ **~50 such runs**. (Two myths were refuted in research: VUh is _not_ rounded up per-VU, and
preallocated open-model VUs do _not_ each bill a full hour — so "open execution is prohibitively
expensive" does not hold.)

### Past the free tier

Pro tier: **$19/month** platform fee (includes 500 VUh) → then **$0.15/VUh** pay-as-you-go. Retention
rises to 13 months (metrics) / 30 days (others). Pricing is time-sensitive — re-check
[grafana.com/pricing](https://grafana.com/pricing/) before committing.

### Recommendation on hosted observability

For a small team wanting visualization + short-term storage + collaboration, the free tier adds clear
value with near-zero setup. Start with **Path A** to evaluate (the single-pane k6-vs-system view is the
real win); switch to **Path B** if you hit the 500 VUh ceiling or run frequently. The **14-day
retention** is the most likely reason to ever need Pro — free won't hold long-term regression baselines;
mitigate by keeping summary metrics via the no-VUh Prometheus path and/or archiving run summaries
in-repo. Base case for the migration remains **$0** with the built-in report.

## Placeholders to fill before presenting

1. NeoLoad annual license / subscription figure.
2. NeoLoad Web SaaS subscription figure.
3. Cloud load-generator capacity/hours cost (if separately billed).
4. Number of NeoLoad authoring seats × per-seat cost.
5. Estimated maintenance hours per release, NeoLoad vs k6 (labour cost).
6. Any Datadog cost attributed to performance testing (carried by both — usually excluded from the delta).

## Sources

- NeoLoad stack (tool + NeoLoad Web SaaS) — Enterprise Performance Suite `README.md` (sibling `performance` repo); Tricentis/NeoLoad commercial pricing (procurement/contract, internal)
- k6 is free/open source — [k6 license](https://github.com/grafana/k6/blob/master/LICENSE.md)
- Owned-hardware evidence — [running-load-on-our-agents.md](./running-load-on-our-agents.md), [k6-architecture-and-open-source.md](./k6-architecture-and-open-source.md)
- Grafana Cloud pricing & free tier — [grafana.com/pricing](https://grafana.com/pricing/), [free tier](https://grafana.com/products/cloud/free-tier/), [k6 cloud](https://grafana.com/products/cloud/k6/)
- Streaming cost model — [Grafana Cloud k6 output](https://grafana.com/docs/k6/latest/results-output/real-time/cloud/), [Prometheus remote-write](https://grafana.com/docs/k6/latest/results-output/real-time/prometheus-remote-write/), [performance-testing invoice](https://grafana.com/docs/grafana-cloud/cost-management-and-billing/manage-invoices/understand-your-invoice/performance-testing-invoice/)
