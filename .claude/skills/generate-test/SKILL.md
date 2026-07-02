---
name: generate-test
description: End-to-end — explore an app flow with playwright-cli, script it straight into a k6 test (no intermediate capture file), then verify with a 3-step progressive run. Use when the user wants to record/capture/script a flow or journey as a k6 performance test.
---

# Generate test — explore, script, verify in one pass

One continuous flow: drive the app, build an in-context correlation picture, write the k6 test directly, then prove it with a 3-step run escalation. No `temp/captures/*.md` artifact — script straight from what you observed.

**Run this directly in the main conversation — never delegate exploration to a subagent.** It needs the conversation's app knowledge and existing lib endpoints, and the user must see step-by-step progress; a subagent starts cold and loses everything on interruption.

## Before starting

1. Confirm the target flow with the user if ambiguous (which page, which actions, which data).
2. **Tell the user before opening the browser** — exploration sends real traffic to the environment.
3. Get **approval once, upfront, for the whole sequence** (exploration + the three verification runs). With that approval, run all three steps and any re-runs without prompting again.
4. Read `source/config/env.config.ts` for the app URL (`baseUrl`; the sales-ai `tenantId` is not stored — it's correlated at runtime). For **exploration** you need a live login: `source/data/users.data.ts` ships usernames plaintext but passwords **AES-GCM-encrypted**, so decrypt the first user with the `temp/secret.json` passphrase (via `decryptUsers`) — you can't read a usable password straight from the file. The generated test draws from the full pool via `pickUser` (see §3).
5. `playwright-cli list` — if any session shows `[incompatible please re-open]`, `playwright-cli kill-all` first.

## 1. Explore & observe (in-context)

Ground rules:
- Global `playwright-cli` binary only — **never `npx playwright-cli`** (a second resolved version corrupts the session).
- Named session: `playwright-cli -s=perf <command>`.
- **Batch sequential commands into one Bash call** with `&&`.
- The app is heavy and behind a VPN: first page load can take 30s+ — generous Bash timeout for `open`/`goto`, retry once before declaring a blocker.
- `resize 1920 1080` immediately after `open`.
- Every action prints a snapshot file path — Grep it for the element you need; explicit `snapshot` only when refs are stale.
- Auth: log in through the UI so auth requests are captured, then `state-save temp/auth-state.json`; `state-load` it when it exists.

After each **meaningful UI action** (not every intermediate click):

1. List likely-transactional requests:
   ```bash
   playwright-cli -s=perf requests | grep -viE '\.(js|css|svg|png|woff2?|ico|html|map)(\?|$| )' | grep -iE 'api/|\[(POST|PUT|PATCH|DELETE)\]'
   ```
2. Note which request numbers are NEW since the last listing — those belong to this step.
3. Drill into each new one, batched:
   ```bash
   playwright-cli -s=perf request-headers <n> && playwright-cli -s=perf request-body <n> && playwright-cli -s=perf response-body <n>
   ```
   Keep only dynamic/auth headers (authorization, version, x-nonce, wsid, content-type). For huge payloads, redirect to `temp/captures/raw/` and Grep rather than printing.

Exclude static assets, analytics/telemetry, and repeated identical fetches.

Hold an in-context correlation table as you go — every dynamic value, what produces it, what consumes it. Pay special attention to IDs created mid-flow (an opportunity id returned by a create call, reused in detail/task URLs). When the correlation picture is clear, go straight to scripting — do **not** write a capture file.

## 2. Correlate

Classify every dynamic value:

| Classification | Meaning | Strategy |
|---|---|---|
| server-generated | first appears in a response | extract at runtime (regex/JSON path); never hardcode |
| client-generated | UUIDs, nonces, timestamps the browser made up | regenerate per request (`crypto.randomUUID()`, `new Date()`) |
| user/data | usernames, payload content | parameterize via `source/data/` modules — the user pool is decrypted in `setup()` (never a `SharedArray`; decryption is async), payload bodies are TS builders interpolating a `runToken` |
| server-reported | sales-ai `tenantId`, app `version` | correlate at runtime (`tenantIdFromJwt()` / `fetchServerVersion()`) and throw on failure — never stored in config, never a stale fallback |
| environment | host / base URL | `source/config/env.config.ts` (`baseUrl` derived from `temp/setup.json`; `cryptoKey` from `temp/secret.json`) |

Correlated correctly = the script still works after every session-scoped value rotates (new login, new server version, new traceId).

## 3. Script

- Grep `source/` for each endpoint path — reuse existing wrappers before writing new ones.
- Auth chain already exists: `loginToMomentusAssistant` from `source/flows/login.flow.ts`.
- New endpoints get a thin wrapper in `source/apis/<feature>.api.ts`; add its `export *` line to the layer barrel (`source/utils/exports/apis.exp.ts`) and import through the per-folder barrels in the flow/test spec (the apis and exports rules auto-load when you edit those files).
- Decide the data-setup strategy before scripting the journey — whether the operation needs prerequisite records seeded out of band (via `source/seeds/`) or creates them inline. How provisioning and cleanup actually work (snapshot-owned cleanup, pure journeys with no `teardown()`, `setup()` pool discovery, per-VU record selection) is defined in the seed and tests rules, which auto-load when you edit those files.
- Pick the VU's user with `pickUser(users)` from `source/utils/helpers/users.helper.ts` (honors `USER_MODE`), not an inline `users[__VU % users.length]`.
- Write the journey body in `source/flows/<journey>.flow.ts` as one `<journey>Journey(user, data, ...)` function (login + numbered groups + checks + closing `sleep`), and export its per-endpoint SLAs as `<journey>Thresholds`; add the flow's `export *` line to `source/utils/exports/flows.exp.ts` (the flows and exports rules auto-load when you edit those files).
- Register the journey in the smoke gate: in `source/tests/smoke.spec.ts` add a k6 scenario entry (via the `once()` helper), its `exec` wrapper, and its `<journey>Thresholds` to the threshold map, extending `setup()` if the journey needs data the others don't. A journey not registered there is invisible to the smoke run and the `validate-payload-drift` skill.
- Unique per-iteration payloads: add a `source/data/` builder that interpolates a `runToken` (a TS function returning the payload, not an `open()`'d template). This gives **identity** uniqueness (a new id/token to correlate), not **structural** variety — every iteration still sends the same shape. So: assert on shape, never a fixed count or exploration-only value (`result.length > 0`, not `=== 1`; "field present", not its captured value). And if the flow's downstream genuinely branches on input content (e.g. an upload whose extraction count varies by file), one token-swapped builder won't exercise that — add representative variants to `source/data/`, since the run ladder only ever sends the exploration shape.

## 4. Verify — 3-step progressive run

Three pre-flight checks first (all zero traffic — they only parse/typecheck, never run VUs):

- `npx tsc --noEmit` — typecheck the `.ts` you generated (data builders, `source/`, test). k6 strips types at parse time, so `k6 inspect` never catches a type error — this is the only check that does.
- `k6 inspect source/tests/smoke.spec.ts` — fix until syntax/imports/options resolve clean and the journey's new k6 scenario entry resolves in the aggregate gate.

Then run the escalation:

| Step | Command | Proves |
|---|---|---|
| 1 | `k6 run -e SCENARIO=<journey> source/tests/smoke.spec.ts` | 1 VU / 1 iter — journey runs and correlates at all |
| 2 | `k6 run -e SCENARIO=<journey> -e VUS=2 -e ITERS=2 -e USER_MODE=single source/tests/smoke.spec.ts` | 2 VUs, 1 iter each, one shared login — concurrency + data isolation (shared list exposes wrong-row matching) |
| 3 | `k6 run -e SCENARIO=<journey> -e VUS=2 -e ITERS=2 -e USER_MODE=pool source/tests/smoke.spec.ts` | 2 VUs, 1 iter each, different logins — per-user data & correlation |

Loop rules:
- Run steps in order. Read each summary and confirm concrete signals, not just a green glance: `checks` = 100%, `http_req_failed` = 0, `dropped_iterations` = 0, no threshold crossed, no `WARN`/`ERRO`. (`dropped_iterations` > 0 means data/VU starvation even when every check passes.) A failed check usually means a missed correlation — re-check where the value really comes from.
- **Data isolation (when the journey creates data): a green run is not sufficient.** Confirm each VU matched its *own* `runToken`, not just that checks passed. Step 2 (`USER_MODE=single`) puts both VUs under one login, so a shared user/tenant list endpoint returns every VU's records at once — a poll/list wrapper that trusts list position (`opportunities[0]`) instead of matching the planted `runToken` (`find(o => o.email === myRunToken)`) can validate another VU's record while every check still passes. Treat a run that matched the wrong row as a failure, and fix the wrapper to match on the token.
- On failure: fix, then re-run. **If the fix touched correlation or shared/init state, re-run from step 1**, since it can regress the simpler case; otherwise re-run the failed step.
- Cap at ~2–3 fix attempts per step. If a step still fails, stop and surface it to the user rather than looping.
- Approval was given once upfront — don't re-prompt between steps.

All three green → the script is ready. Note this proves **correctness** (the journey runs, correlates, and isolates its data), not SLO compliance — no step runs the `load` profile, so thresholds aren't validated here. A real load run is a separate, user-initiated step.

## 5. Refactor check

With the script proven, do one final structural pass over the new `source/` files. The path-scoped rules auto-load for every file you touch here — fix anything that violates them. Apply improvements, then re-run `npx tsc --noEmit` and `k6 inspect` (and step 1 if behavior could have shifted).

Static hardcode scan — runtime can't catch a dynamic id accidentally pasted from exploration (a GUID, opportunity id, or bearer token) as long as that record still resolves in QE today; it'll pass all three steps and silently break later. Grep the new `source/` files for suspicious literals:

```bash
grep -rnE '[0-9a-f]{8}-[0-9a-f]{4}-|\b[0-9]{6,}\b|[0-9]+\|[0-9a-f]{16,}' source/
```

Any match that isn't a `config`/`__ENV` value is a correlation miss — extract it from a prior response instead.

## 6. Report

Summarize: requests scripted, lib modules created/reused, correlation decisions, the 3-step verification results, any refactors, and the run commands.
