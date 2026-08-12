# Streaming live k6 metrics to Datadog

## What this is for

A **live view of a load run in progress**, so we can tell within a minute whether a run is healthy
instead of waiting ~40 minutes for the published artifacts. It is a sanity check, not a reporting
channel: after the run we still read `report.html`, `group-metrics.csv`, and the JSON firehose, which
remain more precise than anything Datadog stores (see [Known limits](#known-limits)).

Datadog is already the APM for every Momentus application, so this also puts client-side load metrics
on the same screen as the server-side traces of the system under test. That correlation, client symptom
next to server cause, is the part NeoLoad never gave us.

The wiring itself lives in `.azure/workflows/k6-tests-ci.yml`, which is the authoritative reference for
which variables are set. This doc records **why** each decision was made and what was measured.

## The route we took, and the two we rejected

| Route                               | Verdict                                                                                                                                                                                                                                                                                                                                              |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Agentless OTLP intake** (chosen)  | k6's built-in `--out opentelemetry` posts straight to Datadog's OTLP metrics intake. Nothing installed on the agent, no billable infrastructure host, no custom k6 binary.                                                                                                                                                                           |
| Datadog Agent with an OTLP receiver | Rejected. Our CI agents are deployment boxes, not application hosts, so none runs an Agent. Installing one to relay metrics would make each a billable infrastructure host.                                                                                                                                                                          |
| DogStatsD via `xk6-output-statsd`   | Rejected. This is what Grafana's Datadog page documents, but the built-in StatsD output was removed in k6 v0.55.0, so it needs a custom xk6 binary. It would also replace the CI's fresh-k6-download step with a binary we build, host, and re-version on every k6 bump, and StatsD timers cannot be re-aggregated correctly across a 40-minute run. |

## What was verified, and how

Measured against k6 v2.0.0, not taken from documentation:

- **Delta temporality is mandatory.** The intake accepts delta metrics only, and k6 defaults to
  cumulative. A control run, one variable changed, produced 9 `CUMULATIVE` metrics without
  `OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE=delta` and all-`DELTA` with it. Omitting it does
  not degrade gracefully, every export is rejected. k6 does honor the OTel SDK env var, so no
  OpenTelemetry Collector sidecar is needed.
- **Resource attributes become real Datadog tags.** Confirmed empirically after the docs proved
  inconclusive: `avg:<prefix>http_req_sending{service:k6/performance/26_2}` returns data, so `service.name`
  and `deployment.environment.name` map to `service` and `env`.
- **`service.version` must be set explicitly.** Left alone, k6 reports its own version (`2.0.0`) in that
  attribute, which Datadog maps to the `version` tag, so load-test metrics would read `version:2.0.0`
  beside an app service at `26_2`.
- **Trends arrive as distributions.** They originally carried the OTel SDK's default explicit bucket
  bounds `[0,5,10,25,50,75,100,250,500,750,1000,2500,5000,7500,10000]` ms;
  `OTEL_EXPORTER_OTLP_METRICS_DEFAULT_HISTOGRAM_AGGREGATION=base2_exponential_bucket_histogram` now
  switches them to base2 exponential histograms at scale 6-8. Confirmed on both sides: the wire shape
  against a local OTLP receiver, and the intake by reading a run back against its own
  `k6-metrics.json.gz`, where `sum:` is byte-exact (359507.025 ms over 838 samples) and a merged
  percentile lands within ~2% of k6's.
- **Rates are counts, not ratios.** A k6 Rate arrives as `<name>.total`, a sum carrying a `condition`
  attribute. A failure-rate panel must compute `sum(condition:nonzero) / sum(all)`; querying
  `k6perf.http_req_failed.total` directly gives a count.
- **The `group` tag keeps k6's `::` prefix** (`::LandingPage`), which matters for template variables.

Datadog also normalizes metric tag keys to lowercase and advises against camel case in them, so the
global `--tag` keys the run step adds are snake_case. The release version is not among them: setting
`service.version` already surfaces it as the `version` tag, and a second copy would drift from it.

**Tag values are normalized too**, which is easy to miss because it only bites a hand-typed query.
`--tag site=PERF` is stored as `site:perf`, so a filter written `{site:PERF}` matches nothing and returns
a no-data warning indistinguishable from a broken query. Special characters are rewritten as well: the
group `::T30_CrystalReport_10_ClickOn_Save&Close` reads back as
`::t30_crystalreport_10_clickon_save_close`, so table rows never render identically to the NeoLoad
transaction names they mirror. The dashboard is unaffected because its template variables all default to
`*` and Datadog populates their dropdowns itself.

## Querying the metrics correctly

The metrics land intact. Over a verification run k6 reported 169 requests, and
`sum:k6perf.http_reqs{…}.as_count().rollup(sum, 60)` summed to exactly 169. Turning those counts into a
**rate** is where it goes wrong.

`.as_rate()` divides by an interval Datadog infers: the rollup it picked for the current zoom, or the
metric's interval metadata, which an OTLP-submitted metric does not carry. On an 8-minute window Datadog
rolled up to ~2 seconds and divided a 10-second bucket of requests by 2, reporting 3.67 req/s against a
true 0.73. The error is the ratio of export interval to rollup interval, so it moves with the time range:
the same run read 0.29 req/s at 15 minutes and 3.67 req/s at 8.

Pin the bucket instead. `.as_count().rollup(sum, 60)` fixes the interval ourselves, so nothing is
inferred and the value cannot change with the zoom. The dashboard's throughput panels are therefore
denominated **per minute**, which also keeps scalar arithmetic out of the widget query. Ratio panels
(error rate, check failure rate) are immune either way, since an identical distortion in numerator and
denominator cancels in the division.

A fixed bucket also reads _differently from k6's summary, and more usefully_: mid-run minutes showed 0.87
req/s where k6 reported 0.73 for the run as a whole, the difference being the partial minutes at ramp-up
and shutdown that the whole-run average folds in. Expect the first and last buckets of any run to read
low for that reason.

The same trap applies to the preset dashboard below, which uses `avg:` where it needs `sum:`.

### Averages need a sum/count formula, not `avg:`

`avg:<trend>` with a scalar aggregator of `avg` does not weight by sample count. It takes the mean of
each export interval's mean, so a 10-second interval holding one request counts as much as one holding
twenty. Measured against build `20260811.3`, that read a true **429.01 ms** mean request duration as
**1139.89 ms**, and a true 355.93 ms mean transaction as 397.66 ms. Per-transaction rows were off by
-18% to +22%, in both directions, which is why the error is easy to miss by eye.

Divide the two exact reads instead:

```
sum:k6perf.group_duration{…}.rollup(sum, 60) / count:k6perf.group_duration{…}.rollup(sum, 60)
```

The error is not a side effect of the integration-owned namespace either: re-measured on `k6perf.` after
the prefix change, `avg:` still read a true 1382.54 ms mean transaction as 1660.60 ms, +20%. The
sum/count formula is required, not merely tidier.

That returns 355.928 against k6's 355.93. For the `http_req_*` metrics use `http_reqs` as the divisor
rather than `count:` for the reason in [the namespace section](#the-k6-namespace-belongs-to-the-k6-integration):
`sum:k6perf.http_req_duration{…}.rollup(sum, 60) / sum:k6perf.http_reqs{…}.as_count().rollup(sum, 60)`
returns 429.006 against k6's 429.

### Percentiles need an explicit merging rollup

Datadog stores one sketch per export interval and there is no aggregator that merges sketches across
time, so `p95:<trend>` reduced with `avg` averages a series of 10-second percentiles. On the same run
that read a true 5372 ms p95 on `SaveEventCopy` as 2436 ms, a true 3199 ms on `OpenBookingForm` as
713 ms, and in the transactions table collapsed p50/p90/p95/p99 onto a single identical number per row.

An explicit `.rollup(<interval>)` merges the sketches inside each bucket, and reducing with `max` then
reports the worst bucket:

```
p95:k6perf.group_duration{…} by {scenario,group}.rollup(900)
```

Two constraints, both measured. **The rollup must not exceed the dashboard's time window** or the widget
returns nothing: `.rollup(1800)` read over a 15-minute view came back empty, and `.rollup(86400)` came
back empty over an hour. And **a run straddling two buckets reads low**, because `max` picks the worse
bucket rather than merging both: at `.rollup(1800)` the 11-minute validation run fell in one bucket and
matched k6 within ~2%, while at `.rollup(900)` it split and the worst row read -21%. 900 is the
compromise the dashboard ships with, since a blank widget is worse than a conservative number; widen it
if the board is only ever read at an hour or more.

### A Datadog percentile is a sketch estimate, so validate it by traceability

A `pNN:` returns a **sketch bucket estimate**, not a selected sample, and it follows no standard rank
formula. Measured across 81 table cells and 116 timeseries points on a dedicated run: `floor(p*n)` fitted
every p99 cell to within 0.8% but missed p90/p95 by up to 89%, while `ceil(p*n)` fitted p95 and broke p99.
Nor is thin sampling the explanation. On the slowest transaction, widening to `.rollup(1800)` so all 52
samples merged into one bucket returned a value identical to the split read, still resolving p99 to the
second-slowest sample rather than reaching the slowest, where any rank rule over 52 samples would have
moved. (Merging is still worth it where it changes anything: two other rows read higher at 1800 than split
across two buckets, consistent with the -21% above.)

So a percentile column cannot be checked by recomputing the percentile. Check instead that every value
sits within the sketch's bucket width of a **real observation** in the window: on that run the worst
distance was **0.79%**, and each column landed near its nominal rank (p90 at the 88th-94th, p95 at the
92nd-98th, p99 at the 96th-98th percentile of the run). Two traps when building that comparison. Do not
compute the reference by linear interpolation, which is what k6's own summary does on `(n-1)`: using k6's
definition manufactures double-digit errors that are purely definitional, and it is why per-row
percentiles never tie out exactly against the k6 summary. And bucket the samples by **export time with a
one-interval tolerance**, since the exporter batches every 10s and pushes a sample at `07:38:59` into the
`07:39` bucket; without the tolerance, boundary points read as mismatches and a run's first partial minute
reads as a missing point.

**The p99 column is finer-grained than the data supports.** At 21-31 samples per row per 900s bucket the
sketch cannot separate adjacent percentiles, and on 14 of 25 rows two adjacent columns returned an
identical value (usually p95 and p99). The `neoload` profile yields the same order of samples per bucket,
so this is the steady-state behaviour rather than an artifact of a short validation run. The numbers are
accurate; it is the apparent precision that misleads, so read p99 per row as "somewhere in the tail"
rather than as a distinct figure from p95.

### Zero-filling belongs on tiles, not on grouped tables

`default_zero()` looks like the obvious way to make a "0 errors" cell read `0` instead of blank, and on a
grouped query it is a trap. Over a window with no run it manufactures a zero-valued series where none
existed, and since that series carries no group tags the table renders a **phantom row** of
`N/A / N/A / N/A` with a single `0` in the zero-filled column. The transactions table stayed correctly
empty over the same window purely because none of its formulas used it.

The plain ratio needs no help. Measured both ways on build `20260811.3`:

| Formula                                   | Row with data, no errors | Window with no data |
| ----------------------------------------- | ------------------------ | ------------------- |
| `failed_count / response_count * 100`     | `0`                      | no row              |
| `default_zero(failed_count) / response_…` | `0`                      | phantom `N/A` row   |
| `default_zero(failed_count / response_…)` | `0`                      | phantom `N/A` row   |

Wrapping the whole expression rather than the numerator does not help, so the rule is simply that a
grouped query does not get zero-filled. What does fix a blank ratio on a clean run is expressing it as
separate named queries joined by a formula rather than as one inline `q` division — that alone returns
`0` where the single-query form returned nothing.

The ungrouped count tiles (Failed checks, Failed, Dropped) do keep `default_zero()`, and should. A
single-value tile has no rows to invent, and those read from a `condition:nonzero` series that simply
does not exist on a clean run, so without it "no failures" and "query broken" look identical. The cost is
that they read `0` rather than blank when no run is in the window, which is the right trade for a tile and
the wrong one for a table.

### The `k6.` namespace belongs to the k6 integration

`K6_OTEL_METRIC_PREFIX` is `k6perf.`, not `k6.`, and this is the reason. Datadog's k6 integration claims
every `k6.http_req_*` name it recognises and stamps its own metadata over them — the giveaway is that
`k6.http_req_duration` carries the description "Total number of HTTP requests", which belongs to
`http_reqs`, plus `unit_name: unit`. Under that claimed metadata the histogram's `count` and `max`
sub-values stop resolving and both reads silently fall back to the interval sum:

| Metric                  | `integration` | `count:` returns           |
| ----------------------- | ------------- | -------------------------- |
| `k6.group_duration`     | _(none)_      | 969, the true sample count |
| `k6.iteration_duration` | _(none)_      | 66, the true sample count  |
| `k6.think_time`         | _(none)_      | 961, the true sample count |
| `k6.http_req_duration`  | `k6`          | the summed duration        |
| `k6.http_req_waiting`   | `k6`          | the summed duration        |

`max:` degrades the same way, returning an interval sum: 23340 ms for `SignIn` where the slowest actual
request was 17687 ms, and 1566 ms for `OpenEventDocumentForm` against a true 584 ms. Enabling percentile
aggregation does not help — it was already on for `k6.http_req_duration` and the reads stayed wrong.

This predates the histogram-aggregation change and is not caused by it: builds `20260811.1` and `.2` ran
about five hours before that commit and show identical behaviour. The prefix is the only lever k6 exposes,
so moving off the namespace is the fix. Historical `k6.*` series stay under their old names rather than
migrating, and the integration tile stops populating, which costs nothing given how little of its preset
dashboard works.

## The second feed: generator CPU and RAM

k6 knows nothing about the box it runs on, so agent resource usage reaches Datadog by its own path.
`resource-sampler.ps1` (Windows) / `resource-sampler.cjs` (Linux) writes a CSV row per second, and
`metric-forwarder.cjs` tails that CSV and posts its numeric columns to the plain metrics intake as
gauges (`POST /api/v2/series`, `DD-API-KEY` header). Same reasoning as the OTLP route above: nothing
installed on the agent, no billable infrastructure host.

Three decisions worth recording:

- **The forwarder is separate from the samplers rather than folded into them.** There are two resource
  samplers, one per OS, plus the GC sampler, so posting from inside each would mean an intake client
  written twice across two languages. Keeping the samplers as plain CSV writers also keeps the
  published artifact unaffected when a submit fails: the CSV is the record, Datadog is the live view.
  Any CSV shaped `timestamp,<numeric columns…>` works, so pointing a second instance at `gc-usage.csv`
  is a yaml change rather than a code change.
- **The hostname is an ordinary `agent:` tag, not a `host` resource.** The intake accepts a host
  resource on a submitted series, but the point of the agentless route is that these boxes never
  become monitored hosts, so nothing is submitted that asks Datadog to treat one as an entity.
- **Points keep their 1-second resolution.** The forwarder batches every 10 seconds, matching
  `K6_OTEL_EXPORT_INTERVAL`, but sends every 1-second row in the batch instead of averaging them:
  custom-metric billing counts distinct timeseries per hour, not data points, so full resolution costs
  the same as a tenth of it.

The series are `k6perf.agent.*`, one per CSV column lowercased, tagged `service`, `env`, `version`, `site`,
`build_number` and `agent`. The first five mirror what OTLP derives from the resource attributes so the
dashboard's template variables filter both feeds identically. There is deliberately **no `scenario`
tag** — a machine-level metric has no scenario — so `$scenario` does not filter the generator panels.

Two limits, both cosmetic and neither touching `resource-usage.csv`. A failed submit is logged and
abandoned rather than retried, because requeued points would age out of the intake's one-hour window
anyway; the run step raises a build warning when the forwarder log contains `submit failed`, on the
same reasoning as the OTLP warning. And the pipeline force-kills the forwarder when k6 exits, so the
last batch, up to 10 seconds of samples, may never be sent.

What was verified locally, with the intake stubbed: CSV tailing across both samplers' formats (CRLF
with a UTC-offset stamp from PowerShell, LF with `Z` from Node), a partial trailing row held back until
complete, blank cells skipped rather than sent as zero, rows older than the intake's window dropped
before they can fail the batch they travel in, no duplicate points across batches, and the payload
shape and headers. The **round trip to the real intake is unverified** until the next queued run, since
the masked key is not available locally.

## Datadog-side setup that is not automatic

Metric creation is automatic: no registration or schema, metrics appear in Metrics Summary within a
minute of the first export. Two things are not:

1. **Percentile and average aggregations are off by default** and must be enabled per metric from the
   Metrics Summary page. A clean OTLP distribution offers count, sum, min and max only; both `avg:` and
   `pNN:` return HTTP 400 (`missing_aggregation :: aggregations: AGG_AVG/AGG_P99`) until the toggle is
   set, and it covers avg alongside the percentiles so it is one action rather than two. The failure is
   not graceful: a `query_table` whose column set includes percentiles **fails entirely** with that 400
   rather than rendering with blank percentile cells, so both detail tables were unrenderable until it
   was enabled. Enable it on the duration metrics **before** the run you intend to watch, since the
   setting applies going forward and never backfills: data ingested earlier returns null for percentiles
   permanently. It roughly doubles the billable custom metrics for those metrics, so enable it
   deliberately rather than across the board. Enabling it is necessary but not sufficient: a percentile
   still needs the merging rollup above to read correctly, and on an integration-owned name it stays
   wrong however it is queried. Re-enable after any change to `K6_OTEL_METRIC_PREFIX`, since the new
   metric names start with the setting off.
2. **The dashboard is hand-built.** Its definition is committed under `.azure/dashboards/`, so a query
   fix is reviewable in a diff and can be re-imported rather than clicked in one widget at a time.
   Datadog holds the live copy and nothing automates the two into step, so treat the file as the intended
   state and re-import after editing it. Datadog's k6 integration tile installs itself once
   `k6.http_reqs` is seen, and its preset dashboard does arrive, though ours took about a day rather than
   appearing with the tile. Under the `k6perf.` prefix that name is no longer produced, so the tile will
   not install for new data. It is read-only, and measured against a live run only one of its six panels is trustworthy:

   | Preset panel                                                                 | Behaviour on the OTLP path                                                  |
   | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
   | Virtual users                                                                | Correct                                                                     |
   | Request per second, Data sent/received                                       | Aggregate with `avg:` across series, so the value moves with the zoom level |
   | HTTP request duration, Response timings - 95th, Response time 95th - HeatMap | Permanently empty                                                           |

   The three timing panels query StatsD sub-metrics such as `k6.http_req_duration.95percentile`, names
   the OTLP path never creates (ours is one distribution queried as `p95:`), so no configuration on our
   side populates them. The preset also carries no error-rate, check, `group_duration`, or
   dropped-iteration panel, because the integration's metric list does not include those, covering only
   the `http_req_*` timings, `http_reqs`, `iteration_duration`, `iterations`, `vus`, `vus_max`,
   `data_sent`, and `data_received`. So it cannot answer "is this run healthy" even on the DogStatsD path
   it was designed for.

   Editing it in place is not possible. Cloning it is, but a clone needs the same `dashboards_write`
   permission an import does, and would take five query rewrites plus six new widgets to reach what the
   hand-built dashboard already does. The preset is left installed as a shape-only glance.

## Cost

Negligible, because of how Datadog counts. Billable custom metrics are "the total of all distinct
custom metrics for each hour in a given month, divided by the number of hours in the month". The load
pipeline is manually queued at roughly 40 minutes per run, so the series exist for only a couple of
clock hours per run:

```
3,000 series x 8 active hours / 730 hours in a month = ~33 billable custom metrics
```

The lever that matters is **run frequency, not tag cardinality**. Putting this pipeline on a schedule
that runs continuously is what would turn a rounding error into a real line item.

## Known limits

- **Aggregation, not bucket resolution, is what limits accuracy.** Bucket width used to be the ceiling:
  the SDK's default explicit buckets topped out at 10s with everything above collapsing into the final
  bucket. Base2 exponential histograms removed that (0.3-1.1% bucket width at the scales k6 picks), and
  a run read back against its own JSON firehose now matches on every count and total and to ~2% on
  merged percentiles. What remains is query-side: percentiles cannot be merged across an arbitrary
  window, only across a fixed rollup that must fit inside the view, so a Datadog percentile is always
  "the worst N-minute window" rather than the whole run. The published artifacts stay the reporting
  source of truth for that reason, not because the data on the wire is lossy.
- **Per-request Min, Max and percentiles are only as good as the namespace.** They were unusable while
  the metrics sat under `k6.` (see [the namespace section](#the-k6-namespace-belongs-to-the-k6-integration)).
  The `k6perf.` prefix restores them, now confirmed rather than inferred: read back against their own
  `k6-metrics.json.gz`, Min, Max, Avg and Count are exact to 0.00% on all 25 rows of both detail tables,
  and `max:` returns the true slowest request instead of an interval sum. What remains is the percentile
  resolution limit above, not a namespace problem.
- **No retry buffer.** Without an Agent, a network blip mid-run leaves a gap in the live dashboard.
  Accepted deliberately: the dashboard is a sanity check, and the artifacts are unaffected.
- **The generator is still not a monitored host.** Its CPU, RAM and network now stream as custom metrics
  (see [the second feed](#the-second-feed-generator-cpu-and-ram)), so they graph live and can be
  alerted on, but there is no host entity, host map, or process-level detail behind them. k6's own Go
  runtime and GC counters are not forwarded at all and stay in the `gc-usage.html` artifact.
- **Payload cap not yet measured at full scale.** The intake caps a request at 512 KiB compressed. A
  12-metric probe was 2453 bytes uncompressed, and k6 sends no compression by default. A full five-flow
  run has not been measured against that ceiling; if it comes close, set
  `OTEL_EXPORTER_OTLP_COMPRESSION=gzip`.

## Gotcha when running locally

Git Bash rewrites POSIX-looking values into Windows paths, so setting the OTLP URL path there turns
`/v1/metrics` into `C:/Program Files/Git/v1/metrics` and every export 404s with `HTTP path is invalid`.
The default path is already correct, so simply do not set it, or export `MSYS_NO_PATHCONV=1`. CI runs
PowerShell and is unaffected.

## Turning it off

Streaming is skipped automatically when `DD_API_KEY` is unset, including the case where the pipeline
variable is undefined and arrives as the literal `$(DD_API_KEY)`. Clearing the variable disables
streaming without touching the yaml, and the published artifacts are unaffected either way. Because k6
logs export failures at info level and still exits 0, a failed upload would otherwise leave an empty
dashboard on a green build, so the run step scans the console log and raises a build warning.

## Sources

- [k6 OpenTelemetry output](https://grafana.com/docs/k6/latest/results-output/real-time/opentelemetry/)
- [k6 Datadog output](https://grafana.com/docs/k6/latest/results-output/real-time/datadog/) (the StatsD route, superseded)
- [Datadog k6 integration](https://docs.datadoghq.com/integrations/k6/) (the Agent-plus-DogStatsD setup it documents, and the preset dashboard's metric list)
- [Datadog OTLP metrics intake](https://docs.datadoghq.com/opentelemetry/setup/otlp_ingest/metrics/)
- [Datadog submit-metrics API](https://docs.datadoghq.com/api/latest/metrics/submit-metrics/) (the agent-metric feed: payload shape, 500 KB cap, one-hour timestamp window)
- [Datadog OTLP metric types mapping](https://docs.datadoghq.com/metrics/open_telemetry/otlp_metric_types/)
- [Datadog OTel semantic mapping](https://docs.datadoghq.com/opentelemetry/schema_semantics/semantic_mapping/)
- [Datadog custom metrics billing](https://docs.datadoghq.com/account_management/billing/custom_metrics/)
- [Datadog distributions](https://docs.datadoghq.com/metrics/distributions/)
