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
  inconclusive: `avg:k6.http_req_sending{service:k6/performance/26_2}` returns data, so `service.name`
  and `deployment.environment.name` map to `service` and `env`.
- **`service.version` must be set explicitly.** Left alone, k6 reports its own version (`2.0.0`) in that
  attribute, which Datadog maps to the `version` tag, so load-test metrics would read `version:2.0.0`
  beside an app service at `26_2`.
- **Trends arrive as distributions**, with explicit bucket bounds
  `[0,5,10,25,50,75,100,250,500,750,1000,2500,5000,7500,10000]` ms.
- **Rates are counts, not ratios.** A k6 Rate arrives as `<name>.total`, a sum carrying a `condition`
  attribute. A failure-rate panel must compute `sum(condition:nonzero) / sum(all)`; querying
  `k6.http_req_failed.total` directly gives a count.
- **The `group` tag keeps k6's `::` prefix** (`::LandingPage`), which matters for template variables.

Datadog also normalizes metric tag keys to lowercase and advises against camel case in them, so the
global `--tag` keys the run step adds are snake_case. The release version is not among them: setting
`service.version` already surfaces it as the `version` tag, and a second copy would drift from it.

## Querying the metrics correctly

The metrics land intact. Over a verification run k6 reported 169 requests, and
`sum:k6.http_reqs{…}.as_count().rollup(sum, 60)` summed to exactly 169. Turning those counts into a
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

The series are `k6.agent.*`, one per CSV column lowercased, tagged `service`, `env`, `version`, `site`,
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

1. **Percentile aggregations are off by default** and must be enabled per metric from the Metrics
   Summary page. Without them a distribution offers count, sum, min, max, and avg only, so there is no
   p95. Enable them on the duration metrics **before** the run you intend to watch, since the setting
   applies going forward rather than backfilling. It roughly doubles the billable custom metrics for
   those metrics, so enable it deliberately rather than across the board.
2. **The dashboard is hand-built.** Datadog's k6 integration tile installs itself once `k6.http_reqs` is
   seen, and its preset dashboard does arrive, though ours took about a day rather than appearing with
   the tile. It is read-only, and measured against a live run only one of its six panels is trustworthy:

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

- **Bucket resolution caps percentile accuracy.** k6's OTel output exposes no bucket configuration, and
  the default explicit buckets top out at 10s, with everything above collapsing into the final bucket.
  Bucket widths above 1s are coarse. This is the main reason the published artifacts, not Datadog,
  remain the reporting source of truth.
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
