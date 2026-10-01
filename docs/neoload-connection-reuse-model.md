# k6 ↔ NeoLoad connection-reuse model: why keep-alive-on is the faithful config

**Status: finding, 2026-07-27 (BO-15976).** Resolves the long-standing "k6 read steps read ~1.5–1.9× slower per
transaction than NeoLoad" question. The headline result is a correction: the premise that NeoLoad's
`useKeepAlive="false"` means a fresh connection per request was wrong. NeoLoad reuses connections, so k6's
`noConnectionReuse: true` was an artificial worst-case, and that setting is the entire read overshoot. The
faithful config and the recommended config are the same thing: HTTP/2 with keep-alive on.

## TL;DR

- The real browser/app traffic was recorded over **HTTP/2** (single reused, multiplexed connection).
- NeoLoad's comparison population (`k6_comparison_50VU`) explicitly set its browser profile to `http2="true"`, so
  NeoLoad **also replayed over HTTP/2**, a single reused multiplexed connection. Its documented HTTP/1 fallback is
  a reused 6-connection pool. Either way, connections are reused, independent of the per-request `useKeepAlive`
  flag.
- So neither the browser (~1 connection) nor NeoLoad (HTTP/2, ~1 connection) opens a fresh connection per request.
- k6 run with `noConnectionReuse: true` opened ~100 fresh TCP+TLS connections per read step. That per-request
  handshake cost, which neither the browser nor NeoLoad pays, is the read overshoot.
- k6 with keep-alive on (its default, auto-negotiating HTTP/2) reused connections and read **0.5–0.95×** NeoLoad
  all along, because keep-alive on is the faithful match.
- **Action: standardise on HTTP/2 + keep-alive on. Rebaseline SLAs against k6 in that config. Retire the
  keep-alive-off / force-HTTP/1.1 comparison knobs, which mirror a NeoLoad behaviour that does not exist.**

## Background: the question

At `FIDELITY=full`, each k6 transaction replays a correlated spine plus the UI-chrome, static-asset, and
transport tiers, one `http.batch` per recorded NeoLoad page. When we compared per-step `group_duration` against
NeoLoad run #5, the read-heavy steps (Launch, Login, ClickCalendarTab) read 1.5–1.9× NeoLoad even after we had
matched batching, request count, and (we thought) connection handling. Example, book_event medians (ms):

| Step                          | NeoLoad #5 | k6 keep-alive off | ratio |
| ----------------------------- | ---------: | ----------------: | ----: |
| Launch                        |        542 |              1001 | 1.85× |
| Login                         |        887 |              1511 | 1.70× |
| ClickCalendarTab              |        842 |              1409 | 1.67× |
| EnterdetailsClickSave (write) |       1604 |              1855 | 1.16× |

Writes matched; reads overshot. The overshoot scaled with request count per step, which is the fingerprint of a
per-request cost.

## The prior premise (now known to be wrong)

The NeoLoad recording sets `useKeepAlive="false"` on every `<http-action>` (verified uniform across the VU tree).
We read that as "non-persistent: a fresh TCP+TLS connection per request" and mirrored it in k6 with
`noConnectionReuse: true` (the `noConnReuse` / `NO_CONN_REUSE` knob on `neoload.spec.ts` and the CI pipeline). That
mapping was the error.

## What was ruled out first (the long way round)

Before finding the connection-model misread, each of these was tested and eliminated with evidence, so they are
recorded here to save the next person repeating them:

| Hypothesis                                                                 | Verdict               | Evidence                                                                                                                                                                       |
| -------------------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| k6 fires more requests than NeoLoad                                        | Ruled out             | 465 k6 vs 476 NeoLoad requests for book_event; page-count parity confirmed (NeoLoad Launch container = 15 sequential embedded-action pages, k6 matches)                        |
| JavaScript / scripting time inflates `group_duration`                      | Ruled out             | Per-iteration timeline reconstruction: read-step makespan is 98–99% HTTP work                                                                                                  |
| k6 load generator saturated                                                | Ruled out             | Agent CPU avg 15% / p95 41%, GC pause max ~9.5 ms, network far from saturated                                                                                                  |
| HTTP/2 is slower than HTTP/1.1 here                                        | Minor, not the driver | Forced-HTTP/1.1 CI run showed no speed-up; local delta ~10%, negligible at CI latency                                                                                          |
| TLS session resumption (NeoLoad resumes, k6 does not)                      | Ruled out             | Server is TLS 1.3 (probed); k6's handshake is already ~1 RTT (~6 ms), so resumption cannot save a round-trip                                                                   |
| Lower effective concurrency in k6                                          | Ruled out             | k6 fires one `http.batch` per page at `batchPerHost: 6`; NeoLoad pages are `playRequestsSequentially="false"` with `connections="6"`. Page-level concurrency matches by design |
| Socket-wait accounting (k6 counts `http_req_blocked`, NeoLoad excludes it) | ~1–2% only            | Timeline reconstruction: pure dead-wait (blocked with nothing else in flight) is 1–2% of makespan; `blocked` overlaps concurrent transfers                                     |

After all of the above, the read-step makespan was ~99% genuine, productive HTTP work (fresh-connection
connect + TLS + transfer), with structure, count, concurrency, protocol, and TLS all matching NeoLoad. That left
only one possibility: the per-request handshake cost itself, which pointed back at whether NeoLoad actually pays
it.

## The resolution: NeoLoad reuses connections

Two independent facts settle it.

**1. The recording was HTTP/2.** The captured request for the Launch page (extracted from the NeoLoad recording
artifact) is:

```
GET https://performance.ungerboeck.net/main/app85.cshtml HTTP/2.0
...
accept-encoding: br,deflate,gzip
user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) ... Chrome/139.0.0.0 ...
```

It is `HTTP/2.0`, and there is **no `Connection` header** (HTTP/2 has none). The real browser/app behaviour is a
single reused, multiplexed HTTP/2 connection. There was never a `Connection: close` to record, so
`useKeepAlive="false"` on the NeoLoad actions cannot be reflecting captured behaviour: it is a NeoLoad default or
label, not real traffic.

**2. NeoLoad's default is a reused connection pool.** From NeoLoad's official statistics-measurement reference:

> "each Virtual User has by default a pool of 6 connections per remote server."

> "When two requests are sent over the same connection, the connection establishment time is only included in the
> first request response time. As a result, when connection is kept alive through several requests, it is common
> to have a higher response time on the first request, as it includes connection initialization operated once."

This describes reuse as the unconditional default, not a mode gated by the per-request keep-alive flag. A NeoLoad
virtual user firing a read step's ~100 requests reuses its pool and pays roughly the pool's worth of handshakes
(about 6), not one per request.

**3. The comparison population explicitly enables HTTP/2 (definitive, project config).** The NeoLoad population
used for run #5, `k6_comparison_50VU` (`team/populations/k6_comparison_50@v@u.xml`), sets the browser profile for
every flow to:

```
<browser-profile acceptEncoding="GZIP,DEFLATE,BROTLI" connections="6" cookies="true" http2="true" name="browser.recorded"/>
```

`http2="true"` means NeoLoad replayed the comparison over HTTP/2: a single multiplexed connection per host, reused
for every request. This is authoritative configuration, not inference. With HTTP/2 enabled the per-action
`useKeepAlive="false"` has no bearing on transport (HTTP/2 has no keep-alive header and multiplexes one
connection), which is why the `connections="6"` HTTP/1 pool is moot here too. The same `http2="true"`
`browser.recorded` profile is used across every population in the project. To confirm in the NeoLoad UI: open the
population, edit any virtual-user split's Browser profile, Advanced parameters, and the HTTP/2 box is ticked (with
HTTP/1 Parallel connections = 6).

**Therefore** neither the browser nor NeoLoad opens a fresh connection per request: both ran HTTP/2 with a single
reused connection. k6 with `noConnectionReuse: true` opened ~100 fresh TCP+TLS connections per read step, where
the browser and NeoLoad each used one multiplexed HTTP/2 connection. That self-inflicted handshake cost is the
read overshoot.

## Evidence table: each config versus NeoLoad

| Config                                  | Connection behaviour                                                          | Read steps vs NeoLoad | Faithful?         |
| --------------------------------------- | ----------------------------------------------------------------------------- | --------------------: | ----------------- |
| Browser (real traffic)                  | HTTP/2, one reused multiplexed connection                                     |                     — | reference reality |
| NeoLoad                                 | HTTP/2 (browser profile `http2="true"`), single reused multiplexed connection |              baseline | —                 |
| **k6 keep-alive on (HTTP/2)**           | one reused connection, auto-negotiated                                        |         **0.5–0.95×** | **yes**           |
| k6 keep-alive off (`noConnectionReuse`) | fresh connection per request                                                  |              1.5–1.9× | no (artificial)   |

k6 keep-alive on matched NeoLoad from the start because it is the faithful config: both reuse connections. There
is no trade-off between "recording-faithful" and "browser-representative", they are the same config.

## Supporting measurements

- **CI run (self-hosted agent), forced HTTP/1.1 + keep-alive off, 50 VUs, full fidelity:** clean (0% failed,
  154k requests), `http_req_duration` median ~7.5 ms (low-latency path). Read steps stayed at NeoLoad-run-16 levels,
  showing no HTTP/1.1 benefit; protocol is not the driver.
- **Per-iteration timeline reconstruction (1-VU local run):** read-step makespan decomposes to 98–99% HTTP work,
  1–2% pure socket-wait. Confirms the time is real connection work, not measurement scope.
- **TLS:** server negotiates `tls1.3` (`TLS_AES_128_GCM_SHA256`); k6 per-request handshake ~6 ms (about 1 RTT),
  ~1% resumed, so no room for resumption to help.
- **Local vs CI vantage:** local-over-VPN requests were ~311 ms each versus the CI agent's ~7.5 ms; per-step
  absolute numbers are not comparable across vantages, only same-vantage ratios are.

## Confidence and caveats

- The recording being HTTP/2 with no `Connection` header is **confirmed** (read directly from the captured
  request).
- NeoLoad replaying the comparison over HTTP/2 is **confirmed by project configuration**: the `k6_comparison_50VU`
  population's browser profile carries `http2="true"` for every flow. This is no longer an inference from the
  default pool model, it is the authoritative setting for the run. (The per-action `useKeepAlive="false"` is a
  recording label with no transport effect under HTTP/2; NeoLoad's docs never define its socket-level behaviour,
  and it does not matter here.)
- Part of the apparent absolute gap between the k6 runs and NeoLoad run #5 is also cross-day, cross-environment
  variance (different run dates), so the precise ratio is noisy. The qualitative conclusion does not depend on it.

## Page-level concurrency and the `batchPerHost=6` assumption

The companion assumption, "requests within a page fire in parallel, capped at 6," came from the population's
`connections="6"`, which is NeoLoad's HTTP/1 parallel-connections pool. Under `http2="true"` that pool does not
govern the run. Measured directly:

- The server advertises HTTP/2 `SETTINGS_MAX_CONCURRENT_STREAMS = 128`. NeoLoad and the real browser could fire a
  page's requests as up to 128 concurrent streams on the one connection, effectively all at once, not capped at 6.
- k6's `batchPerHost` still gates concurrency under HTTP/2: an `http.batch` of 12 requests at `batchPerHost=6` ran
  6-then-6 (bimodal, high tail); at `batchPerHost=20` all 12 ran concurrently (uniform, low tail); both over a
  single reused HTTP/2 connection with no per-request handshakes. So `batchPerHost` caps in-flight batch requests,
  not just connections.
- k6 defaults are `batchPerHost=6`, `batch=20`, and `batchPerHost` only affects `http.batch()` calls (the fidelity
  replay), not the sequential spine. The explicit `batchPerHost=6` in the specs equals the default.

So `batchPerHost=6` under-parallelizes a page versus NeoLoad's HTTP/2 (up to 128 streams). Its stated rationale
("mirror NeoLoad's 6-connection pool") is based on the HTTP/1 fallback, not the run. A faithful match would raise
it well above 6 (toward page size). This did not stop k6 keep-alive-on from already reading at or below NeoLoad,
so it is a correctness-of-rationale fix, not an urgent performance one.

## Implications: what to correct

The "keep-alive off mirrors NeoLoad's `useKeepAlive=false`" framing appears in several places and is based on the
misread. Each should be corrected to "HTTP/2 + keep-alive on is the faithful and recommended config":

- The `noConnReuse` / `NO_CONN_REUSE` knob and its comment in the CI pipeline and `neoload.spec.ts`. Retire it, or
  relabel it explicitly as an artificial worst-case, not a NeoLoad match.
- The `forceHttp1` knob added during this investigation (HTTP/1.1 is also not faithful, since the recording is
  HTTP/2). Revert it.
- The published k6-vs-NeoLoad comparison artifact, section "Why they differ": the "NeoLoad brackets between the two
  connection-reuse configs" narrative is misleading. NeoLoad is approximately k6 keep-alive on, not a midpoint.
- `rules/fidelity.md`, `docs/neoload-timing-parity.md`, and the project `CLAUDE.md`, wherever they equate
  `useKeepAlive="false"` with a fresh connection per request.
- The `batchPerHost=6` value and its "mirror NeoLoad's 6-connection pool" rationale (specs, CI pipeline,
  `rules/fidelity.md`). The 6-connection pool is NeoLoad's HTTP/1 fallback; the run was HTTP/2 at up to 128
  streams. Reconsider the value, since 6 under-parallelizes a page.

## Recommendation

- Run and baseline on **HTTP/2 + keep-alive on** (k6's default). It is browser-representative, NeoLoad-faithful,
  and the tightest match to NeoLoad's per-step timings.
- **Rebaseline latency against k6 in that config.** NeoLoad has no per-step numbers to port, only the shared
  `UserPath_Transactions` / `Report` averages (4 s / 20 s). Those are ported as the `avg<` floor on every spine
  request, and any `p(95)` is measured in k6 (`rules/tests.md`, Thresholds). Everything structural (request volume, bytes, page structure, per-page concurrency, protocol) already matches; per-step
  timing should be owned by k6.
- Keep the keep-alive-off / HTTP/1.1 knobs only as clearly-labelled diagnostic worst-cases, if at all.

## References

### This project (sibling `performance` repo and this repo)

- NeoLoad browser profile with `http2="true"` and `connections="6"` (the run-#5 population, plus every population
  project-wide): `team/populations/k6_comparison_50@v@u.xml`.
- Recorded request showing `GET ... HTTP/2.0` with no `Connection` header: the booking VU Launch page recording
  artifact, `team/vus/@t02_@booking@event .../%resources%/recorded-artifacts/<uid>.zip`.
- Prior investigation notes and per-step parity data: `docs/neoload-timing-parity.md`, and the CI `k6-results`
  artifacts referenced there.

### NeoLoad official docs (Tricentis)

- Statistics measurement (the "pool of 6 connections per remote server", connection reuse across requests, and
  what response time includes): https://docs.tricentis.com/neoload-2025.3/en-us/content/reference_guide/statistics_measurement.htm
- Browser profile advanced parameters (the **HTTP/2** checkbox and **HTTP/1 Parallel connections** field):
  https://docs.tricentis.com/neoload-2024.3/en-us/content/reference_guide/advanced_parameters.htm
- Configure a population (browser profile: Recorded vs Customized, HTTP/2, parallel connections — the UI path to
  verify these settings): https://docs.tricentis.com/neoload-latest/en-us/content/reference_guide/configure_a_population.htm

### k6 official docs (Grafana)

- Options reference (`noConnectionReuse`, `batchPerHost`, `batch`):
  https://grafana.com/docs/k6/latest/using-k6/k6-options/reference/
- HTTP/2 (k6 auto-upgrades via ALPN when the server supports it):
  https://grafana.com/docs/k6/latest/using-k6/protocols/http-2/
- Built-in metrics reference (`http_req_blocked` / `_connecting` / `_tls_handshaking` and how `http_req_duration`
  excludes them): https://grafana.com/docs/k6/latest/using-k6/metrics/reference/
- Running large tests (load-generator CPU sizing, the 80/20 headroom guidance):
  https://grafana.com/docs/k6/latest/testing-guides/running-large-tests/
- Forcing HTTP/1.1 in k6 via `GODEBUG=http2client=0` (the feature request and its resolution):
  https://github.com/grafana/k6/pull/2222

### Background: HTTP/2 versus HTTP/1.1

- Cloudflare, "HTTP/2 vs. HTTP/1.1": https://www.cloudflare.com/learning/performance/http2-vs-http1.1/
