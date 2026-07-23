# k6 ↔ NeoLoad per-step timing parity

**Status: working investigation notes.** These are the verified findings and measured runs behind the
question "which k6 firing configuration reproduces NeoLoad's per-step timings, and can a single knob do
it?" They are **not** folded into the published comparison report (the k6-vs-NeoLoad artifact) — that
report stands as-is. The next step recorded here (per-page batching) is not yet built.

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

**The 6-connection pool.** NeoLoad's default browser profile allows up to 6 parallel connections per host
per VU (official docs). That is a _ceiling_, not a request count — it only binds when a page holds more
than 6 requests, and here pages hold ≤3. So the pool is almost never saturated; effective per-page
concurrency is 2–3, and the step's dominant cost is the sequential page count plus a fresh handshake on
every request.

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

| Run      | batchPerHost | keep-alive              | requests | iters | data recv | `http_req_duration` avg / p95 / max | checks  |
| -------- | ------------ | ----------------------- | -------- | ----- | --------- | ----------------------------------- | ------- |
| parallel | 6            | on                      | 154,147  | 303   | 3.0 GB    | 20.02 ms / 61.76 ms / 32.39 s       | 99.94%  |
| serial   | 1            | on                      | 152,977  | 300   | 3.0 GB    | 13.95 ms / 40.58 ms / 11.10 s       | 100.00% |
| run 14   | 1            | **off** (`noConnReuse`) | 153,796  | 302   | 3.7 GB    | 18.32 ms / 47.81 ms / 36.40 s       | 99.96%  |
| run 15   | 3            | **off** (`noConnReuse`) | 153,386  | 301   | 3.7 GB    | 17.11 ms / 48.18 ms / 2.24 s        | 99.98%  |

### Per-step medians (ms), target = NeoLoad

| Step                          | NeoLoad | parallel (6, ka) | serial (1, ka) | run 14 (1, no-reuse) | run 15 (3, no-reuse) |
| ----------------------------- | ------- | ---------------- | -------------- | -------------------- | -------------------- |
| Booking Launch                | 542     | 360              | 849            | 2702                 | 979                  |
| Booking Login                 | 887     | 502              | 1052           | 1836                 | 877                  |
| Booking ClickCalendarTab      | 842     | 508              | 1154           | 2357                 | 1028                 |
| Booking ClickBookButton       | 1811    | 581              | 1607           | 2827                 | 1149                 |
| Booking EnterdetailsClickSave | 1604    | 1512             | 1464           | 1584                 | 1285                 |
| CopyEvent ClickSave           | 4287    | 1957             | 3074           | 4741                 | 2617                 |

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

## Next step — per-page batching (not yet built)

To eliminate the scatter and match NeoLoad by construction rather than coincidence:

1. **Generator** (`scripts/gen-fidelity-lists.js`): preserve each request's `<http-page>` grouping — emit a
   page id/index per request so the replay knows which requests share a page.
2. **Replay** (`source/utils/helpers/chrome.helper.ts`): fire **one `http.batch()` per page** (its 2–3
   requests, parallel) with the pages fired **sequentially**, instead of one big batch per tier.
3. Keep `noConnReuse=true`; `batchPerHost` ≥ max per-page request count (won't bind).
4. Regenerate all five flows (`source/data/{chrome,static,transport}/*.ts`), re-verify (smoke + a `neoload`
   run), and update `rules/fidelity.md` (tier-firing description).

**Known residual even after per-page batching:** the server speaks HTTP/2 (multiplexing) while NeoLoad
models an HTTP/1-style per-request-connection pool, and k6 fires chrome/static/transport as separate tiers
whereas NeoLoad interleaves them in recorded page order. So exact parity is not fully attainable; per-page
batching closes the structural gap, not the protocol-model one.

## Current CI state

`main` HEAD `e01f5a7` — `.azure/workflows/k6-tests-ci.yml` runs the comparison at `batchPerHost: '3'`,
`noConnReuse: 'true'`. Relevant commits (all `BO-15486`): `d6118f8` (spec flag), `f17641a` (CI wiring +
model comment fix), `b8c3f7b` (enable `noConnReuse`), `e01f5a7` (set `batchPerHost` 3). Note: `786219b`
briefly set `batchPerHost` 6 and was reverted by `b8c3f7b` — a noisy pair left in history (final state is
correct).

## Provenance

- NeoLoad: run `#5` CSV export and run PDF.
- k6: CI `k6-results` artifacts for the parallel, serial, run-14, and run-15 runs (local copies under
  `Downloads/k6-results (…)` at time of writing).
- Published comparison report (unchanged): the k6-vs-NeoLoad execution-results artifact.
