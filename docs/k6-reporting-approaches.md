# k6 Reporting Approaches

A record of the reporting options evaluated for this project — what each one delivers, its trade-offs, and why we settled on the built-in web dashboard. Motivation throughout: get a readable post-run report **without consuming Grafana Cloud VuH** (see [grafana-cloud-free-tier.md](grafana-cloud-free-tier.md) for the cost model). Behaviour is from official Grafana k6 documentation; the options other than the web dashboard were prototyped and then removed, so treat their descriptions as a design record, not current code.

## The core constraint

k6 exposes run data through two surfaces that never overlap:

- **End-of-test aggregates** — `handleSummary(data)` receives a snapshot of aggregated metrics **and** per-group results (`root_group.groups[]`), but **no time-series**.
- **Time-series** — only the streaming outputs (the web dashboard's internal stream, `--out json`/`csv`, or Prometheus remote-write) carry value-over-time, tagged with `group`/`name`/etc.

So **graphs over time** and **per-group timings** come from different places. No single official surface renders both together — every option below is a way of working around that split.

## Options evaluated

| Approach                           | Graphs | Group timings | VuH      | Portable file  | Maintenance                   | Outcome             |
| ---------------------------------- | ------ | ------------- | -------- | -------------- | ----------------------------- | ------------------- |
| Built-in web dashboard             | ✅     | ❌            | none     | ✅ single HTML | none (official)               | **Kept**            |
| `handleSummary` + k6-reporter      | ❌     | ✅            | none     | ✅ single HTML | vendored lib                  | Rejected            |
| Dashboard + reporter (iframe tabs) | ✅     | ✅            | none     | partial        | vendored lib + glue           | Rejected            |
| Local Grafana + Prometheus stack   | ✅     | ✅            | none     | ❌ (live site) | off-the-shelf, needs Docker   | Removed             |
| Custom `--out json` → HTML builder | ✅     | ✅            | none     | ✅ single HTML | **ours** + vendored chart lib | Removed             |
| Grafana Cloud k6                   | ✅     | ✅            | **paid** | ❌             | SaaS                          | Out of scope (cost) |

### 1. Built-in web dashboard — _kept_

`K6_WEB_DASHBOARD=true` + `K6_WEB_DASHBOARD_EXPORT=<file>` produces a self-contained, time-series HTML report from a local run. Zero VuH.

- ✅ Official, zero maintenance, one portable HTML file, good-looking time-series panels.
- ⚠️ **No per-group breakdown** — the group submetrics are present in the report's embedded data but the dashboard ships no panels to render them, and it can't be customised (only a handful of env controls; the underlying xk6-dashboard project was archived in 2026).
- ⚠️ The HTML is **skipped on very short runs** — it needs a test duration greater than 3× the aggregation period (`K6_WEB_DASHBOARD_PERIOD`). Use a longer run or a load profile.

### 2. `handleSummary` + k6-reporter

The community [`benc-uk/k6-reporter`](https://github.com/benc-uk/k6-reporter) turns the `handleSummary` aggregate object into an HTML report with per-group/per-check tables.

- ✅ Per-group timings, zero VuH, single file.
- ❌ **No time-series graphs** (handleSummary has no time data). The aggregate-table look was judged not good enough on its own.
- ⚠️ Requires vendoring a third-party bundle.

### 3. Dashboard + reporter combined (iframe tabs)

A wrapper that produced both the web dashboard HTML and the k6-reporter HTML and stitched them into one tabbed landing page.

- ✅ Both views reachable from one entry point.
- ❌ Two disjoint reports behind tabs, not a unified report; clunky. Rejected.

### 4. Local Grafana + Prometheus stack

`k6 run -o experimental-prometheus-rw` streaming to a local Docker stack (Prometheus + Grafana, auto-provisioned with the official k6 dashboard plus a custom per-group dashboard). Native histograms (`K6_PROMETHEUS_RW_TREND_AS_NATIVE_HISTOGRAM`) give accurate aggregated percentiles; the `group` label drives a per-group breakdown the built-in dashboard can't show.

- ✅ Graphs **and** per-group breakdown, polished off-the-shelf dashboards, zero VuH (run stays local).
- ⚠️ Needs **Docker running** and a live Grafana to view — results aren't a portable file (you'd export a snapshot/PNG to share).
- Verified working end-to-end (per-group native-histogram percentiles populated correctly), then removed in favour of simplicity.

### 5. Custom `--out json` → HTML builder

`k6 run --out json=…` emits an NDJSON stream where every `Point` carries `time`, `value`, and `tags` (`group`, `name`, …). A Node post-processor bucketed the time-series and computed per-group/per-request percentiles, rendering one self-contained HTML with an inlined charting library ([uPlot](https://github.com/leeoniya/uPlot)).

- ✅ Graphs **and** group/request timing tables in **one portable file**, zero VuH, no Docker.
- ⚠️ We **own and maintain a mini-dashboard renderer** and vendor a chart library; the `--out json` file grows large on big runs (would need downsampling).
- Verified working end-to-end against a live run, then removed — the maintenance burden wasn't justified over the built-in dashboard.

### 6. Online (Grafana Cloud)

Covered in [grafana-cloud-free-tier.md](grafana-cloud-free-tier.md). The key cost split: **Grafana Cloud k6** (`k6 cloud run`) bills **VuH** even with `--local-execution`; **Prometheus remote-write to Grafana Cloud** does not (it counts against the active-series cap). Out of scope here because the whole motivation was avoiding VuH.

## Decision

**Keep only the built-in web dashboard for now.** It is the lowest-effort, zero-maintenance, zero-VuH option and produces a shareable single-file time-series report. The missing per-group breakdown is an accepted limitation; the options that add it (the Grafana stack, the custom builder) each carry ongoing cost — Docker/infra or a renderer we maintain — that isn't worth it at the current scale. If per-group analysis becomes a regular need, the local Grafana + Prometheus stack (no new code to maintain) is the preferred next step over rebuilding a custom renderer.

## Sources

- https://grafana.com/docs/k6/latest/results-output/web-dashboard/
- https://grafana.com/docs/k6/latest/results-output/end-of-test/custom-summary/
- https://grafana.com/docs/k6/latest/results-output/real-time/json/
- https://grafana.com/docs/k6/latest/results-output/real-time/prometheus-remote-write/
- https://github.com/grafana/xk6-dashboard
- https://github.com/benc-uk/k6-reporter
- https://github.com/leeoniya/uPlot
