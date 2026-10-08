---
name: perf-1-seed-port
description: Step 1 of the NeoLoad port pipeline — port a journey's paired @u* data-script VU into a source/seeds/ seed with its seed probe, its k6-t<id>- config prefix and the read that finds its records, then prove it with one small seed run on main. No journey scripting. Use when a NeoLoad journey has a paired data-script VU and no seed yet (`/perf-1-seed-port <journey VU>`), or when perf-3-journey-port stops at its seed gate.
---

# 1 · Seed port — the data-script VU → `source/seeds/`

**Pipeline** (each step in a fresh session; each ends by handing over the next command):
**`perf-1-seed-port`** → `perf-2-seed-review` → `perf-3-journey-port` → `perf-4-journey-review` → `/verify-envs`.

This step ports only the prerequisite data. The journey itself is `perf-3-journey-port`, which reuses what this
step leaves. Keeping the seed in its own session keeps the data script's digest, its builder diffs and the seed run
out of the journey's context.

**Run this in the main conversation.** The user must see step-by-step progress.

## Before starting

1. **Find the data script.** The argument is the **journey** VU tree (`team/vus/@t<NN>_…`). The seed↔journey map
   is keyed by the journey (its test-data population), so start there:

   ```bash
   node .claude/scripts/neoload-digest.cjs "<journey VU>" --paired
   ```

   It prints only the paired `@u<NN>_@data@script_…` VU, at the journey's version, and the command to digest it.
   `(none found)` means the journey needs no seed: say so and hand over (§5). A data-script VU is recognizable by
   `errorPolicy="STOP_AND_START"`, no SLA profile, `MODE_NO_PACING`/zero think-time, and a tail `DataWrite_*` jsAction.
2. **Check for an existing seed.** A seed exists when a `config` key in `source/config/env.config.ts` has a value
   starting `k6-t<id>-` (the journey's unpadded test id) and a file in `source/seeds/` uses that key. If one exists,
   there is nothing to port: say which, and hand over (§5). "Equivalent" means it leaves the data this data script
   leaves; `perf-2-seed-review` checks that, not this step.
3. **Target `main` on PERF.** A bare `npm run setup` writes it. Check `temp/setup.json`, `temp/secret.json`, and a
   `usiadmin` entry in `temp/seed-users.json` exist (every seed signs in as `usiadmin`, `rules/seeds.md`).
4. **Tell the user upfront** that one seed run, `/seed main <feature> +3`, is the only traffic this step sends, and
   that it writes data (the DB snapshot reset owns cleanup). It is mandatory, so there is no approval prompt.
5. **Recon the k6 repo (delegated).** Dispatch `k6-authoring-analyst` for a *seed authoring kit*, written to
   `temp/claude/docs/recon-kit.md`, from the data-script VU name and the step names in its digest:
   - the closest existing seed (`source/seeds/*.seed.ts`) as the template: its `options`, `setup()` top-up count,
     `SEED_COUNT` / `SEED_ADD` / `SEED_VUS` / `SEED_MAX_DURATION` handling, and its `SeedSetup` / `SeedSession` slice;
   - the **exact signature** of every existing wrapper for the data script's writes and the reads that feed them;
   - the **full payload skeleton** of the closest builder for each write (envelope, `TransportTable` columns, which
     cells are parameterized);
   - which `source/data/pools/` modules already exist for the pools the data script picks;
   - the closest existing seed probe and the `parity.helper.ts` API;
   - the `config` block where seed prefixes live, and the barrel `export *` lines.

   Then **author from the kit alone** — don't reopen the modules it summarizes. If a detail is missing, ask the
   analyst to extend the kit.

## 1. Digest the data script (zero traffic)

Run the command `--paired` printed. **Read the digest, not the raw tree.** It covers the step order (including steps
inside a `loop-action`, marked `×n`), the spine with its extractors, the data pools, the **DATA WRITES** section (the
variable the data script hands over and the `variables/` file it goes to, e.g. `C_ALT_EVT_DESC →
Data_MultipleServiceOrders.txt`), and a dissection of every write body. Never derive the seed from the journey's reads
or from what the records look like: a hand-written seed creates a plain record where the data script leaves a booked
event with a function and answered service orders.

**How the journey finds the records** decides the finder (§2). Check the journey tree, not its digest:

```bash
grep -rl 'TransportDataRows\[\*\]' "<journey VU>/actions-container"
```

A hit whose `<variable-extractor>` carries `matchNumber="0"` (a random row), consumed by a jsAction that splits it into
variables, means the journey **picks its record in-flow from a live grid** (T08 picks a non-invoiced order this way).
Otherwise the journey reads the data script's handoff file, and k6 replaces that with a **prefix search** in the
journey's smoke `setup()`.

For a body the digest doesn't dissect, extract the zip and run `inspect-capture.cjs` on the `req_*.txt` (the request
XML's body is templated, not valid JSON). Every helper lives in `.claude/scripts/`; invoke it from the repo root.

## 2. Script the seed

The seeds rule (`rules/seeds.md`) auto-loads when you edit `source/seeds/`, and the apis/data/scripting/exports
rules for their layers. Follow them; the points that decide a port:

- **Leave the same data, not the same navigation.** Keep every write the data script makes per pass, and the prompt
  answer it sends. Repeat each `loop` as many times as the recording does. Carry the same cells in each save, and pick
  per iteration from every pool the data script picks from (port a missing pool complete with `gen-pool.cjs`, per
  `rules/data.md`). Drop a UI read unless a saved value comes from it.
- **Diff every save builder against the data script's recorded body** with `compare-payload.cjs`, rather than reusing
  a builder that only looks similar. Generate a new builder with `gen-payload-builder.cjs` instead of transcribing.
- **Replace the handoff, never replay it.** Name the seeded records with a new `config` prefix carrying the
  **consuming journey's** test id (`seedEventPrefix: 'k6-t34-booking-event'`) and the `k6-t<id>-<what>-<vu><iter><epoch>`
  pattern (`rules/scripting.md`). Never replay a captured key from the data script's recording.
- **Write the finder: the read that returns the seed's records by its prefix.** The seed's top-up count and the
  journey's discovery use the same read, so this step owns it and `perf-3-journey-port` reuses it. For a single
  request, it's a wrapper in `source/apis/<feature>.api.ts` (`read_non_invoiced_orders` takes the prefix). When it
  composes several calls, export a `find_*` from the journey's future flow module,
  `source/flows/t<id>-<flow>.flow.ts`: create the file with only the finder, export it through `flows.exp.ts`, and
  leave the journey to `perf-3-journey-port`. For an in-flow grid pick, the finder is that grid read with a `LIKE`
  filter on the event description (the grid object's own column id, from `ObjectColumnCacheServer/GetObjectColumns`)
  set to the prefix: the server caps a grid read at 1000 rows in its view's order, so unfiltered, the seeded rows
  can fall past the cap.
- **Top up, never pile on.** `setup()` counts existing records through the finder and creates only the shortfall;
  `-e SEED_ADD=n` creates n regardless.
- **Size it.** When the journey's write takes the record out of its own pick list (an invoiced order leaves the
  non-invoiced grid), each journey iteration consumes one seeded record. Note the volume a `neoload` load run needs
  (VUs × run time ÷ pacing) and keep `SEED_COUNT`'s default above it, or say it must be raised.
- **Add the seed probe**, `source/probes/<feature>-seed.probe.ts` (`rules/probes.md`, Seed probes): it reads one
  NeoLoad-created record and one k6-seeded record back and compares their fields with `parity.helper.ts`. Skip only
  fields that truly vary per record in its `…IdentityFields`.
- NeoLoad's own records are a **reference, not a substitute**: discovery searches the k6 prefix, so every env runs
  the k6 seed. The data script's output file in `variables/version_<ver>/` names records the probe can compare against.

## 3. Verify

1. Zero traffic: `npx tsc --noEmit`, then `k6 inspect source/seeds/<feature>.seed.ts` and
   `k6 inspect source/probes/<feature>-seed.probe.ts`.
2. **Coverage gate (zero traffic)**, the seed half of the review script. The flow may not exist yet, so pass the
   journey VU tree and the flow path it will have:

   ```bash
   node .claude/scripts/neoload-port-review.cjs "<journey VU>" source/flows/t<id>-<flow>.flow.ts --only 6b
   ```

   Resolve every FLAG: a write the seed leaves out or adds, a missing loop count, a saved table cell that differs,
   a pool pinned instead of picked, a missing seed probe, or no seed found under the `k6-t<id>-` prefix.
3. **The seed run:** follow the `seed` skill as `/seed main <feature> +3` (three new records, not a top-up). Pass the
   seed's name, not the journey's: `/seed` resolves a journey through `smoke.spec.ts`, which doesn't register it yet.
   Clean means three `Booked` lines, `checks` 100%, `http_req_failed` 0. Then confirm the finder returns them: the
   run's setup line counts the records under the new prefix. Fix and re-run up to ~2–3 times, then surface it to the
   user. Decode a failed save's `MessageInfoList` before changing inputs (a `Security Restriction` is an env
   privilege gap, not a script bug).

That run is the only traffic. The seed probe needs an env that still holds NeoLoad's records, which `main` usually
doesn't, so it's the user's run: name it in the report.

## 4. Report

The data-script VU → seed file, writes per pass and loop counts, the config prefix and where the finder lives,
pools ported or reused, builders generated vs reused (and the `compare-payload.cjs` result), the coverage gate result,
the seed run (found / created), the volume a load run needs for a journey that uses up its records, and the seed
probe command for the user, with the env to point `temp/setup.json` at and a `-e REF_NAME=` from the file when the
journey doesn't pick from a live grid.

## 5. Handover

End with exactly one next command, with its arguments filled in, to run after `/clear` (or in a new session):

- Seed ported: `/perf-2-seed-review <journey VU>`.
- No seed needed, or one already exists: `/perf-3-journey-port <journey VU>`.

Never run the next skill in this session. The review must not inherit this session's reasoning, and the journey
port's context should start without the seed's.
