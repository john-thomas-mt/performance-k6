---
paths: ["source/tests/**"]
---

# Test Spec Conventions (`source/tests/`)

The entry-point layer k6 runs directly. A test spec drives one or more journeys in a single run via k6 `scenarios` in its `options`. Each k6 scenario's `exec` names a thin wrapper exported from the spec that picks a user (`pick_user(users)`) and calls a `<journey>Journey(...)` function from `source/flows/` (see `rules/flows.md`) — journey logic is never duplicated here. Like `source/seeds/`, this is an entry-point folder nothing imports, so it has no barrel.

## File naming
- `<name>.spec.ts`, kebab-case (e.g. `smoke.spec.ts`) — the `.spec.ts` suffix marks a test spec

## Smoke aggregate — register every journey
- `source/tests/smoke.spec.ts` runs every journey once as the correctness/drift gate: one `per-vu-iterations` k6 scenario per journey, each `exec` a thin wrapper calling that journey. Its `setup()` returns `SmokeSetup`, the superset of what every journey needs (`{ version, users, soPool }`); each journey function declares only the slice it reads — version-only journeys take `SetupData`, a journey needing a seeded pool takes its own `<Feature>Setup` slice — while the `exec` wrapper passes the whole superset (see `rules/types.md`)
- **Adding a journey means registering it**: add the flow's `export *` line to `source/utils/exports/flows.exp.ts`, then in `smoke.spec.ts` add a k6 scenario entry, its `exec` wrapper, and its `<journey>Thresholds` to the threshold map. A journey not registered there is invisible to the smoke gate and the `payload-drift` skill. If the journey **consumes a discovered seed pool**, also add its scenario to that pool's discovery gate in `setup()` so a single-journey run of it still discovers the pool; a journey that needs no pool needs no gate entry (see the seed-pool discovery gating under Data provisioning below)
- Run one journey at scripting time with `-e SCENARIO=<name>` (the spec filters its `scenarios` down to that entry and rejects an unknown name); scale that dev run with `-e VUS=` / `-e ITERS=`. With no `-e SCENARIO`, every journey runs — the full drift gate
- Smoke asserts `commonThresholds` + a `checks` rate + the per-endpoint `<journey>Thresholds` of the journey(s) it runs (see Thresholds below). Under `-e SCENARIO=<name>` only that journey's thresholds apply; the full run applies them all

## Thresholds
- Per-endpoint `http_req_duration` SLAs live with the journey, exported from its flow as `<journey>Thresholds` (see `rules/flows.md`)
- **Where the numbers come from.** NeoLoad has no per-transaction targets. The project has two shared profiles in `sla_profiles/`, and each step container opts into one with `slaProfileName` + `slaProfileEnabled`:
  - `UserPath_Transactions`, for the UI journeys: average request response time > 4.0 s per run.
  - `Report`, for the public-API report journeys: average > 20.0 s per run.

  Both alert at LOW severity, and every other rule in them is disabled.
- **Every request the lean spine sends from an opted-in step gets the profile's average**: `avg<4000` for a UI journey, `avg<20000` for a report journey. That includes the shared helpers (`SignOut` in `loginThresholds`, since the sign-out step opts in) and fallback branches.
- Steps that opt out need no SLA. These are the launch/login steps of most VUs and every `@u*` data-script VU. `SignIn` keeps the repo's own `p(95)<2000` gate, which is not a NeoLoad SLA.
- Tier-support tags (`UIChrome`, `StaticAsset`, `Transport`, requests fired only behind `include_ui`/`include_static`) need no SLA either; see `rules/fidelity.md`.
- **A `p(95)` sits beside the average, never in place of it, and only when it was measured.** The commit that adds one records the run it came from (VUs, iterations, env and the measured value), the way `202dc9d` baselined `OpenCopyForm` and `SaveEventCopy`. Never write a guessed percentile: a guess either fails clean runs or hides real regressions, and nobody can tell which.
- NeoLoad's `TOTAL_ERRORS > 5` rule is not ported per request. Errors are gated run-wide by `commonThresholds` (`http_req_failed`) and the `checks` rate, which scale with the load, unlike NeoLoad's absolute count.
- `smoke.spec.ts` merges `commonThresholds` + `loginThresholds` + the `<journey>Thresholds` of the journey(s) it runs — all of them for the full gate, just the selected one under `-e SCENARIO`. Gating to the active journeys keeps every asserted threshold pointed at an endpoint the run actually exercises

## Execution shape
- `smoke.spec.ts` fixes its own small `per-vu-iterations` shape, overridable via `-e VUS=`/`-e ITERS=` for the dev ladder
- **Size `maxDuration` to the run.** k6's `per-vu-iterations` executor defaults `maxDuration` to **10m**; when it elapses the unrun remainder of each VU's iterations is silently converted to `dropped_iterations` and the run ends early, with no failed check or crossed threshold to signal it. `once(exec)` in `smoke.spec.ts` leaves the default, which fits most journeys on the dev ladder. Other runs sized past 10m (a raised `-e ITERS=`, a long-window observation run) need `maxDuration` set explicitly to cover them, the way the `source/seeds/` scripts do. Check `dropped_iterations` in the summary to confirm a run actually completed the iterations it was asked for
- **Some user paths need their own run conditions.** A journey whose single call can legitimately run for many minutes passes its own ceiling as `once(exec, maxDuration)`: today the long-running public-API reports (`event_revenue_metric_report`, `space_utilization_report`, both `'4h'`). The value is a ceiling for the ladder, not an expected duration; k6 has no "no limit" setting, so pick a large value. The slow request also needs its own `timeout` in its wrapper (see `rules/scripting.md`, Timeouts). Leave every other scenario on the default
- For real load, `source/tests/neoload.spec.ts` shapes executors from `load_profile()` (`source/config/profiles.config.ts`, selected with `-e PROFILE=`, default `neoload`) rather than hardcoding `vus`/`stages`: one `ramping-vus` scenario per flow sharing the profile's stages, with each iteration paced to a fixed cycle time via `pace()` (`source/utils/helpers/pacing.helper.ts`, `-e PACING=`, default 300s). `smoke.spec.ts` keeps its own small `per-vu-iterations` shape for the dev ladder

## Data & init context
- Request-body builders and the user pool are imported as TS modules (see `rules/data.md`); `open()` is only for `source/data/uploads/**` fixtures and is valid only in the init context, never inside the VU function
- User pool: `source/data/creds/users.data.ts` ships the accounts password-encrypted; `setup()` decrypts them once via `decrypt_users(userCredentials, config.cryptoKey)` and returns the `User[]` in its data. VU wrappers pick with `pick_user(data.users)` from `source/utils/helpers/users.helper.ts` — honoring `USER_MODE=single` (every VU uses `users[0]`, one shared login) and `USER_MODE=pool` (default; round-robin). See `rules/data.md`
- Per-iteration uniqueness comes from a `runToken` passed into the request-body builder

## Lifecycle
- `setup()` is `async`: it decrypts the user pool (passphrase from `config.cryptoKey`, sourced from `temp/secret.json`; throws if missing) and fetches the server version once via `fetch_server_version()`, returning both (plus any discovered seed pool) for the VU functions to read
- Authentication is owned by the relevant `source/flows/login.flow.ts` entry, which owns groups 1–2 (see `rules/flows.md`)
- Numbered groups, guards, and the closing `sleep` live in the flow, not here (see `rules/flows.md`)

## Data provisioning & cleanup
Cleanup is owned by the environment, not the spec: a run targets a fixed baseline restored from a **DB snapshot** and the snapshot is restored again afterwards, so journeys carry **no `teardown()` cleanup** and never delete what they create. (Momentus has no reliable hard-delete anyway: removing an event is blocked by its auto-created service/statistic orders and only soft-cancels.)
- **Prerequisite data is seeded out of band.** Reference/parent records the operation needs to already exist are bulk-created by a separate seed script under `source/seeds/` (see `rules/seeds.md`), run once after the snapshot reset. Seed scripts reuse the same `source/apis/` wrappers — one definition per endpoint
- **Journeys stay pure.** A run measures only the operation under test against pre-existing seeded data; no provisioning or cleanup requests pollute the metrics. `setup()` discovers the seeded pool (e.g. `search_events` for the seed marker) and returns it for the VU function to pick from — but **only for the scenarios that consume it**: `setup()` gates each seed-pool discovery to the journeys that read that pool (and the full suite, `-e SCENARIO` unset). A single-journey run of a journey that doesn't use the pool neither pays for its discovery nor aborts when that seed data is absent on the target env — which is what lets `verify-envs` run such a journey on an env that was never seeded for an unrelated pool
- **Give each VU/iteration its own row.** Pre-seed a pool sized to at least peak concurrent VUs × iterations and pick a distinct record per VU/iteration (`pool[(__VU - 1 + __ITER) % pool.length]`) so concurrent iterations never contend on one row. If the operation under test *is* a create, it inserts inline and the snapshot reset cleans up — still no `teardown()`
- **Pick a representative record, not an outlier.** The service-order seed events (`config.seedEventPrefix`, found via `discover_service_order_pool`) gain copied service orders on every `copy_service_orders` run, so their *own* event-detail (`GenericDetailServer/GetInitialData2`) responses grow large and slow over time. Don't reuse it as a generic "an event" for a read/view journey — the heavy payload skews the journey's timings and swamps concurrency. Anchor such a journey to a lightweight baseline event, or seed a dedicated event pool, and keep the SO seed for the service-order journeys it exists for
- **Create/insert transactions still need runtime-unique keys.** Seeded data covers reads/updates, but any inserted row needs a unique key generated per request (`runToken`, e.g. `ER100_SO_SEARCH`) — see `rules/scripting.md`
