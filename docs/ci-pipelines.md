# The Azure Pipelines CI setup

Reference for the two pipelines in `.azure/workflows/`. The YAML itself is deliberately comment-free,
so this doc is where the reasoning lives: what each moving part is for, and what breaks if it is
changed or removed.

Datadog specifics are only summarized here. [datadog-live-metrics.md](./datadog-live-metrics.md) is
the authoritative record of what was measured and why, and is the doc to read before touching any
`K6_OTEL_*` or `OTEL_*` value.

## The two pipelines

| Pipeline              | Trigger                              | What it does                                                                                                                              |
| --------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `k6-tests-ci-dev.yml` | PRs targeting `main`, plus each push | PR validation on a hosted Ubuntu agent. Builds only, never runs k6: `npm ci`, placeholder secret, `tsc --noEmit`, publish.                |
| `k6-tests-ci.yml`     | Manual queue only (`trigger: none`)  | The real load run, on the self-hosted `Momentus-Cloud` pool. Runs `neoload.spec.ts` under observation and publishes the results artifact. |

Everything below describes `k6-tests-ci.yml`.

## Queue-time parameters

Set in the queue dialog, so changing a run does not require a commit. All are dropdowns of allowed
values except `k6Version`, which is free text so any release tag can be typed.

| Parameter        | Default   | Notes                                                                                                                                                                                                                                                            |
| ---------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `profile`        | `neoload` | `neoload` is the full 5m ramp + 35m sustain load model. `neoload-smoke` is the same 50-VU shape compressed to 2m + 8m, for validating the pipeline and the live dashboard without paying for a 40-minute run. Shapes live in `source/config/profiles.config.ts`. |
| `releaseVersion` | `26_2`    | Mirrors the `ReleaseVersion` union in `source/utils/types/config.type.ts`. Extend both together at a branch cut, or the dropdown goes stale.                                                                                                                     |
| `fidelity`       | `lean`    | Tier the journeys replay at (see `.claude/rules/fidelity.md`). `full` fires the UI-chrome and static-asset tiers around the correlated spine for the most realistic load, `ui` and `lean` step down from there.                                                  |
| `pacing`         | `300`     | Seconds each iteration is paced to by `pace()` in `neoload.spec.ts`.                                                                                                                                                                                             |
| `k6Version`      | `v2.0.0`  | Free text, so any release tag works, and `latest` is accepted for a deliberate "try the new k6" run. See [Why the k6 version is pinned](#why-the-k6-version-is-pinned).                                                                                          |

## Variables

Each parameter is re-bound as a variable of the same name. This is not redundancy: a bare
`${{ parameters.x }}` inside a double-quoted PowerShell string does not parse as PowerShell. Azure
substitutes it before the script runs, so it works, but every editor and linter sees the
unsubstituted text and reports a syntax error. Binding to variables lets every inline script stay on
the `$(name)` macro form, which parses cleanly either way.

The rest:

- `site` is fixed at `PERF`, deliberately not a parameter. PERF is the only site perf runs target
  (QE, AT and RC are debug-only), so a dropdown here would only invite a wrong run.
- `specPath` is referenced by the run step and by both graphing steps, so the spec name and the
  resolved VU config printed on the report always match what actually ran.
- The Datadog service name is not a variable. `run-k6.ps1` derives it from the release version as
  `k6/performance/<version>`, mirroring the app's own APM service naming so k6 metrics sort next to
  the service under test, prefixed `k6/` so a load generator is never mistaken for an application.
  Deriving it in one place keeps the k6 feed and the agent feed from drifting apart.
- `datadogEndpoint` is the agentless OTLP intake and `datadogMetricsUrl` the plain metrics intake.
  Agent CPU and RAM come from the resource sampler's CSV rather than from k6, so they need the second
  feed. Both must point at the same Datadog site.

## Secrets

Two masked pipeline variables are set in the UI and never appear in YAML: `K6_DECRYPT_KEY` (the
passphrase that decrypts the committed user pool) and `DD_API_KEY`.

Both are passed to steps through an `env:` block rather than inline `$(...)`, so the masked value is
never expanded into the build log. The same reasoning drives two smaller choices in the run step:
`K6_OTEL_HEADERS` is composed inside the script rather than declared as a step env value, and the
metric forwarder inherits `DD_API_KEY` from the step's environment via `Start-Process` rather than
receiving it as an argument, so the key never lands on a command line where a process list would
show it.

## Where the logic lives

The pipeline YAML carries almost no logic. The three steps with real behaviour in them are scripts in
`.azure/scripts/`, and the YAML step is a one-line call passing parameters:

| Script              | Step                                                                                                                            |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `install-k6.ps1`    | Downloads and PATHs the k6 binary                                                                                               |
| `run-k6.ps1`        | Creates the report folders, starts the samplers, sets the k6 and OTLP environment, runs k6, scans for silent streaming failures |
| `cleanup-agent.ps1` | Removes the secret, generated config, report tree and binary                                                                    |

These sit alongside the samplers, graphers and forwarder the run invokes, so the whole CI-runtime
toolchain is one folder. The reason for extracting them is not only YAML length: a `.ps1` can carry
its own comments and be checked by PSScriptAnalyzer, and `run-k6.ps1` is callable outside CI. A local
validation run reproduces the pipeline's exact configuration by invoking it, rather than mirroring
the environment block by hand and drifting from it.

The environment variables for k6 and OTLP are therefore set inside `run-k6.ps1`, not in the YAML
step. The single exception is `DD_API_KEY`, which the step passes from its masked pipeline variable.

## Step reasoning

### Install k6

The official standalone-binary install: download the GitHub Releases build for this OS, unpack it
into the agent temp directory, prepend it to PATH. Chosen over winget, choco or apt because it
installs nothing machine-wide and the cleanup step wipes it, which matters on a persistent
self-hosted agent.

Two OS details are load-bearing. `$IsWindows` does not exist in Windows PowerShell 5.1, so the
Windows check is `$env:OS -eq 'Windows_NT'`, which works on both 5.1 and PowerShell Core. And 5.1 may
default below TLS 1.2, which GitHub rejects, so the protocol is forced before the first request.

Any copy left by a previous run is removed first, so k6 is always freshly downloaded.

### Why the k6 version is pinned

The install originally resolved `releases/latest`, which meant two runs of the same commit could
execute different k6 builds, and nobody chose when that changed. It had already drifted: the
Datadog wire-shape measurements recorded in [datadog-live-metrics.md](./datadog-live-metrics.md) were
taken against **v2.0.0**, while `latest` had moved on to v2.2.0 by 2026-08-10.

It is now pinned to `v2.0.0`, the version those measurements describe, so the streaming behavior the
doc documents is the behavior the pipeline actually gets. Passing `latest` as the parameter still
resolves the newest release for a one-off run.

Open question, not yet investigated: whether anything in v2.1 or v2.2 changed the OTLP export shape.
Runs made while the install was unpinned were on those newer builds, so their live-dashboard data may
not be comparable with runs made under the pin. Re-validating the wire shape against a newer k6 is
the prerequisite for moving the pin forward.

### Report folders

Created by `run-k6.ps1` before it starts anything. Everything the run publishes lands under
`reports/<category>/`, never bare `temp/` where the
plaintext `secret.json` lives. That separation is load-bearing: it is what lets the artifact be
published straight from `reports/` with no filtering, instead of maintaining a filename allow-list.
Anything written outside `reports/` is not published, and anything written inside it is.

### Run k6 load test

Three background processes are started before k6 and killed in a `finally` block afterwards:

- The **resource sampler** records agent CPU, RAM, network and load. Linux agents use the Node
  sampler reading `/proc`, Windows agents use the `Get-Counter` sampler.
- The **GC sampler** scrapes k6's own Go runtime and GC metrics from the Prometheus endpoint that
  `--address` and `--profiling-enabled` expose. This measures the load generator, not the system
  under test, and it is how generator saturation is distinguished from application slowness.
- The **metric forwarder** tails the resource CSV and posts gauges to Datadog. It only starts when
  streaming is on.

**The streaming gate.** One flag, `$streamToDatadog`, gates both live feeds, and an unset
`DD_API_KEY` is the off switch. The check is not a simple truthiness test: an undefined Azure
pipeline variable arrives as the literal string `$(DD_API_KEY)`, so the `-notmatch '^\$\('` clause is
what keeps that case on the skip path instead of streaming with a junk key.

**Tags.** Datadog normalizes metric tag keys _and values_ to lowercase, so tag names are snake_case
rather than camelCase, and `site=PERF` reads back as `site:perf`. A hand-typed `{site:PERF}` filter
silently matches nothing. The release version is deliberately not tagged on the k6 feed:
`service.version` already surfaces it as the `version` tag, and a second copy would drift. The
forwarder's tags are set to mirror what OTLP derives from the resource attributes, because the
dashboard's template variables have to filter both feeds identically.

**Failure warnings.** Both feeds log their failures and keep going: k6 logs an OTLP export failure at
info level and still exits 0. Without the post-run log scan, a bad key or blocked egress would leave
an empty live dashboard sitting behind a green build. The scan raises a build warning instead. The
published artifacts are unaffected either way, which is why this is a warning and not a failure.

**Environment block.** The web-dashboard variables keep k6's default 10s aggregation period, because
a 1s period over a 40-minute run bloats `report.html`. The load run is long enough that the report
always renders with graphs. For the OTLP variables, each one is doing real work:

| Variable                                                      | What breaks without it                                                                                                                                                                        |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `K6_OTEL_METRIC_PREFIX: k6perf.`                              | On the default `k6.` namespace, Datadog's k6 integration claims the names it recognises and stamps its own metadata over them, which breaks `count:` and `max:` on every `http_req_*` series. |
| `OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE: delta`    | Required, not optional. The intake accepts delta only and k6 defaults to cumulative, so every export is rejected.                                                                             |
| `OTEL_EXPORTER_OTLP_METRICS_DEFAULT_HISTOGRAM_AGGREGATION`    | k6 registers no histogram view, so trends inherit the OTel SDK's default explicit buckets (10s top bound), which inflates averages and collapses p90, p95 and p99 onto max.                   |
| `OTEL_RESOURCE_ATTRIBUTES` with an explicit `service.version` | k6 otherwise reports its own version here, which Datadog maps to the `version` tag, so load metrics would not line up with the app service.                                                   |

### Reporting steps

`k6 inspect --execution-requirements` resolves the spec's executor, max VUs, stages and duration with
zero traffic, so the generated reports can state what actually ran. It reads `temp/setup.json` and
`temp/secret.json`, which is why it has to run before cleanup. The output is written with
`Out-File -Encoding utf8` for the Node graphers, which strip the BOM.

The group aggregator turns the k6 JSON firehose into per-transaction `group_duration` timings, so
each k6 group compares one-to-one with its NeoLoad transaction. It emits a CSV for diffing against a
NeoLoad export plus an HTML table matching the other artifacts.

All reporting steps run on `condition: always()`, so a failed or threshold-breaching run still
publishes its diagnostics.

### Publish

`reports/` is published directly as the `k6-results` artifact, with no staging copy. The classic
copy-to-`$(Build.ArtifactStagingDirectory)`-first pattern would only matter if a later step wrote to
`reports/` and the artifact needed freezing at copy time, or if the artifact were a filtered subset
of a wider tree. Neither applies: nothing writes there after the reporting steps, and the whole
folder is the artifact.

### Cleanup

Runs after publish, on `condition: always()`, so nothing sensitive lingers on the persistent
self-hosted agent: the plaintext passphrase, the generated setup and exec-req files, the published
`reports/` tree, and the downloaded k6 binary and archive.

Known gap: a cancelled or timed-out job may not reach this step, leaving `temp/secret.json` on the
agent until the next run overwrites it.

## Timeout budget

`timeoutInMinutes: 60`. The `neoload` profile runs 5m ramp plus 35m sustain with no ramp-down, about
40.5 minutes including graceful stop; `neoload-smoke` is about 10.5 minutes. The budget covers the
longer of the two plus `npm ci`, the fresh k6 download, graphing, publish and cleanup.

## Agent pool

The pool is `Momentus-Cloud` with no demands. Every step detects Windows versus Linux at runtime, so
no `Agent.OS` demand is needed. Add a demand such as `Agent.Name -equals <agent>` only to pin the job
to one specific machine, for example to compare two runs on identical hardware.
