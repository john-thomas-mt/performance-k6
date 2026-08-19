# What the Datadog live-metrics feed costs

## What this is for

`docs/datadog-live-metrics.md` covers **how** the k6 run streams to Datadog and how to query it
correctly. This doc covers **what it costs**: the billing mechanics Datadog applies to what we send,
the measured footprint of one load run, and the arithmetic that turns that footprint into a line on an
invoice.

Everything in "What we actually send" and "What it comes to" was read out of the live org, not
estimated. Everything in "How Datadog charges" comes from Datadog's own docs, with the one figure I
could not source officially called out as such.

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

### Included allotment, and what an overage costs

| Plan       | Included custom metrics |
| ---------- | ----------------------- |
| Pro        | 100 per monitored host  |
| Enterprise | 200 per monitored host  |

Above the allotment, Datadog's docs give the ingested rate as **$0.10 per 100 ingested custom metrics**
and the indexed rate as "an amount that is specified in your current contract", so there is no official
list price for the indexed number. The figure widely quoted outside Datadog is **$5.00 per 100 indexed
custom metrics per month** ($0.05 each). I have used that below purely to put a dollar sign on the
arithmetic. It is **not** a verified rate and should be replaced with the contract rate before anyone
quotes it. See [What I still need from you](#what-i-still-need-from-you).

### Two contract models, and which one you are on changes the question

Datadog now sells custom metrics under either model, and the docs are explicit that they are different
SKUs:

| Model                   | Billable units                                                                                                                                                            | What to watch                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| **Cardinality pricing** | Distinct timeseries, monthly hourly average, as above                                                                                                                     | Tag cardinality, and the distribution multiplier                                    |
| **Metric Name pricing** | Distinct metric _names_ with over 100 indexed datapoints in the month, plus indexed datapoints beyond a 10M-per-name baseline, plus ingested datapoints beyond 5x indexed | Number of metric names, not their cardinality. "Cardinality no longer drives cost." |

Under Metric Name pricing our exposure is the count of distinct `k6perf.*` names we submit, a few
dozen, and the datapoint volume is nowhere near the baseline: the busiest run measured moved roughly
1.5M billable datapoints after multipliers, against a pooled baseline of 10M **per name**. Under
cardinality pricing the exposure is the timeseries count computed below. Either way the answer comes
out small, for different reasons.

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

`datadog.estimated_usage.metrics.custom` is the org's hourly billable count. Over the three clock hours
build `20260817.1` was live it read **7,686 / 7,711 / 7,584**, against an org baseline of about 139 in
the hours either side. So the run's footprint is about 7,550 by Datadog's own count, within about 5% of
the 7,952 computed from the table. The gap is combinations that did not appear in every hour.

Two details worth keeping:

- **The three hours are flat, not rising.** 7,686 then 7,711 then 7,584. The footprint is set by the
  script's shape and is fully present in the first hour, so a longer run does not grow it. This is the
  "load level does not drive cost" point, measured.
- **89% of the footprint is the distribution multiplier.** 1,199 of the 2,101 timeseries are
  distributions, and they account for 7,050 of the 7,952 custom metrics.

## What it comes to

### The org we are billing into

| Reading (Aug 2026 month to date, 432 hours)                    |  Value |
| -------------------------------------------------------------- | -----: |
| Billable infrastructure hosts, `datadog.estimated_usage.hosts` |    100 |
| Included custom metrics at Pro (100/host)                      | 10,000 |
| Included custom metrics at Enterprise (200/host)               | 20,000 |
| Org billable custom metrics, hourly mean over the month        |    224 |
| Same, with k6 run hours excluded                               |    149 |
| Median non-run hour                                            |    139 |
| k6's contribution to the monthly average                       |     75 |

k6 is **33% of the org's custom-metric average** and simultaneously **0.7% of a Pro allotment**. Both
are true, and the second is the one that reaches the invoice: the org is using 224 of at least 10,000
included custom metrics, so every k6 timeseries today sits inside the allotment and its marginal cost is
**zero**.

The 75 came from 11 run hours across 18 days, including one full CI run at about 7,600 and several
smaller local and validation runs.

### If run frequency goes up

Monthly average added = footprint x hours live / 730. At a 7,550 footprint and 3 clock hours per run:

| Runs per month | Added to monthly average | Total org average | Share of a 10,000 allotment | Illustrative overage cost |
| -------------: | -----------------------: | ----------------: | --------------------------: | ------------------------: |
|              1 |                       31 |               180 |                        1.8% |                        $0 |
|              4 |                      124 |               273 |                        2.7% |                        $0 |
|              8 |                      248 |               397 |                        4.0% |                        $0 |
|             20 |                      621 |               770 |                        7.7% |                        $0 |
|             40 |                    1,241 |             1,390 |                         14% |                        $0 |
|            100 |                    3,103 |             3,252 |                         33% |                        $0 |

Every row is $0 because none of them reaches the allotment. To exit the allotment on k6 metrics alone,
at a 7,550 footprint, would take roughly **950 run hours a month**, about 315 runs, which is more hours
than a month contains once you account for the three-hour occupancy. Under cardinality pricing this
dashboard cannot generate a custom-metric overage on its own at any realistic run cadence. The only way
it contributes to one is if the rest of the org's usage grows to fill the allotment first, at which
point k6's 75 to 600 average becomes marginal spend at the contract rate (at the unverified $5/100,
between $4 and $31 a month).

## What would actually change the number

Ranked by how much they move it:

1. **More transactions and endpoints.** The footprint is roughly `transactions x endpoints x 35`, the 35
   being the per-combination multiplier once the seven `http_req_*` distributions and their percentile
   settings are counted. The five ported flows produce 48 transactions and about 50 endpoint names.
   Porting the full NeoLoad suite (33 flows in the load model) would scale the footprint about 6x, to
   roughly 45,000 per run hour. At that size the arithmetic still holds (45,000 x 3 x 4 runs / 730 = 740
   average, still inside the allotment), but it stops being a rounding error and the levers below start
   to matter.
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

## What I still need from you

The arithmetic above is complete except for the contract terms. Four answers would turn the illustrative
figures into real ones:

1. **Pro or Enterprise?** Sets the allotment at 100 or 200 per host, so 10,000 or 20,000 included.
2. **Cardinality pricing or Metric Name pricing on the custom-metrics SKU?** They are different
   contracts and the number to watch differs under each. If it is Metric Name pricing, the question
   becomes "how many distinct `k6perf.*` names do we submit", and the cardinality tables above become
   background.
3. **The contract rate per 100 indexed custom metrics.** Datadog's docs will not state it, only the
   contract does. Everything marked illustrative above uses an unverified $5.00.
4. **Is there already a committed custom-metrics volume in the contract, above the per-host allotment?**
   If so the headroom is larger still than the 10,000 assumed here.

Worth confirming too that the invoice's host count matches the 100 that `datadog.estimated_usage.hosts`
reports, since the whole allotment scales off it. The host inventory lists 344 entries, so the billable
number is already well below the inventory and the two should not be confused.

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
