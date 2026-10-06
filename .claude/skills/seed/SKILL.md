---
name: seed
description: Top up a journey's seed data on one env of the version matrix — switch env, size the target (a number, or `neoload` to match the rows NeoLoad stored for that version), run source/seeds/<feature>.seed.ts, which counts the k6 records already there and creates only the shortfall, report what it found and created, and restore the authoring env. Use to provision an env after a snapshot reset, before a load run, or when a run fails with "no seed data". Sends traffic.
---

# Seed an env

`/seed <env> <journey | seed> [count | +n] [--probe]`

- `<env>` — a member of the `ReleaseVersion` union in `source/utils/types/config.type.ts` (`main` or a released
  segment). Anything else stops the skill with the live list.
- `<journey | seed>` — a smoke scenario name (`invoice_events`, `copy_service_orders`) or a seed file/name
  (`invoice-events`, `source/seeds/invoice-events.seed.ts`).
- `[count]` — the number of k6 parent records the env should hold (`SEED_COUNT`). Default **3**, enough for a
  verification run. `neoload` sizes it to the rows NeoLoad's data run stored for the env's version (§2).

**It tops up, never piles on.** Each seed's `setup()` counts the records already carrying its k6 prefix (the
same read its journey finds them with: an event search, or the non-invoiced grid for a journey that uses its
records up) and creates only the shortfall. An env that already meets the target gets one count read and no
writes, so re-running `/seed` is always safe.
- `+n` — create n new records whatever is already there (`-e SEED_ADD=n`). Use it only to prove a new or changed
  seed creates records (`neoload-to-k6` step 0): a top-up on an env that already holds enough would create none.
- `--probe` — run the seed's probe afterwards (§5).

**This sends write traffic to the env (VPN required).** Invoking the skill is the go-ahead, but state the env,
seed and target in one line before the first request, and give a rough duration for a target above 20.

## 1. Resolve the seed

- A seed name or path is used as is: `source/seeds/<feature>.seed.ts`.
- A journey name: find its flow (`smoke.spec.ts` maps the scenario to a `source/flows/t<id>-<flow>.flow.ts`
  journey), take the test id, and pick the seed whose records carry it: the `config` key in
  `source/config/env.config.ts` whose value starts with `k6-t<id>-`, used by a file in `source/seeds/`. No such
  seed means the journey needs none: say so and stop.

## 2. Switch the env and size the count

1. Check `temp/secret.json` exists (every `k6 run` needs the passphrase).
2. `npm run setup -- --env <env>` (the site stays `PERF`).
3. Resolve the build: `curl -s https://performance.ungerboeck.net/<env>/app85.cshtml | grep -o "[?&]v=[0-9][0-9.]*" | head -1`
   (e.g. `26.2.0.123` → version `26_2`; a bare `?v=` match finds an empty token first). On a released env this also warms its cold app pool; repeat until it
   answers quickly, and prefix the run with `K6_SETUP_TIMEOUT=180s`.
4. For `neoload`, read the target from the review script (zero traffic):

   ```bash
   node .claude/scripts/neoload-port-review.cjs "C:/momentus-projects/performance" source/flows/<flow>.flow.ts | grep "seed target"
   ```

   The line gives the data file's planned size in NeoLoad's `data_distribution_config.csv` and the rows its
   `variables/` file holds per version. Use the rows for the resolved version. A version with no file (`main`
   usually runs one ahead of NeoLoad) takes the newest version's rows; say which. The planned size is NeoLoad's
   own target before load runs used records up; use it only when the user asks for it.

## 3. Run

```bash
k6 run --quiet -e SEED_COUNT=<n> source/seeds/<feature>.seed.ts > temp/claude/reports/seed-<feature>-<env>.log 2>&1
```

- Target ≤ 20: run it through `k6-run-reporter`, which checks the run is clean.
- Larger targets: run it with Bash `run_in_background`, then read the log's summary when it finishes. Each VU
  signs in as its own pool user, so `-e SEED_VUS=` scales the run (default 10). The run stops at
  `SEED_MAX_DURATION` (default `4h`), so a very large count may be cut short; §4 catches that.

## 4. Judge the run

- Read the setup line `"<prefix>" …: <found> found, target <n>, creating <shortfall>`. `iterations` always equals
  the target, since iterations past the shortfall return at once, so count the `Booked "…"` lines instead.
- Clean: the `Booked` lines equal the shortfall, `checks` 100%, `http_req_failed` 0, no `ERRO`. A shortfall of
  0 is clean with no writes.
- Short: fewer `Booked` lines than the shortfall (a timeout or a failed iteration). Re-run `/seed` with the same
  target: it counts again and creates only what is still missing.
- Failed in `setup()`: the usual VPN, passphrase or cold-pool causes. Nothing was created.
- A write fails with `Security Restriction: "… restricted by access privilege: <privilege>"`: the env's test users
  lack that privilege. It's an env permission gap, not a script bug, so don't retry. Report the privilege named,
  so an admin can grant it to the perf test users, and say which records were left part-built.

## 5. Probe (only with `--probe`)

Run the seed's probe, `source/probes/<feature>-seed.probe.ts`, on the same env. It compares one record
NeoLoad's data run created with one the seed just created, so it needs NeoLoad's records on that env. A probe
that takes `-e REF_NAME=` gets one name from that version's `variables/` file. Report each field that differs;
act on mismatches per `rules/probes.md`.

## 6. Restore and report

Always run a bare `npm run setup` afterwards, even when the run failed, so the next run targets `main` again.

Report one line per seed run: env → resolved version, seed, found / created / target, duration, probe result
if run, and the log path.
