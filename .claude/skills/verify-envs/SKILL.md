---
name: verify-envs
description: Verify a k6 journey (or the whole smoke suite) against the live version matrix — main plus the released version path segments in ReleaseVersion — by running it once per env and triaging any failure as drift vs correlation. Use after authoring a journey to prove it beyond main, and in suite mode after a branch cut when the window slides and every script needs re-checking.
---

# Verify across the version matrix

A journey is authored and proven against **`main`** (the unreleased, highest-priority env — see `generate-test` / `neoload-to-k6`). This skill proves it **trickles down** to the released envs, and — in suite mode — re-checks the whole fleet after a branch cut. The insight behind it: across Momentus versions the same journey almost always runs unchanged; the rare real drift is a small, code-parameterizable change (a grid column shift, a renamed field). Running the script across envs surfaces exactly those cases without ever re-recording.

**This sends real traffic to each env (VPN required). Tell the user before running, and take run approval once for the whole matrix sweep.**

## The matrix is the ReleaseVersion type

`source/utils/types/config.type.ts` is the **single source of truth** for which envs are live:

```ts
export type ReleaseVersion = 'main' | '26_2' | '26_1' | '25_4';
```

Read the union members straight from that file to build the matrix — never hardcode a version list in this skill. `main` is always present and always resolves to the *next unreleased* version; the numbered segments are the currently-released versions, newest first, sliding by one at each branch cut.

## Modes

| Mode | Target | When | Command per env |
|---|---|---|---|
| **per-journey** (default) | one journey | after authoring, to prove it below `main` | `k6 run -e SCENARIO=<journey> source/tests/smoke.spec.ts` |
| **suite** | every journey | after a branch cut, when the window slid and all scripts need re-checking | `k6 run source/tests/smoke.spec.ts` (the smoke aggregate = every journey once) |

Invocation: `/verify-envs <journey>` for per-journey; `/verify-envs --suite` (or "branch cut") for the whole suite.

## Before starting

1. Confirm mode + target (which journey, or the whole suite).
2. Check the prerequisites exist: `temp/secret.json` (the decryption passphrase — every `k6 run` needs it) and `temp/setup.json`. The sweep only rewrites `env`; the site stays `PERF` (perf runs never target QE/AT/RC), so setup needs no `--site`.
3. Read the `ReleaseVersion` members from `source/utils/types/config.type.ts`. Order the sweep **`main` first**, then the released segments newest→oldest.
4. Get run approval once for the whole sweep.

## 1. Sweep the matrix (main first)

For each env in the matrix, in order:

1. Point the run at it: `npm run setup -- --env <env>` (rewrites `temp/setup.json`; site stays the `PERF` default).
2. Run the mode's command.
3. Record the result against the env's **resolved** version, not the alias — a run correlates the app version at runtime (`fetch_server_version()`), so report `main → 26.3`, not just `main`. This keeps results unambiguous across branch cuts.

**`main` first is deliberate.** It's the highest-priority env and the one where next-version drift appears first — a failure there is the early warning for the change that will hit the next release. A clean `main` plus clean released envs is the goal; fail fast on `main` before spending traffic on the rest.

Read each summary for the same concrete signals the 3-step run uses: `checks` 100%, `http_req_failed` 0, `dropped_iterations` 0, no threshold crossed, no `WARN`/`ERRO`.

## 2. Triage a failure

Classify each failing env, reusing the `payload-drift` triage (that skill is the authority on the drift-vs-not decision — don't re-derive it):

- **Payload drift** — a save-success check fails on a journey whose login/reads passed; the write returns non-2xx or a 200/201 with a `ResultValue`/`MessageKey` error body. This is the real cross-version signal (e.g. a grid column added/removed, a field renamed). Hand off to `payload-drift` §2–4 to pinpoint and fix the builder.
- **Correlation / auth / env** — login or a read step fails, or a value that should be extracted is stale. Out of scope for drift; fix the wrapper's correlation (per the scripting rule).
- **Data starvation** — `dropped_iterations` > 0 with checks otherwise green means the env lacks the seed data the journey needs (a snapshot not reset, a pool not seeded on that env), **not** drift. Flag it as an env-provisioning gap, not a script bug.

A journey that passes on `main` but drifts on an older released env (or vice versa) is the case this skill exists to catch: fix it once in the builder with a version-tolerant approach — read the column **by name** from the grid metadata, or branch on version — rather than forking the script per env.

## 3. Report the matrix

Present a journey × env grid — each cell pass / drift / correlation-fail / data-gap — labelled by resolved version. Name the exact builder/wrapper for each real drift, and separate genuine drift from env-provisioning gaps so the fix queue is clear.

## 4. Restore

Restore the authoring default with a bare `npm run setup` (site `PERF`, env `main`) so the next inner-loop run targets `main` again. `temp/` is disposable scratch otherwise.

## Branch-cut ritual

A branch cut is the fleet-wide trigger for suite mode. Two moves, in order:

1. **Advance the source of truth** — edit the `ReleaseVersion` union in `source/utils/types/config.type.ts` in one line: drop the retired oldest segment, prepend the newly-released one (the version `main` used to resolve to). E.g. at the next cut `'main' | '26_2' | '26_1' | '25_4'` → `'main' | '26_3' | '26_2' | '26_1'`. `main` stays — it now resolves to the next unreleased version. `tsc --noEmit` will flag any lingering reference to the retired segment.
2. **Run suite mode** across the new matrix. The newly-released env is low-risk (it's what `main` was, already proven during authoring); the real exposure is `main` having advanced to a brand-new unreleased version no script has seen — which is why the sweep runs `main` first. The output matrix is the fix queue for the cut.
