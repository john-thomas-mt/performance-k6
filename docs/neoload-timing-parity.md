# k6 ↔ NeoLoad per-step timing parity

**Status: working investigation notes.** These are the verified findings and measured runs behind the
question "which k6 firing configuration reproduces NeoLoad's per-step timings, and can a single knob do
it?" They are **not** folded into the published comparison report (the k6-vs-NeoLoad artifact) — that
report stands as-is. Per-page batching — the fix these notes led to — is now built and measured (run 16 below).

## The question

At `FIDELITY=full`, each k6 transaction group replays a correlated spine plus UI-chrome / static /
transport tiers. The per-step number k6 reports is `group_duration`; the NeoLoad side reports transaction
time. Early runs disagreed per-step, and the disagreement was blamed at different times on "k6 runs
sequentially" and "NeoLoad runs sequentially." Neither was right. This doc pins the actual NeoLoad
execution model from its project files and measures how close each k6 configuration gets.

## NeoLoad execution model (verified from the project tree)

Source: `team/vus/@t02_@booking@event #2826#2E2#29/` in the sibling `performance` repo (the 26.2 recording
of the Booking flow). Attribute tallies across that VU:

| Element                  | XML                              | Key attribute                                        | Meaning                                                       |
| ------------------------ | -------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------- |
| Step (named transaction) | `basic-logical-action-container` | `execution-type="0"` (11/11)                         | plays its pages **sequentially**, in recorded order           |
| Page                     | `http-page`                      | `playRequestsSequentially="false"` (174/174, 0 true) | fires its embedded requests **in parallel**                   |
| Page                     | `http-page`                      | `executeResourcesDynamically="false"` (174/174)      | resources are explicit recorded requests, not auto-discovered |
| Request                  | `http-action`                    | `useKeepAlive="false"` (476/476)                     | fresh TCP+TLS connection per request (non-persistent)         |

So the real model is **sequential pages, each a small parallel burst of requests over non-persistent
connections** — not purely sequential and not broadly parallel.

Hierarchy and sizing (this VU): 11 steps, 174 pages, 476 requests → ~16 pages per step, ~2.7 requests per
page. The whole-run NeoLoad CSV confirms the shape by arithmetic:

- All Pages: **55,181** page executions, avg page time **0.049 s** (49 ms)
- All Transactions: **3,287** → 55,181 ÷ 3,287 ≈ **16.8 pages per transaction**
- Avg transaction time **0.815 s** ≈ 16.8 × 49 ms — i.e. a step is essentially the sum of its ~16
  sequential pages.

**The 6-connection pool — project-confirmed.** The NeoLoad project configures `connections="6"` per VU
(verified in `team/populations` + `team/scenarios`, 233×), matching NeoLoad's default 6-connection browser
pool. That is a _ceiling_, not a request count. Split by tier the pages are small: every `/api/` chrome
request and every transport request is its **own single-request page** (fired sequentially), while the static
pages bundle several embedded assets (≈4–6, some launch pages more) that drain 6-at-a-time. So the pool only
binds on the multi-request static pages; the step's dominant cost is the sequential page count plus a fresh
handshake on every request. (Earlier notes here said "pages hold ≤3 / concurrency 2–3" — that was the raw
tier-mixed average; the corrected per-tier picture is 1-request api/transport pages and multi-request static
pages.)

## k6 firing model

- `FIDELITY=full` fires, per step: the correlated spine call + the UI-chrome, static-asset, and transport
  tiers (`rules/fidelity.md`).
- `source/utils/helpers/chrome.helper.ts` `fire_batch` currently collects **all** of a step's requests for
  a tier into **one** `http.batch(...)` call — one big batch per tier (`UIChrome` / `StaticAsset` /
  `Transport`).
- `batchPerHost` (k6 default 6) caps simultaneous per-host connections inside a batch; `batch` (default 20)
  caps the total. `noConnReuse` disables keep-alive so every request opens a fresh connection — the direct
  analog of NeoLoad's `useKeepAlive="false"`.
- Both knobs are env-gated on `source/tests/neoload.spec.ts`: `batchPerHost: Number(__ENV.BATCH_PER_HOST) || 6`
  and `noConnReuse: __ENV.NO_CONN_REUSE === 'true'`.

## Reference target — NeoLoad run #5

Test `k6_comparison`, scenario `SCN_k6`, project `RegressionSanity`, 17 Jul 2026, 34m 40s, 50 VUs, build
26.2. From the `#5` CSV export + run PDF:

- 158,990 passed requests (159,009 incl. 19 failed) · 3,287 transactions (3,268 passed) · 295 VU iterations
  passed (14 failed, 309 total) · 76.414 req/s · 2.9 GiB
- All Transactions avg 0.815 s, p95 2.679 s (page-level roll-up — not directly comparable to k6's
  per-HTTP-request `http_req_duration`; compare at the named-step level only)

## k6 runs measured

All `FIDELITY=full`, `neoload` profile, 50 VUs, build 26.2.969x. Aggregate figures from each run's
`k6-console.log`:

| Run        | batchPerHost     | keep-alive              | requests | iters | data recv | `http_req_duration` avg / p95 / max | checks  |
| ---------- | ---------------- | ----------------------- | -------- | ----- | --------- | ----------------------------------- | ------- |
| parallel   | 6                | on                      | 154,147  | 303   | 3.0 GB    | 20.02 ms / 61.76 ms / 32.39 s       | 99.94%  |
| serial     | 1                | on                      | 152,977  | 300   | 3.0 GB    | 13.95 ms / 40.58 ms / 11.10 s       | 100.00% |
| run 14     | 1                | **off** (`noConnReuse`) | 153,796  | 302   | 3.7 GB    | 18.32 ms / 47.81 ms / 36.40 s       | 99.96%  |
| run 15     | 3                | **off** (`noConnReuse`) | 153,386  | 301   | 3.7 GB    | 17.11 ms / 48.18 ms / 2.24 s        | 99.98%  |
| **run 16** | **6 (per-page)** | **off** (`noConnReuse`) | 154,210  | 303   | 3.7 GB    | 17.26 ms / 47.28 ms / 2.28 s        | 99.95%  |

### Per-step medians (ms), target = NeoLoad

| Step                          | NeoLoad | parallel (6, ka) | serial (1, ka) | run 14 (1, no-reuse) | run 15 (3, no-reuse) | run 16 (per-page, 6, no-reuse) |
| ----------------------------- | ------- | ---------------- | -------------- | -------------------- | -------------------- | ------------------------------ |
| Booking Launch                | 542     | 360              | 849            | 2702                 | 979                  | 1028                           |
| Booking Login                 | 887     | 502              | 1052           | 1836                 | 877                  | 1337                           |
| Booking ClickCalendarTab      | 842     | 508              | 1154           | 2357                 | 1028                 | 1170                           |
| Booking ClickBookButton       | 1811    | 581              | 1607           | 2827                 | 1149                 | 2130                           |
| Booking EnterdetailsClickSave | 1604    | 1512             | 1464           | 1584                 | 1285                 | 1453                           |
| CopyEvent ClickSave           | 4287    | 1957             | 3074           | 4741                 | 2617                 | 3702                           |

(Full per-step data for every run is in each run's `group-metrics.csv`. `T34 SelectFunctionAndSave` is
omitted from cross-run timing comparison — it is confounded by the random 1–10 service-order copy count.)

## Findings

1. **The write-step transport gap is keep-alive — confirmed.** With `noConnReuse` on (run 14), the
   single-request save steps jumped onto NeoLoad: EnterdetailsClickSave 1464 → 1584 (NeoLoad 1604),
   CopyEvent ClickSave 3074 → 4741 (NeoLoad 4287). NeoLoad's `useKeepAlive="false"` handshake-per-request
   is why it reads slower per request; reproducing it in k6 closes that gap.

2. **A single global concurrency knob cannot uniformly match NeoLoad's per-page structure.**
   - `batchPerHost 1` + no-reuse (run 14): uniformly **over** on multi-request steps (Launch 5×, Login/tab
     ~2×) — it serializes the ~40 requests NeoLoad fetches 2–3-parallel-per-page, each now paying a
     handshake.
   - `batchPerHost 3` + no-reuse (run 15): pulls everything into a tight cluster (most steps 0.6–1.2× of
     NeoLoad, Logins essentially dead-on), but **scatters** — request-heavy steps still over (Launch 1.8×),
     save-heavy steps now under (ClickSave 0.61×, ClickBookButton 0.63×). `batchPerHost 6` would push the
     saves further under.
   - The over-on-Launch / under-on-Saves split is the fingerprint that the mismatch is _structural_
     (per-page grouping), not a single concurrency level.

3. **Best global-knob result: `batchPerHost 3` + `noConnReuse=true`** — within cross-tool comparison noise
   on most steps. Adequate for the adoption decision (volume, bytes, correctness, and write-step transport
   already match; per-step timings are not portable across tools and should be rebaselined against k6, not
   ported from NeoLoad). Not per-step exact.

## Per-page batching — implemented (branch `ref-BO-15976-per-page-fidelity-batching`)

Built to match NeoLoad by construction rather than coincidence:

1. **Generator** (`scripts/gen-fidelity-lists.js`): groups each tier's requests by `<http-page>` (one page
   per recorded file), emitting `{ [step]: Request[][] }` — an array of pages per step. Verified purely
   structural: flattening the new output is byte-identical to the previous flat output for all five flows ×
   three tiers.
2. **Replay** (`source/utils/helpers/chrome.helper.ts`): fires **one `http.batch()` per page** (parallel
   within a page) with pages fired **sequentially**, instead of one big batch per tier.
3. `noConnReuse=true`; **`batchPerHost=6`** — corrected from the earlier "won't bind" note. The project
   configures `connections="6"` per VU, so 6 makes the cap bind _per page_ exactly like NeoLoad's pool:
   single-request api/transport pages stay sequential, multi-request static pages drain 6-at-a-time.
4. Regenerated all five flows; `tsc --noEmit` and `k6 inspect` pass. Flow call sites unchanged (only the
   passed type went `Request[]` → `Request[][]`). `rules/fidelity.md` updated.

**Page shape after tier-split (why the old single-batch scattered):** chrome and transport are 1 request per
page in every flow (e.g. book-event 74 chrome requests in 74 pages), so they now fire strictly sequentially;
static is ≈4–6 requests per page (book-event 370 in 87 pages), firing as pool-capped parallel bursts. The old
"one batch per tier" fired all ~40 of a step's requests as a single pipelined batch — that is the
over-parallelization per-page batching removes.

**Model re-verified this session across all five flows** (independent of prior work): file=page holds for
every action-bearing file; `playRequestsSequentially="false"`, `executeResourcesDynamically="false"`,
`useKeepAlive="false"`, `execution-type="0"` are uniform with zero exceptions; `connections="6"` project-wide.

**Known residual:** the server speaks HTTP/2 (multiplexing) while NeoLoad models an HTTP/1-style
per-request-connection pool, and k6 fires chrome/static/transport as separate tiers whereas NeoLoad
interleaves them in recorded page order. With `noConnReuse=true` the pages are independent, so a step's total
is order-invariant and the separate-tier firing yields the same per-step sum — but the HTTP/2-vs-pool
difference remains. Per-page batching closes the structural gap, not the protocol-model one.

**Measured — run 16 (per-page batching + `batchPerHost=6` + `noConnReuse=true`, `neoload` CI profile):**
clean at load — 0% `http_req_failed` (0 / 154,210), no unresolved-token skips, checks 99.95%, think-time 2.5 s.
Per-page batching pulled the **write-heavy steps onto NeoLoad** (run 15 → run 16 ratio vs NeoLoad):
ClickBookButton 0.63× → **1.18×**, EnterdetailsClickSave 0.80× → **0.91×**, CopyEvent ClickSave 0.61× →
**0.86×**. The cost is that the **static/read-heavy early steps overshoot** — Launch **1.90×**, Login
**1.51×** — because firing dozens of sequential pages each over a fresh TCP+TLS connection costs more in k6
than NeoLoad's handling of the same `useKeepAlive="false"` pages. Net: the profile moved from "scattered (some
way under, some over)" to "**writes aligned, reads uniformly ~1.4–1.9× over**"; the structure now matches
NeoLoad by construction, and the transactional saves are within ~15%.

The step-level **maxes reach ~16 s** on a few steps across flows, but the aggregate single-request
`http_req_duration` max is only **2.28 s** — so those are the sequential-page **sum** on tail iterations, not a
single stalled request (`http_req_failed` stays 0%). The lever for the read/launch overshoot, if exact
per-step read parity is wanted, is relaxing `noConnReuse` on the static tier only — this diverges from the
recording's `useKeepAlive="false"` but would cut the handshake overshoot without touching the aligned writes.
Not yet tried.

## Current CI state

`.azure/workflows/k6-tests-ci.yml` now runs the comparison at `batchPerHost: '6'`, `noConnReuse: 'true'`,
`FIDELITY: 'full'`, with the per-page-batching replay. The single-global-knob settings measured above
(`batchPerHost` 1 and 3) are superseded — kept only as the evidence that no single cap matched NeoLoad. The
earlier global-knob parity commits are under `BO-15486`; the per-page-batching change is `BO-15976` (branch
`ref-BO-15976-per-page-fidelity-batching`).

## Provenance

- NeoLoad: run `#5` CSV export and run PDF.
- k6: CI `k6-results` artifacts for the parallel, serial, run-14, and run-15 runs (local copies under
  `Downloads/k6-results (…)` at time of writing).
- Published comparison report (unchanged): the k6-vs-NeoLoad execution-results artifact.
