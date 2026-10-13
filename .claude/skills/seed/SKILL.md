---
name: seed
description: Top up a journey's seed data on one env of the version matrix — switch env, size the target (a number, or `neoload` to match the rows NeoLoad stored for that version), run source/seeds/<feature>.seed.ts, which counts the k6 records already there and creates only the shortfall, report what it found and created, and restore the authoring env. `--all` does this for every seed in source/seeds/ in one sweep, topping each up until it reaches its target. Use to provision an env after a snapshot reset, before a load run, or when a run fails with "no seed data". Sends traffic.
---

# Seed an env

`/seed <env> <journey | seed> [count | +n] [--probe]`
`/seed <env> --all [neoload] [--probe]` — every seed in one sweep (§7)

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
  seed creates records (`perf-1-seed-port`, which passes the seed name since the journey isn't in `smoke.spec.ts`
  yet): a top-up on an env that already holds enough would create none.
- `--probe` — run the seed's probe afterwards (§5).
- `--all` — provision every seed under `source/seeds/` on the env, each to its own target, and re-run any that fall
  short (§7). It takes no `[count]` or `+n`: a count means one thing per seed, and `+n` on every seed would pile
  records on.

**This sends write traffic to the env (VPN required).** Invoking the skill is the go-ahead, but state the env,
seed and target in one line before the first request, and give a rough duration for a target above 20.

## 1. Resolve the seed

- A seed name or path is used as is: `source/seeds/<feature>.seed.ts`.
- A journey name: find its flow (`smoke.spec.ts` maps the scenario to a `source/flows/t<id>-<flow>.flow.ts`
  journey), take the test id, and pick the seed whose records carry it: the `config` key in
  `source/config/env.config.ts` whose value starts with `k6-t<id>-`, used by a file in `source/seeds/`. No such
  seed means the journey needs none: say so and stop.

## 2. Switch the env and size the count

1. Check `temp/secret.json` exists (every `k6 run` needs the passphrase) and that `temp/seed-users.json` holds a
   `usiadmin` entry: every seed signs in as `usiadmin`, never as a pool user. If the file or the entry is missing,
   stop and tell the user rather than running the seed on pool users.
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
  signs in as `usiadmin` on its own session, so `-e SEED_VUS=` scales the run (default 10). The run stops at
  `SEED_MAX_DURATION` (default `4h`), so a very large count may be cut short; §4 catches that.

## 4. Judge the run

- Read the setup line `"<prefix>" …: <found> found, target <n>, creating <shortfall>`. `iterations` always equals
  the target, since iterations past the shortfall return at once, so count the seed's own created-record lines
  (`Booked "…"`, `Received purchase order …`; each seed words its own) instead.
- Clean: the created lines equal the shortfall, `checks` 100%, `http_req_failed` 0, no `ERRO`. A shortfall of
  0 is clean with no writes.
- Short: fewer created lines than the shortfall (a timeout, a dropped connection or a failed iteration). Re-run
  `/seed` with the same target: it counts again and creates only what is still missing. The re-run's `found`
  is the reliable tally, since a failed iteration can leave a part-built record the finder doesn't count.
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

## 7. Sweep every seed (`--all`)

Provisions the whole env for a load run in one pass. §2 steps 1–3 and the §6 restore happen **once** for the
sweep, not once per seed.

1. **List the seeds.** `source/seeds/*.seed.ts` is the authoritative list, so a new seed is picked up without
   editing this skill. Every seed sizes itself.
2. **Size each one.** By default, run each seed with **no** `-e SEED_COUNT`, so its file's own default target
   applies (the full-load size, set against the flow's share in `neoload.spec.ts`). With `neoload`, find each
   seed's journey (the flow that reads the same `k6-t<id>-` config key), take its target from §2 step 4 and give
   the script that seed as `<feature>:<count>`, which passes `-e SEED_COUNT=<count>` on every pass (the count is
   a target, not an increment, so the same value is right each time). A seed with no journey or no NeoLoad rows
   goes in bare, keeps its default, and the report says so.
3. **Say what's coming** in one line before the first request: env, the seeds and their targets, and a rough
   duration (a from-empty sweep of six seeds took about 15 minutes plus top-ups; an env already at target is a few
   minutes of count reads).
4. **Run the seeds one after another, never in parallel.** Every run reads the shared `temp/setup.json`, and many
   sessions as `usiadmin` on one env at once risk the same-account serialization guard. Write one scratch script,
   `temp/claude/scratchpad/seed-all-<env>.sh`, and launch it with Bash `run_in_background`. The work is waiting
   on k6, so no subagent is needed. It restores `main` in a `trap`, so an aborted sweep still restores:

   ```bash
   #!/bin/bash
   cd /c/momentus-projects/performance-k6
   trap 'npm run setup >/dev/null 2>&1; echo "DONE $(tr -d "\n " < temp/setup.json)" >> temp/claude/reports/seed-all-<env>.status' EXIT
   npm run setup -- --env <env> >/dev/null 2>&1
   for entry in <feature>[:<count>] <feature>[:<count>] …; do
     seed=${entry%%:*}
     count=${entry#*:}
     size=()
     [ "$count" != "$entry" ] && size=(-e SEED_COUNT=$count)
     prev=-1
     for pass in 1 2 3 4; do
       log=temp/claude/reports/seed-$seed-<env>-pass$pass.log
       K6_SETUP_TIMEOUT=180s k6 run --quiet "${size[@]}" source/seeds/$seed.seed.ts > $log 2>&1
       line=$(grep -m1 -oE ': [0-9]+ [a-z ]*found, (target [0-9]+|adding), creating [0-9]+' $log)
       found=$(echo "$line" | grep -oE '[0-9]+' | head -1)
       creating=$(echo "$line" | sed -E 's/.*creating ([0-9]+)/\1/')
       echo "$seed pass$pass found=$found creating=$creating" >> temp/claude/reports/seed-all-<env>.status
       if grep -q 'Security Restriction' $log; then
         echo "$seed blocked: Security Restriction" >> temp/claude/reports/seed-all-<env>.status
         break
       fi
       [ -z "$line" ] && break
       [ "$creating" = "0" ] && break
       [ "$found" -le "$prev" ] && break
       prev=$found
     done
   done
   ```

   A pass that reports `creating 0` confirms the seed is at target. Any pass that created records is followed by
   another, which counts again and creates only what is still missing, to a cap of 4 passes.
5. **Stop retrying a seed that isn't converging.** A pass whose `found` didn't rise over the last one, a pass with
   no setup line (it failed in `setup()`), and a `Security Restriction` write (§4) all end that seed's passes;
   the sweep moves on to the next seed. Don't retry the same failure for the sake of the cap: report the most
   common `ERRO` line for the seed instead.
6. **Judge per seed** as in §4, using the last pass: at target (a pass reported `creating 0`), short by `n`
   (target minus the last `found`), or blocked (the privilege named). Records a failed iteration left half-built
   (a purchase order approved and issued but never received) stay in the env until a snapshot reset; name them.
7. **Probe (only with `--probe`).** After the sweep, run each seed's `source/probes/<feature>-seed.probe.ts` per
   §5. A seed with no probe is skipped; each probe needs NeoLoad's records on the env.
8. **Report one table**: seed, target, found at the start, passes run, final found, status, and the log paths.
   Confirm `temp/setup.json` is back on `main` before reporting.
