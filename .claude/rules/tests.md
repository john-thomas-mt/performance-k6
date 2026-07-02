---
paths: ["source/tests/**"]
---

# Test Spec Conventions (`source/tests/`)

The entry-point layer k6 runs directly. A test spec drives one or more journeys in a single run via k6 `scenarios` in its `options`. Each k6 scenario's `exec` names a thin wrapper exported from the spec that picks a user (`pickUser(users)`) and calls a `<journey>Journey(...)` function from `source/flows/` (see `rules/flows.md`) — journey logic is never duplicated here. Like `source/seeds/`, this is an entry-point folder nothing imports, so it has no barrel.

## File naming
- `<name>.spec.ts`, kebab-case (e.g. `smoke.spec.ts`) — the `.spec.ts` suffix marks a test spec

## Smoke aggregate — register every journey
- `source/tests/smoke.spec.ts` runs every journey once as the correctness/drift gate: one `per-vu-iterations` k6 scenario per journey, each `exec` a thin wrapper calling that journey. Its `setup()` returns `SmokeSetup`, the superset of what every journey needs (`{ version, users, soPool }`); each journey function declares only the slice it reads — version-only journeys take `SetupData`, a journey needing a seeded pool takes its own `<Feature>Setup` slice — while the `exec` wrapper passes the whole superset (see `rules/types.md`)
- **Adding a journey means registering it**: add the flow's `export *` line to `source/utils/exports/flows.exp.ts`, then in `smoke.spec.ts` add a k6 scenario entry, its `exec` wrapper, and its `<journey>Thresholds` to the threshold map. A journey not registered there is invisible to the smoke gate and the `validate-payload-drift` skill
- Run one journey at scripting time with `-e SCENARIO=<name>` (the spec filters its `scenarios` down to that entry and rejects an unknown name); scale that dev run with `-e VUS=` / `-e ITERS=`. With no `-e SCENARIO`, every journey runs — the full drift gate
- Smoke asserts `commonThresholds` + a `checks` rate + the per-endpoint `<journey>Thresholds` of the journey(s) it runs (see Thresholds below). Under `-e SCENARIO=<name>` only that journey's thresholds apply; the full run applies them all

## Thresholds
- Per-endpoint `http_req_duration` SLAs live with the journey, exported from its flow as `<journey>Thresholds` (see `rules/flows.md`)
- `smoke.spec.ts` merges `commonThresholds` + `loginThresholds` + the `<journey>Thresholds` of the journey(s) it runs — all of them for the full gate, just the selected one under `-e SCENARIO`. Gating to the active journeys keeps every asserted threshold pointed at an endpoint the run actually exercises

## Execution shape
- `smoke.spec.ts` fixes its own small `per-vu-iterations` shape, overridable via `-e VUS=`/`-e ITERS=` for the dev ladder
- For real load, a dedicated load spec will shape executors from `loadProfile()` (`source/config/profiles.config.ts`, selected with `-e PROFILE=`) rather than hardcoding `vus`/`stages`. This is **not yet wired**: `smoke.spec.ts` fixes its own shape and no spec currently reads `-e PROFILE=`, so `loadProfile()` is scaffolding until that load spec is added

## Data & init context
- Request-body builders and the user pool are imported as TS modules (see `rules/data.md`); `open()` is only for `source/data/uploads/**` fixtures and is valid only in the init context, never inside the VU function
- User pool: `source/data/users.data.ts` ships the accounts password-encrypted; `setup()` decrypts them once via `decryptUsers(userCredentials, config.cryptoKey)` and returns the `User[]` in its data. VU wrappers pick with `pickUser(data.users)` from `source/utils/helpers/users.helper.ts` — honoring `USER_MODE=single` (every VU uses `users[0]`, one shared login) and `USER_MODE=pool` (default; round-robin). See `rules/data.md`
- Per-iteration uniqueness comes from a `runToken` passed into the request-body builder

## Lifecycle
- `setup()` is `async`: it decrypts the user pool (passphrase from `config.cryptoKey`, sourced from `temp/secret.json`; throws if missing) and fetches the server version once via `fetchServerVersion()`, returning both (plus any discovered seed pool) for the VU functions to read
- Authentication is owned by the relevant `source/flows/login.flow.ts` entry, which owns groups 1–2 (see `rules/flows.md`)
- Numbered groups, guards, and the closing `sleep` live in the flow, not here (see `rules/flows.md`)

## Data provisioning & cleanup
Cleanup is owned by the environment, not the spec: a run targets a fixed baseline restored from a **DB snapshot** and the snapshot is restored again afterwards, so journeys carry **no `teardown()` cleanup** and never delete what they create. (Momentus has no reliable hard-delete anyway: removing an event is blocked by its auto-created service/statistic orders and only soft-cancels.)
- **Prerequisite data is seeded out of band.** Reference/parent records the operation needs to already exist are bulk-created by a separate seed script under `source/seeds/` (see `rules/seeds.md`), run once after the snapshot reset. Seed scripts reuse the same `source/apis/` wrappers — one definition per endpoint
- **Journeys stay pure.** A run measures only the operation under test against pre-existing seeded data; no provisioning or cleanup requests pollute the metrics. `setup()` discovers the seeded pool (e.g. `searchEvents` for the seed marker) and returns it for the VU function to pick from
- **Give each VU/iteration its own row.** Pre-seed a pool sized to at least peak concurrent VUs × iterations and pick a distinct record per VU/iteration (`pool[(__VU - 1 + __ITER) % pool.length]`) so concurrent iterations never contend on one row. If the operation under test *is* a create, it inserts inline and the snapshot reset cleans up — still no `teardown()`
- **Create/insert transactions still need runtime-unique keys.** Seeded data covers reads/updates, but any inserted row needs a unique key generated per request (`runToken`, e.g. `ER100_SO_SEARCH`) — see `rules/scripting.md`
