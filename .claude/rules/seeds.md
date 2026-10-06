---
paths: ["source/seeds/**"]
---

# Seed Script Conventions (`source/seeds/`)

Seed scripts bulk-create the prerequisite data a journey needs to already exist. They run **once after a DB-snapshot reset and before the test**; the snapshot owns cleanup, so seed scripts never delete.

## Structure
- `source/seeds/<feature>.seed.ts` — a k6 script that composes `source/apis/` wrappers to create records in bulk; it never re-implements an endpoint call (one definition per endpoint, shared with the tests — see `rules/apis.md`).
- Each VU signs in once via `login_to_events` from `source/flows/login.flow.ts`, as its own pool user (`pick_user`), and reuses that session for its iterations. Momentus processes one user's requests one at a time, so a seed that shares one login runs no faster with more VUs.

## Volume & sizing
- Drive bulk creation with a high-throughput executor (`shared-iterations` or `per-vu-iterations`) and a `SEED_COUNT` env (default sensible, overridable with `-e SEED_COUNT=`), plus `SEED_VUS` (default 10, capped at the iteration count, since `shared-iterations` refuses fewer iterations than VUs) and a `SEED_MAX_DURATION` cap (default `4h`) so a large count isn't cut short.
- `SEED_COUNT` is a **target, not an increment**. `setup()` signs in once, counts the records already carrying the seed's k6 prefix with the same read its journey finds them by (an event search, or the non-invoiced grid when the journey uses its records up), and returns the shortfall. Iterations past it return at once, so a re-run never piles records on. `-e SEED_ADD=n` creates n records regardless, for proving a new or changed seed.
- Size the pool to at least the consuming run's peak concurrent VUs × iterations, so each VU/iteration gets its own row (see `rules/tests.md`).

## Discovery handoff
- Stamp every seeded record with a recognizable marker (e.g. a `PerfSeed-<feature>` description) so the consuming test's `setup()` discovers the pool by search rather than a file handoff — k6 has no shared writable state across VUs to emit a data file cleanly.
- For a seed with no NeoLoad counterpart, make the per-run marker unique (append a run token to the configured prefix) and have discovery select the **newest** matching record by prefix, not an exact-name match. A snapshot reset doesn't always precede a reseed, so exact-match discovery can bind to a stale record left by an earlier seed run; newest-by-prefix always picks the current run's data.
- A seed ported from a NeoLoad data-script VU must leave the **same data** that VU leaves: the same records, the same child rows and the same field values (accounts, items, prompt answers). Record names are the exception: they follow the test-data naming rule in `rules/scripting.md`, not the data script's text. Navigation is irrelevant, so drop pure UI reads, but keep every request whose response feeds a saved value. Check each save against the data-script recording (diff the builder's output with the recorded body) rather than reusing a builder that only looks similar. Work from the data script's own digest (`neoload-digest.cjs` on its tree; the journey's digest prints the command), which includes the steps inside its `loop-action`, never from the journey's reads. `neoload-port-review.cjs` section 6 checks the result: the writes per pass, the loop counts, each saved table, and the pools picked.
- NeoLoad hands a data script's records to the consuming VU through a `variables/` file (U13 writes the `Performance BookingEvent <vu><iter><epoch>` names T34 reads from `P_<ver>_CopyServiceOrders`). k6 has no such handoff, so the seed names its records with the consuming journey's test id (`k6-t34-booking-event-<vu><iter><epoch>`, `config.seedEventPrefix`) and discovery searches that prefix. The event search matches a hyphenated prefix as literal text, so it returns only the seed's own records. NeoLoad's bare prefix would not work: other VUs reuse it, the search exceeds its 25,000-row limit, and it returns no rows. Discovery samples a bounded subset and interleaves their rows so consecutive iterations land on different parents (`discover_service_order_pool`). Because discovery searches the k6 prefix, NeoLoad's own records are never discovered, so **every env runs the k6 seed**, including one NeoLoad's data run covered. Those records are a **reference to compare against, not a substitute for seeding**: the seed probe (`rules/probes.md`) reads one of them back beside a k6-seeded record. `P_Performance_Sites` maps each version to the env its `variables/` file describes. The exception is a journey that picks any eligible record from a live grid (T08's non-invoiced orders): it can consume NeoLoad's leftovers too, but a green run on them proves nothing about the seed.
- Insert transactions need a runtime-unique key per record (`runToken`, e.g. `ER100_SO_SEARCH`) — see `rules/scripting.md`.

## Running a seed
- Run a seed with the `/seed <env> <journey | seed> [count]` skill: it switches env, sizes the count (`neoload` matches the rows NeoLoad stored for that version, read from the `seed target` line of `neoload-port-review.cjs`), runs the seed and restores the authoring env.
- Run a newly ported seed **before** the journey's verification ladder, with a small batch of new records (`/seed main <journey> +3`, so an env that already holds k6 records still gets fresh ones), and confirm the journey finds those records (its `discover_*` count, or the grid row it picks carrying the seed's prefix). A ladder that passes on records left by NeoLoad or by an earlier run doesn't prove the seed works. It sends traffic, so tell the user first.
- Then run the seed probe on an env that still holds NeoLoad's records, after seeding that env, and act on each mismatch (`rules/probes.md`).

## Seed-data gaps
- A journey whose records come from a seed fails with `seed_gap_message(<journey>, <detail>)` when it finds none: discovery throws it from `setup()`, a grid pick passes it to `fail()`. The message reads `no seed data (…): run /seed <env> <journey>`, so `/verify-envs` can tell a data gap from drift, seed 3 records and re-run once, and a person running the journey by hand knows the fix.

## Tagging
- Tag seed requests with their own names; a seed run is not the measured test, so it defines no SLO thresholds (those live with each journey's flow as `<journey>Thresholds` — see `rules/flows.md`).

## Date-sensitive data
- When the test adds date-bound children to a seeded parent (e.g. service-order items under an event's auto-created function), seed the parent with a current/future date range that contains the children's dates, and date the children inside that range — the server validates a child's date against the parent's range and rejects or prompts to confirm one that falls outside it. Anchor seeded dates relative to run time (not a captured literal) so they never drift into the past.
