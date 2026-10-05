---
paths: ["source/seeds/**"]
---

# Seed Script Conventions (`source/seeds/`)

Seed scripts bulk-create the prerequisite data a journey needs to already exist. They run **once after a DB-snapshot reset and before the test**; the snapshot owns cleanup, so seed scripts never delete.

## Structure
- `source/seeds/<feature>.seed.ts` — a k6 script that composes `source/apis/` wrappers to create records in bulk; it never re-implements an endpoint call (one definition per endpoint, shared with the tests — see `rules/apis.md`).
- Authenticate once via `login_to_events` from `source/flows/login.flow.ts`, exactly as a test does.

## Volume & sizing
- Drive bulk creation with a high-throughput executor (`shared-iterations` or `per-vu-iterations`) and a `SEED_COUNT` env (default sensible, overridable with `-e SEED_COUNT=`).
- Size the pool to at least the consuming run's peak concurrent VUs × iterations, so each VU/iteration gets its own row (see `rules/tests.md`).

## Discovery handoff
- Stamp every seeded record with a recognizable marker (e.g. a `PerfSeed-<feature>` description) so the consuming test's `setup()` discovers the pool by search rather than a file handoff — k6 has no shared writable state across VUs to emit a data file cleanly.
- For a seed with no NeoLoad counterpart, make the per-run marker unique (append a run token to the configured prefix) and have discovery select the **newest** matching record by prefix, not an exact-name match. A snapshot reset doesn't always precede a reseed, so exact-match discovery can bind to a stale record left by an earlier seed run; newest-by-prefix always picks the current run's data.
- A seed ported from a NeoLoad data-script VU must leave the **same data** that VU leaves: the same records, the same child rows and the same field values (accounts, items, prompt answers). Record names are the exception: they follow the test-data naming rule in `rules/scripting.md`, not the data script's text. Navigation is irrelevant, so drop pure UI reads, but keep every request whose response feeds a saved value. Check each save against the data-script recording (diff the builder's output with the recorded body) rather than reusing a builder that only looks similar.
- NeoLoad hands a data script's records to the consuming VU through a `variables/` file (U13 writes the `Performance BookingEvent <vu><iter><epoch>` names T34 reads from `P_<ver>_CopyServiceOrders`). k6 has no such handoff, so the seed names its records with the consuming journey's test id (`k6-t34-booking-event-<vu><iter><epoch>`, `config.seedEventPrefix`) and discovery searches that prefix. The event search matches a hyphenated prefix as literal text, so it returns only the seed's own records. NeoLoad's bare prefix would not work: other VUs reuse it, the search exceeds its 25,000-row limit, and it returns no rows. Discovery samples a bounded subset and interleaves their rows so consecutive iterations land on different parents (`discover_service_order_pool`). Check whether the env already holds the data-script's records (search one exact name from the `variables/` file) before seeding, but expect a fresh seed on any env NeoLoad's data run did not target: `P_Performance_Sites` maps each version to its env.
- Insert transactions need a runtime-unique key per record (`runToken`, e.g. `ER100_SO_SEARCH`) — see `rules/scripting.md`.

## Tagging
- Tag seed requests with their own names; a seed run is not the measured test, so it defines no SLO thresholds (those live with each journey's flow as `<journey>Thresholds` — see `rules/flows.md`).

## Date-sensitive data
- When the test adds date-bound children to a seeded parent (e.g. service-order items under an event's auto-created function), seed the parent with a current/future date range that contains the children's dates, and date the children inside that range — the server validates a child's date against the parent's range and rejects or prompts to confirm one that falls outside it. Anchor seeded dates relative to run time (not a captured literal) so they never drift into the past.
