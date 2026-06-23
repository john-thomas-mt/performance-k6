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
- User pool: `source/data/users.data.ts` imported and wrapped in `SharedArray`, picked with `pickUser(users)` from `source/helpers/users.helper.ts` — honors `USER_MODE=single` (every VU uses `users[0]`, one shared login) and `USER_MODE=pool` (default; round-robin `users[__VU % users.length]`)
- Per-iteration uniqueness comes from a `runToken` (`crypto.randomUUID().split('-')[0]`) passed into the request-body builder

## Options
- Spread `loadProfile()` from `source/config/profiles.config.ts` — never hardcode `vus`/`stages`; the profile is selected with `k6 run -e PROFILE=<smoke|load|stress>` and defaults to `smoke`
- Spread `commonThresholds`, then add one named threshold per endpoint tag: `'http_req_duration{name:SignIn}': ['p(95)<2000']`

## Lifecycle
- `setup()` validates data files and fetches the server version once via `fetchServerVersion()`; return `{ version }` and read it in the VU function
- Authentication uses `loginToMomentusAssistant(user, version)` from `source/flows/login.flow.ts` — it owns groups 1–2 and returns `{ bearerToken, salesAiJwt }`

## Data provisioning & cleanup
- A journey provisions its own unique data rather than mutating shared QE records. `setup()` creates a run-scoped **parent** from scratch (e.g. a new event, its description stamped with a `runToken`) and returns its id(s) alongside `version` as JSON — `setup()` may issue HTTP and runs once before any VU.
- Each iteration creates the **record it will mutate** (e.g. a service order under that event) fresh, then runs the operation under test on it — so concurrent iterations never contend on one row and no single record accumulates state across the run.
- Provisioning requests carry their own tags (`CreateEvent`, `CreateServiceOrder`) and are left out of the operation-under-test SLO thresholds, so the measured signal stays clean.
- `teardown()` cleans the run off `setup()`'s return value — delete the seeded parent and let the backend cascade to its children. k6 forbids passing data from `default()` to `teardown()`, so cleanup keys off what `setup()` returned, never what an iteration created. Guard `setup()` so a half-built parent doesn't strand data, and note `teardown()` is skipped entirely if `setup()` throws.
- A pure **create** flow needs no separate mutation target — the operation under test is the creation; with no parent to cascade from, `teardown()` falls back to a token-sweep (search by the stamped `runToken`, delete the matches).
- Only when provisioning a fresh record genuinely isn't possible, fall back to selecting a distinct existing record per VU (`candidates[(__VU - 1 + __ITER) % candidates.length]`) and verify against the operation's own response, not list position.

## Groups & guards
- Wrap each journey step in a numbered `group('N. Step Name', ...)`; test-specific groups start at 3 (login flow owns 1–2)
- After every step that produces a value, guard with an early return (`if (!salesAiJwt) return;`) so a failed step doesn't cascade misleading errors
- End the iteration with think time: `sleep(1)` minimum
