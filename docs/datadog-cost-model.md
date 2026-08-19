# What the Datadog live-metrics feed costs

## What this is for

`docs/datadog-live-metrics.md` covers **how** the k6 run streams to Datadog and how to query it
correctly. This doc covers **what it costs**: the billing mechanics Datadog applies to what we send,
the measured footprint of one load run, and the arithmetic that turns that footprint into a line on an
invoice.

Everything in "What we actually send" and "What it comes to" was read out of the live org, not
estimated, and the bottom line is Datadog's own billing computation rather than ours. Everything in
"How Datadog charges" comes from Datadog's own docs. Contract pricing is deliberately not reproduced
here, so this doc is safe to circulate: every conclusion rests on committed quantities and measured usage.

## How Datadog charges for metrics

### The billable unit is a timeseries, not a metric

> A custom metric is uniquely identified by a combination of a metric name and tag values (including
> the host tag).

So `k6perf.http_req_duration` is not one custom metric. It is one custom metric for every distinct
combination of `scenario` + `group` + `name` + `method` + `status` + the rest of its tag set. Adding a
tag key multiplies, adding a value to an existing key adds.

Two things follow that matter more than anything else in this doc:

- **Load level does not drive cost.** VU count, iteration count and run duration change how many
  _samples_ land in each timeseries, not how many timeseries exist. There is no `vu` tag. A 50-VU
  40-minute run and a 2-VU 2-minute run of the same script cost the same in cardinality terms.
- **Script shape does drive cost.** A new flow, a new transaction inside a flow, or a new endpoint
  wrapper each add timeseries permanently.

### The monthly bill is an average, not a peak

> Your monthly billable custom metrics usage ... is calculated by taking the total of all distinct
> custom metrics (also known as timeseries) for each hour in a given month, and dividing it by the
> number of hours in the month to compute a monthly average value.

This is the single most important mechanic for us, because our runs are manually queued and short. A
footprint that exists for 3 hours out of 730 is divided by 730. It is also why the `build_number` tag,
which takes a new value on every run and would look alarming in a cardinality audit, costs nothing
extra: last week's `build_number` reports no data this hour, so it is not counted this hour. Runs do
not accumulate, they only occupy the hours they run in.

### Distributions are multiplied

k6 Trends arrive over OTLP as Datadog distributions, and a distribution is not billed as one custom
metric per timeseries:

| Distribution state              | Server-side aggregations               | Custom metrics per timeseries |
| ------------------------------- | -------------------------------------- | ----------------------------- |
| Default                         | count, sum, min, max, avg              | 5                             |
| Percentile aggregations enabled | the above plus p50, p75, p90, p95, p99 | 10                            |

The multiplier applies whether or not the metric is configured under Metrics without Limits. This is
where most of our footprint comes from, and it is the main lever if the footprint ever needs cutting.

### Included allotment, and where ours comes from

Custom metrics are not bought directly on our contract. The allotment is derived from other committed
lines, and Datadog computes it from the **committed** quantity rather than the quantity actually
metered:

| Plan                                      | Custom metrics contributed |
| ----------------------------------------- | -------------------------- |
| Infrastructure Pro                        | 100 per host per month     |
| Infrastructure Enterprise                 | 200 per host per month     |
| Serverless Workload Monitoring, Apps      | 20 per app instance        |
| Serverless Workload Monitoring, Functions | 5 per function             |

APM (either tier), Database Monitoring, Network Monitoring and Serverless APM contribute nothing.

Above the allotment, Datadog's docs give the ingested rate as **$0.10 per 100 ingested custom metrics**
and the indexed rate only as "an amount that is specified in your current contract". Ours is a negotiated
private-offer term with no public list price, so no rate is quoted anywhere in this doc. It turns out not to
matter: measured billable usage is zero, so there is no quantity for a rate to price.

### The contract we are billing into

Custom metrics are not purchased on this contract. The allotment falls out of the committed host and
serverless lines, and Datadog derives it from the **committed** quantity rather than the quantity actually
metered. Commercial terms are deliberately not reproduced here: only the committed quantities and each
line's per-unit allotment are needed to reach the number, so this doc stays safe to circulate.

| Committed line                    | Committed qty | Allotment per unit | Custom metrics contributed |
| --------------------------------- | ------------: | ------------------ | -------------------------: |
| Infra Hosts, **Pro** tier         |           300 | 100 per host       |                     30,000 |
| Serverless App Instances          |           300 | 20 per instance    |                      6,000 |
| Serverless Workload Functions     |            75 | 5 per function     |                        375 |
| APM Enterprise Hosts              |           130 | none, either tier  |                          0 |
| DBM Hosts                         |            20 | none               |                          0 |
| Network Hosts                     |           100 | none               |                          0 |
| Logs, spans, RUM, Synthetics      |             - | none               |                          0 |
| Custom metrics                    |             0 | not purchased      |                          - |
| **Total included custom metrics** |               |                    |                 **36,375** |

All three inputs to that number are confirmed:

- **The Infrastructure plan is Pro, so 100 per host.** Every committed line on the Planned Usage page
  reconciles to Datadog's published annual list rate to the dollar, and the infrastructure line lands on the
  Pro rate rather than the Enterprise one. The "APM **Enterprise** Hosts" line names the APM tier, not the
  Infrastructure plan, and APM contributes no custom-metric allotment at either tier. It is the single most
  confusable thing on the card.
- **The serverless lines are the allotment-bearing SKU**, confirmed from metered usage rather than by
  matching names. On the Usage Summary's Serverless tab, Serverless App Instance Hours resolves to an average
  of 232 against 300 committed and Serverless Workload Functions to 74.0 against 75 committed, so the metered
  products map onto those committed lines. The app-instance figure is composed of Azure Web App, Function App
  and Container App instance hours plus ECS hours, which is exactly what Serverless Workload Monitoring
  counts, and it is metered separately from the Serverless Apps APM line that contributes nothing.
- **The contract is cardinality pricing.** There are no Metric Names, Indexed Points or Ingest Points line
  items, which are what a Metric Name pricing contract breaks cost into.

The subscription is transacted as an AWS Marketplace private offer, so the on-demand rate per 100 is a
negotiated term that exists only on the offer's rate card. No public list price for it exists, which is why
no rate is quoted anywhere in this doc. It turns out not to matter (see below).

One consequence worth noting separately: we are committed to 300 Infra Hosts and metering about 100. Because
the allotment is calculated on the committed number, the headroom is three times what the metered count would
suggest. That gap is a conversation about the host commitment rather than a metrics question, but the unused
two thirds is part of what makes this feed free.

### Two contract models, and why only one of them applies to us

Datadog sells custom metrics under either model, and the docs are explicit that they are different SKUs:

| Model                   | Billable units                                                                                                                                                            | What to watch                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| **Cardinality pricing** | Distinct timeseries, monthly hourly average, as above                                                                                                                     | Tag cardinality, and the distribution multiplier                                    |
| **Metric Name pricing** | Distinct metric _names_ with over 100 indexed datapoints in the month, plus indexed datapoints beyond a 10M-per-name baseline, plus ingested datapoints beyond 5x indexed | Number of metric names, not their cardinality. "Cardinality no longer drives cost." |

**We are on cardinality pricing**, so the timeseries arithmetic in this doc is the operative one. The
Planned Usage card carries no Metric Names, Indexed Points or Ingest Points line items, which are the
line items a Metric Name pricing contract breaks cost into.

Recorded for completeness in case the contract is ever renegotiated onto the other model: our exposure
there would be the count of distinct `k6perf.*` names we submit, a few dozen, and the datapoint volume
is nowhere near the baseline. The busiest run measured moved roughly 1.5M billable datapoints after
multipliers, against a pooled baseline of 10M **per name**. The answer comes out small under either
model, for different reasons.

### Metrics without Limits: ingested vs indexed

By default every tag on a submitted metric is both ingested and indexed, and you are charged on the
indexed volume. Configuring a tag allowlist or blocklist on a metric keeps ingestion intact but drops
the excluded tags from queries, cutting the indexed count. We have configured nothing, so ingested and
indexed are the same number for us today. This is the mechanism to reach for if a tag ever needs to
stop costing money without changing the k6 scripts.

### What is not charged

- **Dashboards.** No per-dashboard or per-widget charge. The board itself is free regardless of how many
  widgets we add.
- **The CI agent.** The agentless OTLP intake was chosen partly for this: nothing is installed on the
  self-hosted agent, so it never becomes a billable infrastructure host. Installing an Agent purely to
  relay metrics would have added a host to the bill. That trade is recorded in
  `docs/datadog-live-metrics.md`.
- **Retention.** Custom metrics are retained at full granularity for 15 months as part of the metric
  price, with no separate retention charge.
- **The intake calls themselves.** No per-request or per-payload charge for the OTLP metrics intake or
  the `v2/series` posts the two forwarders make.

## What we actually send

Measured against build `20260817.1`, a full five-flow `neoload.spec.ts` run at 50 peak VUs. The
timeseries counts are row counts from grouped queries against that build, so they are what Datadog
itself resolved, not a projection from the script.

| Metric family                                                                                                                       | Type                      | Timeseries | Multiplier | Custom metrics |
| ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | ---------: | ---------: | -------------: |
| `http_req_blocked`, `http_req_connecting`, `http_req_tls_handshaking`, `http_req_sending`, `http_req_waiting`, `http_req_receiving` | distribution              |    163 x 6 |         x5 |          4,890 |
| `http_req_duration`                                                                                                                 | distribution, percentiles |        163 |        x10 |          1,630 |
| `group_duration`                                                                                                                    | distribution, percentiles |         48 |        x10 |            480 |
| `transaction.{count,avg,min,med,p90,p95,p99,max}`                                                                                   | gauge                     |     48 x 8 |         x1 |            384 |
| `checks.total`                                                                                                                      | count                     |        179 |         x1 |            179 |
| `http_reqs`                                                                                                                         | count                     |        163 |         x1 |            163 |
| `http_req_failed.total`                                                                                                             | count                     |        144 |         x1 |            144 |
| `iteration_duration`, `think_time`                                                                                                  | distribution              |      5 + 5 |         x5 |             50 |
| `data_sent`, `data_received`                                                                                                        | count                     |      6 + 6 |         x1 |             12 |
| `iterations`, `dropped_iterations`                                                                                                  | count                     |      6 + 6 |         x1 |             12 |
| `agent.{cpu_percent,ram_percent,ram_used_mb,load1,net_rx_kbps,net_tx_kbps}`                                                         | gauge                     |          6 |         x1 |              6 |
| `vus`, `vus_max`                                                                                                                    | gauge                     |      1 + 1 |         x1 |              2 |
| **Total**                                                                                                                           |                           |  **2,101** |            |      **7,952** |

The 163 figure recurs because all seven `http_req_*` metrics carry an identical tag set: each returned
exactly the same sample count on the same build, which is only possible if they resolve to the same
combinations. Those combinations are essentially one per (transaction, endpoint) pair, and `status`
splits only three of them.

### The computed number checks out against Datadog's own meter

`datadog.estimated_usage.metrics.custom` is the org's hourly billable count. Sampled at five-minute
resolution across the window build `20260817.1` was live, it sits near 136 at baseline, then steps to a
plateau that opens at **7,686**, holds **7,711** for eleven consecutive samples, closes at **7,584**, and
drops straight back to baseline. So the run's footprint is **7,711** by Datadog's own count, within 3% of the
7,952 computed above. The gap is tag combinations that did not appear in every sample.

Three things in that trace matter:

- **The plateau is flat, not rising.** The footprint is set by script shape, not by elapsed time or load. A
  longer run widens the plateau, it does not raise it. This is the "load does not drive cost" claim measured
  rather than argued.
- **The plateau is about 65 minutes wide**, so a run occupies roughly one of the month's 730 billable hours.
  Because it straddled a clock boundary it touched three hourly buckets, which read 630 / 7,702 / 471, but
  only one of those is a full hour of footprint. An earlier revision of this doc read those three plateau
  samples as three separate clock hours and so overstated a run's contribution by about 3x.
- **89% of the footprint is the distribution multiplier.** 1,199 of the 2,101 timeseries are distributions,
  and they account for 7,050 of the 7,952. Any real saving has to come from there, which is what the levers
  table is ordered by.

## What it comes to

### The org we are billing into

Datadog's own Usage Summary is the authority on what the org uses, and its Estimated Month-To-Date Cost view
is the authority on what that costs.

| Reading                                                            |  Value |
| ------------------------------------------------------------------ | -----: |
| Included custom metrics, from the committed lines above            | 36,375 |
| Floor if only Infra Hosts are counted                              | 30,000 |
| Custom metric hours used, 1 to 17 Aug 2026 (Datadog Usage Summary) |  73.8K |
| Same, as an hourly average over the 408 hours                      |    181 |
| Typical quiet hour                                                 |    136 |
| k6's contribution to the monthly average                           |     11 |
| **On-demand billable custom metric hours, August**                 |  **0** |
| **Estimated month-to-date cost, Custom Metrics**                   | **$0** |

**The zero is the answer, and it is the strong form of it.** It is attached to the billable usage
_quantity_, not to a dollar amount that happens to round down: Datadog subtracts the allotment before
computing billable usage, so "0 custom metric hours" means the entitlement covered every custom metric the org
produced in August, k6's spike included. The contractual rate per 100 is irrelevant when the quantity it
multiplies is zero.

Two supporting notes on that reading:

- The unfiltered on-demand view shows $482.37 for the month across other products, and Custom Metrics does
  appear in its legend. That is Datadog enumerating every product in the legend regardless of value. Filtering
  to Custom Metrics alone returns a chart flat on $0 for every day of the month.
- The view reports usage 72 hours after the fact, so the 17 Aug run may not be fully reported yet. It cannot
  change the outcome: the 12 Aug validation runs are well past the lag and also read $0, and the projection
  below puts the month's average near 150 against 36,375. Re-check after 20 Aug to close it completely.

The org meter and the billed page differ by about 8% for the same window (168 against 181), which is expected
of a metric named `estimated_usage`. The billed page is the figure to cite; the meter is what allows the
decomposition, since it is the only source that can separate k6's hours from the baseline.

### If run frequency goes up

Monthly average added = the plateau's excess over baseline x its width / 730. Measured on the 17 Aug run,
that is 7,573 excess across 65 minutes, so **one run adds about 11** to the month's average.

| Runs per month   | k6 adds | Org average | Share of the 36,375 allotment | Billable |
| ---------------- | ------: | ----------: | ----------------------------: | -------: |
| 1                |      11 |         152 |                          0.4% |        0 |
| 4                |      45 |         186 |                          0.5% |        0 |
| 8                |      90 |         231 |                          0.6% |        0 |
| 20               |     225 |         366 |                          1.0% |        0 |
| 40               |     450 |         591 |                          1.6% |        0 |
| 100              |   1,124 |       1,265 |                          3.5% |        0 |
| Continuous, 24/7 |   7,570 |       7,711 |                         21.2% |        0 |

The last row settles the question. If the pipeline never stopped, occupying all 730 hours of the month, the
monthly average would be the plateau itself, 7,711, a fifth of the allotment. The maximum possible average
**is** the plateau, so **no run cadence produces a custom-metric overage at this footprint**.

The only route to one is a much larger script. The full 33-flow NeoLoad suite at roughly 45,000 per run hour
lands at 407 on the monthly average at four runs a month, still about 1% of the allotment, and would have to
run something like 80% of every hour of the month before it crossed 36,375.

## What would actually change the number

Ranked by how much they move it:

1. **More transactions and endpoints.** The footprint is roughly `transactions x endpoints x 35`, the 35
   being the per-combination multiplier once the seven `http_req_*` distributions and their percentile
   settings are counted. The five ported flows produce 48 transactions and about 50 endpoint names.
   Porting the full NeoLoad suite (33 flows in the load model) would scale the footprint about 6x, to
   roughly 45,000 per run hour. At that size the arithmetic still holds: four runs a month lands at 407 on
   the monthly average, about 1% of the 36,375 allotment. But it stops being a rounding error, and such a
   suite would have to run roughly 80% of every hour of the month before it crossed the allotment, which
   makes it the first configuration where the levers below matter.
2. **Enabling percentile aggregation on more distributions.** Each one doubles that metric's
   contribution. Today only `http_req_duration` and `group_duration` have it. Turning it on for the six
   component metrics would add 4,890 to a run's footprint, the largest single increase available. It is
   also forward-only with no backfill, so it cannot be undone retroactively.
3. **A tag going uncorrelated.** `url` and `name` currently carry identical value sets, so `url` is
   free: it co-varies with `name` rather than multiplying it. That holds only because every wrapper sets
   an explicit `name` tag. A wrapper that let a real URL with an embedded record ID through would make
   `url` unbounded and independent, and cardinality would then climb per request rather than per
   endpoint. This is the one change that could make the footprint grow without anyone noticing, and it is
   the reason to keep the `name` override mandatory in the scripting rules. An MWL blocklist on `url`
   would insulate against it permanently at no loss, since nothing queries `url`.
4. **Fidelity tier.** `-e FIDELITY=full` adds the static and chrome replay tiers, but those requests are
   tagged with bucketed names (`staticasset`, `uichrome`, `cachefiles`, `transport`), so they add a
   handful of combinations rather than one per asset. Cheap by construction.
5. **Load level and run length.** No effect on cardinality, as established. Under Metric Name pricing
   they raise datapoint volume, which is orders of magnitude below the baseline.

## Levers, if the number ever needs cutting

In order of return per unit of pain:

| Lever                                                                         | Saves per run hour | What is lost                                                                                    |
| ----------------------------------------------------------------------------- | -----------------: | ----------------------------------------------------------------------------------------------- |
| Stop exporting the six `http_req_*` component distributions                   |              4,890 | The "Where request time goes" chart and its connection-setup line. Nothing else queries them.   |
| Turn off percentile aggregation on `http_req_duration`                        |                815 | The requests table's percentile columns. The exact `transaction.*` table is unaffected.         |
| Turn off percentile aggregation on `group_duration`                           |                240 | The live sketch percentile columns. The exact whole-run tail table survives, those are gauges.  |
| Drop `checks.total`                                                           |                179 | The failed-checks tile and the check-failure rate                                               |
| MWL tag blocklist dropping `url`, `proto`, `tls_version`, `expected_response` |                  0 | Nothing, but it saves nothing today either, since none of them currently multiplies cardinality |

Note the shape of that table: the cheapest thing to lose is also by far the biggest saving. If cost ever
becomes real, dropping the six component distributions alone cuts a run's footprint by 61% and costs us
one chart.

## Housekeeping observed while measuring

The legacy `k6.*` namespace still resolves in a 30-day metric search and carries a full duplicate set of
names. It last received data on 2026-08-11, with `k6perf.*` taking over on 2026-08-12, so it is dormant
and costs nothing ongoing under cardinality pricing. Under Metric Name pricing it would have counted as
billable metric names for August, the month it was submitted in, and it will age out on its own.

## How the open questions resolved

This analysis began with four questions about the subscription that measurement alone could not settle. All
four are now closed, and none of them required a commercial term to be disclosed.

| Question                                                | Answer                      | How it was settled                                                                   |
| ------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------ |
| Infrastructure Pro or Enterprise, so 100 or 200 / host? | **Pro**, 100 per host       | Committed lines reconcile to Datadog's published annual list rates                   |
| Cardinality pricing or Metric Name pricing?             | **Cardinality**             | No Metric Names, Indexed Points or Ingest Points line items exist                    |
| Does the serverless line carry an allotment?            | **Yes**, 6,375 of the total | Metered usage maps onto the committed quantities, composition is Workload Monitoring |
| What is the on-demand rate per 100?                     | **Moot**                    | Billable usage is 0, so there is no quantity for a rate to price                     |

The rate only becomes worth chasing if the footprint grows by something like fortyfold, which in practice
means the full 33-flow suite running close to continuously. Treat that as the trigger to revisit this doc,
not as a loose end to chase now. It lives on the private offer's rate card rather than anywhere in the Datadog
UI, because no custom-metric volume is committed for the Planned Usage page to price.

## Sources

Datadog documentation, read 2026-08-19:

- [Custom Metrics Billing](https://docs.datadoghq.com/account_management/billing/custom_metrics/), for
  the timeseries definition, the monthly-average formula, the allotments, the distribution multiplier and
  the ingested rate
- [Metric Name Pricing for Custom Metrics](https://docs.datadoghq.com/account_management/billing/metric_name_pricing/),
  for the alternative SKU and its baselines
- [Metrics without Limits](https://docs.datadoghq.com/metrics/metrics-without-limits/), for ingested vs
  indexed and tag configuration
- [Custom Metrics](https://docs.datadoghq.com/metrics/custom_metrics/), for submission limits and
  retention

Live readings came from the org's own `datadog.estimated_usage.*` meters and from grouped queries against
builds `20260817.1` and `local-3`.
