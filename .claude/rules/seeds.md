---
paths: ["source/seeds/**"]
---

# Seed Script Conventions (`source/seeds/`)

Seed scripts bulk-create the prerequisite data a journey needs to already exist. They run **once after a DB-snapshot reset and before the test**; the snapshot owns cleanup, so seed scripts never delete.

## Structure
- `source/seeds/<feature>.seed.ts` — a k6 script that composes `source/apis/` wrappers to create records in bulk; it never re-implements an endpoint call (one definition per endpoint, shared with the tests — see `rules/apis.md`).
- Authenticate once via `loginToEvents` / `loginToMomentusAssistant` from `source/flows/login.flow.ts`, exactly as a test does.

## Volume & sizing
- Drive bulk creation with a high-throughput executor (`shared-iterations` or `per-vu-iterations`) and a `SEED_COUNT` env (default sensible, overridable with `-e SEED_COUNT=`).
- Size the pool to at least the consuming test's peak concurrent VUs × iterations, so each VU/iteration gets its own row (see `rules/tests.md`).

## Discovery handoff
- Stamp every seeded record with a recognizable marker (e.g. a `PerfSeed-<feature>` description) so the consuming test's `setup()` discovers the pool by search rather than a file handoff — k6 has no shared writable state across VUs to emit a data file cleanly.
- Insert transactions need a runtime-unique key per record (`runToken`, e.g. `ER100_SO_SEARCH`) — see `rules/scripting.md`.

## Tagging
- Tag seed requests with their own names; a seed run is not the measured test, so it defines no SLO thresholds (those live in `source/tests/`).
