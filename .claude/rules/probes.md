---
paths: ["source/probes/**"]
---

# Pool Probe Conventions (`source/probes/`)

A probe checks a generated value pool (`source/data/pools/`, see `rules/data.md`) against a live env before a journey trips over a bad row. It sends one read per pool row and creates nothing, so it needs no snapshot reset. Run it after regenerating a pool and after a snapshot reset; both can bring back rows the env rejects.

## Structure
- `source/probes/<pool>.probe.ts`, named for the pool it checks (`be-search-account.probe.ts` ← `be-search-account.data.ts`). An entry-point folder like `tests/` and `seeds/`: k6 runs it directly and nothing imports it, so it has no barrel.
- Send each row through the journey's own `source/apis/` wrapper with a `Probe<Thing>` tag name, never a re-implemented request. A row the wrapper rejects is a row the journey would reject, and the wrapper's failure log already names it.
- Log in once in `setup()` via `login_to_events` and share the token (`PoolProbeSetup`). Pool reads are light, so one login's server-side request serialization doesn't stall them.
- `shared-iterations` with `iterations` = the pool length and `exec.scenario.iterationInTest` as the row index, so every row is read exactly once. `PROBE_VUS` (default 4) sets the spread; size `maxDuration` to cover the pool.
- Gate on `checks: ['rate==1']`, so any rejected row fails the run. A probe has no SLA thresholds; it is not the measured test.

## Which pools can be probed
- Only a pool whose wrapper is a read. A pool that can only be tested by a save (the booking-space pool, checked by `save_booking`) has no probe: its bad rows surface by name in the save wrapper's failure log during normal runs.

## Acting on a failure
- Prune each named row from the pool module and record it in the pool's header, with the server's reason, so the prune is re-applied after any regenerate.
