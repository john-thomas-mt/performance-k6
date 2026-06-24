---
paths: ["source/tests/**"]
---

# Test Script Conventions (`source/tests/`)

## File naming
- `<feature-area>-<flow>.spec.ts`, kebab-case (e.g. `momentus-assistant-file-upload.spec.ts`)

## Structure
- A test file is a thin journey composition — all HTTP lives in `source/`; if a test needs a new request, add a wrapper in `source/apis/` first
- Name the default export after the journey (e.g. `export default function fileUploadTest(data)`)

## Data & init context
- Request-body builders and the user pool are imported as TS modules (see `rules/data.md`); `open()` is only for `source/data/uploads/**` fixtures and is valid only in the init context, never inside the VU function
- User pool: `source/data/users.data.ts` imported and wrapped in `SharedArray`, picked with `pickUser(users)` from `source/utils/helpers/users.helper.ts` — honors `USER_MODE=single` (every VU uses `users[0]`, one shared login) and `USER_MODE=pool` (default; round-robin `users[__VU % users.length]`)
- Per-iteration uniqueness comes from a `runToken` (`crypto.randomUUID().split('-')[0]`) passed into the request-body builder

## Options
- Spread `loadProfile()` from `source/config/profiles.config.ts` — never hardcode `vus`/`stages`; the profile is selected with `k6 run -e PROFILE=<smoke|load|stress>` and defaults to `smoke`
- Spread `commonThresholds`, then add one named threshold per endpoint tag: `'http_req_duration{name:SignIn}': ['p(95)<2000']`

## Lifecycle
- `setup()` validates data files and fetches the server version once via `fetchServerVersion()`; return `{ version }` and read it in the VU function
- Authentication uses `loginToMomentusAssistant(user, version)` from `source/flows/login.flow.ts` — it owns groups 1–2 and returns `{ bearerToken, salesAiJwt }`

## Data provisioning & cleanup
Cleanup is owned by the environment, not the test: a run targets a fixed baseline restored from a **DB snapshot** and the snapshot is restored again afterwards, so journeys carry **no `teardown()` cleanup** and never delete what they create — the reset wipes it. (Momentus has no reliable hard-delete anyway: removing an event is blocked by its auto-created service/statistic orders and only soft-cancels.)
- **Prerequisite data is seeded out of band.** Reference/parent records the operation needs to already exist (events, accounts, a pool of service orders) are bulk-created by a separate seed script under `source/seeds/` (see `rules/seeds.md`), run once after the snapshot reset and before the test. Seed scripts reuse the same `source/apis/` wrappers the tests use — one definition per endpoint.
- **Journeys stay pure.** A spec measures only the operation under test against pre-existing seeded data; no provisioning or cleanup requests pollute the metrics. `setup()` discovers the seeded pool (e.g. `searchEvents` for the seed marker) and returns it alongside `version` as JSON for the VU function to pick from.
- **Give each VU/iteration its own row.** Pre-seed a pool sized to at least peak concurrent VUs × iterations and pick a distinct record per VU/iteration (`pool[(__VU - 1 + __ITER) % pool.length]`) so concurrent iterations never contend on one row. If the operation under test *is* a create, the test inserts inline and the snapshot reset cleans up — still no `teardown()`.
- **Create/insert transactions still need runtime-unique keys.** Seeded data covers reads/updates, but any inserted row needs a unique key generated per request (`runToken`, e.g. `ER100_SO_SEARCH`) — see `rules/scripting.md`.

## Groups & guards
- Wrap each journey step in a numbered `group('N. Step Name', ...)`; test-specific groups start at 3 (login flow owns 1–2)
- After every step that produces a value, guard with an early return (`if (!salesAiJwt) return;`) so a failed step doesn't cascade misleading errors
- End the iteration with think time: `sleep(1)` minimum
