---
paths: ["source/probes/**"]
---

# Probe Conventions (`source/probes/`)

A probe is a read-only check against a live env, and there are two kinds. A **pool probe** checks a generated value pool (`source/data/pools/`, see `rules/data.md`) before a journey trips over a bad row. A **seed probe** checks a seed's records against NeoLoad's (see Seed probes below). Both create nothing, so neither needs a snapshot reset.

A pool probe sends one read per pool row. Run it after regenerating a pool and after a snapshot reset; both can bring back rows the env rejects.

## Pool probe structure
- `source/probes/<pool>.probe.ts`, named for the pool it checks (`be-search-account.probe.ts` ← `be-search-account.data.ts`). An entry-point folder like `tests/` and `seeds/`: k6 runs it directly and nothing imports it, so it has no barrel.
- Send each row through the journey's own `source/apis/` wrapper with a `Probe<Thing>` tag name, never a re-implemented request. A row the wrapper rejects is a row the journey would reject, and the wrapper's failure log already names it.
- Log in once in `setup()` via `login_to_events` and share the token (`PoolProbeSetup`). Pool reads are light, so one login's server-side request serialization doesn't stall them.
- `shared-iterations` with `iterations` = the pool length and `exec.scenario.iterationInTest` as the row index, so every row is read exactly once. `PROBE_VUS` (default 4) sets the spread; size `maxDuration` to cover the pool.
- Gate on `checks: ['rate==1']`, so any rejected row fails the run. A probe has no SLA thresholds; it is not the measured test.

## Which pools can be probed
- Only a pool whose wrapper is a read. A pool that can only be tested by a save (the booking-space pool, checked by `save_booking`) has no probe: its bad rows surface by name in the save wrapper's failure log during normal runs.

## Acting on a failure
- Prune each named row from the pool module and record it in the pool's header, with the server's reason, so the prune is re-applied after any regenerate.

## Seed probes
A seed probe checks a `source/seeds/` seed against the data NeoLoad's data-script VU left on an env. `neoload-port-review.cjs` §6b compares the seed's *requests* with the recording. Only reading the records back shows what the server *made* of them: defaults it filled, a business rule that fired differently, a child row created on one side only, a status the record ended in.
- `source/probes/<seed>-seed.probe.ts`, one per seed (`invoice-events-seed.probe.ts` ← `invoice-events.seed.ts`). It reads one NeoLoad-created record and one k6-seeded record through the journey's own read wrappers, then compares them with `compare_record_fields` / `compare_record_count` (`parity.helper.ts`). A field that differs per record by design (keys, names, dates, values picked from a pool, account-derived defaults) is listed in the helper's `…IdentityFields` and skipped. Every other field must match.
- Find the NeoLoad record the way the journey would. A journey that picks from a live grid (T08) finds both records in that grid by prefix (`Performance BookingEvent ` vs the seed's `config` prefix), so it needs no input. Otherwise pass one exact name from the data script's `variables/version_<ver>/` file as `-e REF_NAME=` (NeoLoad's bare prefix exceeds the search's row limit). The k6 side is the newest record carrying the seed's `config` prefix.
- One VU, one iteration, `checks: ['rate==1']`. Each mismatch logs `<Record>.<field>: NeoLoad '…', k6 seed '…'`.
- It only runs on an env that still holds NeoLoad's records: one that `P_Performance_Sites` maps to a version whose `variables/` file lists them, and whose records a load run hasn't used up. `main` usually has none, so point `temp/setup.json` at a covered env, run it after seeding that env, and restore the default after.
- A mismatch is a finding against the seed, not the probe. Fix the seed's payload so it leaves the NeoLoad record's value, or, when the field legitimately varies per record, add it to the identity list with the reason in the commit.
