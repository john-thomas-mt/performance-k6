---
name: generate-test
description: End-to-end — explore an app flow with playwright-cli, script it straight into a k6 test (no intermediate capture file), then verify with a 3-step progressive run. Use when the user wants to record/capture/script a flow or journey as a k6 performance test.
---

# Generate test — explore, script, verify in one pass

One continuous flow: drive the app, build an in-context correlation picture, write the k6 test directly, then prove it with a 3-step run escalation. No `temp/captures/*.md` artifact — script straight from what you observed.

**Exploration and scripting stay in the main conversation — never delegate exploration to a subagent.** They need the conversation's app knowledge and the correlation picture that scripting consumes, and the user must see step-by-step progress; a subagent starts cold and loses everything on interruption.

**Delegate the bulky, mechanical work** to keep the main context lean and off the expensive main model: repo **recon** and the final compliance **scan** go to `k6-authoring-analyst` (Sonnet, read-only), and **each verification run** goes to `k6-run-reporter` (Haiku) — both return conclusions, not file/log dumps. The steps below say where.

## Before starting

1. Confirm the target flow with the user if ambiguous (which page, which actions, which data).
2. **Tell the user before opening the browser** — exploration sends real traffic to the environment.
3. Get **approval once, upfront, for the whole sequence** (exploration + the three verification runs). With that approval, run all three steps and any re-runs without prompting again.
4. **Target `main` on PERF** — the unreleased, highest-priority env authoring always runs against, so the script is written for the newest schema and trickles down to released envs. A bare `npm run setup` writes exactly this (site `PERF`, env `main` are the defaults). Read `source/config/env.config.ts` for the app URL (`baseUrl`; the sales-ai `tenantId` is not stored — it's correlated at runtime). For **exploration** you need a live login: `source/data/creds/users.data.ts` ships usernames plaintext but passwords **AES-GCM-encrypted**, so decrypt the first user with the `temp/secret.json` passphrase (via `decrypt_users`) — you can't read a usable password straight from the file. The generated test draws from the full pool via `pick_user` (see §3).
5. `playwright-cli list` — if any session shows `[incompatible please re-open]`, `playwright-cli kill-all` first.
6. **Recon the repo first (delegated).** Dispatch `k6-authoring-analyst` with the flow description for an *authoring kit* — reusable wrappers/endpoints, the closest journey template and its group spine, the right `login_*` entry, the `SetupData` slice, and the barrel + `smoke.spec.ts` wiring points. It writes the full kit to `temp/recon-kit.md` and returns a short index; work from the index, and `grep temp/recon-kit.md` for a single slice (a wrapper signature, an insertion line) as you script — so the kit's bulk never sits in the main context. Read a `source/` file directly only when the kit is insufficient.

## 1. Explore & observe (in-context)

Ground rules:
- Global `playwright-cli` binary only — **never `npx playwright-cli`** (a second resolved version corrupts the session).
- Named session: `playwright-cli -s=perf <command>`.
- **Batch sequential commands into one Bash call** with `&&`.
- The app is a heavy SPA behind a VPN and never fires a clean load event, so the **first `open` will hit playwright-cli's ~60s nav timeout — expect that, don't retry blindly**. Give `open` a generous Bash timeout, then poll `snapshot` (or wait for the login-form/nav ref) to confirm it actually settled; only a *second* failed settle is a real blocker (check VPN).
- `resize 1920 1080` immediately after `open`.
- Every action prints a snapshot file path — Grep it for the element you need; explicit `snapshot` only when refs are stale.
- Auth is already scripted (`login_to_events` / `login_to_momentus_assistant`), so **don't spend exploration effort capturing or correlating the auth requests** — you only need the browser logged in to reach the new surface, then go straight to it. Log in through the UI once and `state-save temp/auth-state.json`; if you author several journeys in one session, keep that one warm session alive (don't `kill-all` between them) so the bootstrap + login is paid once. Reserve `state-load` for recovering *this* session after a crash, and only with a state you saved this session — a stale/old file hangs the SPA bootstrap ("Preparing Your Momentus Experience") instead of prompting re-login. Capture the auth requests via UI login only when scripting a genuinely new/unscripted auth path.

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
   Keep only dynamic/auth headers (authorization, version, x-nonce, wsid, content-type). **Keep raw bytes out of the main context** — redirect request/response bodies to `temp/captures/raw/` (or the scratchpad), then dissect them with `node scripts/inspect-capture.js <file> [value]`: it prints the envelope shape, the populated transport cells with their column names, and the correlation candidates (GUIDs, timestamps, row keys, tokens), and with a second arg finds every path a value appears at. Pull out only what you need; never print a full body or snapshot. This is the main lever on exploration's token cost.

Exclude static assets, analytics/telemetry, and repeated identical fetches.

Hold an in-context correlation table as you go — every dynamic value, what produces it, what consumes it. Pay special attention to IDs created mid-flow (an opportunity id returned by a create call, reused in detail/task URLs). When the correlation picture is clear, go straight to scripting — do **not** write a capture file.

## 2. Correlate

Classify every dynamic value:

| Classification | Meaning | Strategy |
|---|---|---|
| server-generated | first appears in a response | extract at runtime (regex/JSON path); never hardcode |
| client-generated | UUIDs, nonces, timestamps the browser made up | regenerate per request (`crypto.randomUUID()`, `new Date()`) |
| user/data | usernames, payload content | parameterize via `source/data/` modules — the user pool is decrypted in `setup()` (never a `SharedArray`; decryption is async), payload bodies are TS builders interpolating a `runToken` |
| server-reported | sales-ai `tenantId`, app `version` | correlate at runtime (`tenant_id_from_jwt()` / `fetch_server_version()`) and throw on failure — never stored in config, never a stale fallback |
| environment | host / base URL | `source/config/env.config.ts` (`baseUrl` derived from `temp/setup.json`; `cryptoKey` from `temp/secret.json`) |

Correlated correctly = the script still works after every session-scoped value rotates (new login, new server version, new traceId).

## 3. Script

- Grep `source/` for each endpoint path — reuse existing wrappers before writing new ones (the recon kit `temp/recon-kit.md` already lists these; `grep` it, don't re-read `source/`).
- Model a new builder on an existing captured-payload builder by reading its **shape** — the payload arrow plus one extracted `: TransportTable` builder head — and `grep` for the signature; never read the full column list into context. Never `Read` a `*.data.ts` without a `limit`: `Read` only the head (the payload arrow) and `grep` for the one block you need (a `TransportTable` head, a `SearchFilters` entry). A full read of a column-heavy builder is the single biggest avoidable main-context cost.
- Generate a large captured-payload builder with the committed generator rather than hand-transcribing columns (fewer tokens, no transcription drift): `node scripts/gen-payload-builder.js <capture> <spec.json>`, where the spec names the output path, export name, which JSON paths become `params` (parameterized args), which become `regenerate` expressions (client-side values like `` `${Date.now()}` ``), and an optional `extractTable` to lift a nested transport table into its own `: TransportTable` builder. Then review the generated file against the data rules.
- Auth chain already exists: `login_to_momentus_assistant` from `source/flows/login.flow.ts`.
- New endpoints get a thin wrapper in `source/apis/<feature>.api.ts`; add its `export *` line to the layer barrel (`source/utils/exports/apis.exp.ts`) and import through the per-folder barrels in the flow/test spec (the apis and exports rules auto-load when you edit those files).
- Decide the data-setup strategy before scripting the journey — whether the operation needs prerequisite records seeded out of band (via `source/seeds/`) or creates them inline. How provisioning and cleanup actually work (snapshot-owned cleanup, pure journeys with no `teardown()`, `setup()` pool discovery, per-VU record selection) is defined in the seed and tests rules, which auto-load when you edit those files.
- Pick the VU's user with `pick_user(users)` from `source/utils/helpers/users.helper.ts` (honors `USER_MODE`), not an inline `users[__VU % users.length]`.
- Write the journey body in `source/flows/<journey>.flow.ts` as one `<journey>Journey(user, data, ...)` function (login + numbered groups + checks + closing `sleep`), and export its per-endpoint SLAs as `<journey>Thresholds`; add the flow's `export *` line to `source/utils/exports/flows.exp.ts` (the flows and exports rules auto-load when you edit those files).
- Register the journey in the smoke gate: in `source/tests/smoke.spec.ts` add a k6 scenario entry (via the `once()` helper), its `exec` wrapper, and its `<journey>Thresholds` to the threshold map, extending `setup()` if the journey needs data the others don't. A journey not registered there is invisible to the smoke run and the `payload-drift` skill.
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

**Run each step via `k6-run-reporter`** — hand it the exact command, and when the journey creates data tell it so, so it checks per-VU token isolation. It returns a compact verdict (iterations > 0, `checks` %, `http_req_failed`, `dropped_iterations`, thresholds crossed, `WARN`/`ERRO`, and the per-VU created-record lines); act on that verdict instead of reading the full summary into the main context.

Loop rules:
- Run steps in order. These are the signals the reporter confirms — treat its verdict as the gate, never a green glance: `checks` = 100%, `http_req_failed` = 0, `dropped_iterations` = 0, `iterations` > 0, no threshold crossed, no `WARN`/`ERRO`. (`dropped_iterations` > 0 means data/VU starvation even when every check passes.) A failed check usually means a missed correlation — re-check where the value really comes from. But a write that returns 2xx with an error body (e.g. `Save2` with `ResultValue ≠ 0`) is a server-side *validation* failure, not a correlation miss: decode the full response body to find the controlling field before changing any inputs.
- **Data isolation (when the journey creates data): a green run is not sufficient.** Confirm each VU matched its *own* `runToken`, not just that checks passed. Step 2 (`USER_MODE=single`) puts both VUs under one login, so a shared user/tenant list endpoint returns every VU's records at once — a poll/list wrapper that trusts list position (`opportunities[0]`) instead of matching the planted `runToken` (`find(o => o.email === myRunToken)`) can validate another VU's record while every check still passes. Treat a run that matched the wrong row as a failure, and fix the wrapper to match on the token.
- On failure: fix, then re-run. **If the fix touched correlation or shared/init state, re-run from step 1**, since it can regress the simpler case; otherwise re-run the failed step.
- Cap at ~2–3 fix attempts per step. If a step still fails, stop and surface it to the user rather than looping.
- Approval was given once upfront — don't re-prompt between steps.

All three green → the script is ready. Note this proves **correctness** (the journey runs, correlates, and isolates its data), not SLO compliance — no step runs the `load` profile, so thresholds aren't validated here. A real load run is a separate, user-initiated step.

## 5. Refactor check

With the script proven, do one final compliance pass — but **delegate the reading to `k6-authoring-analyst`**: give it the list of new `source/` files and have it (a) run the hardcoded-value scan (GUIDs, record ids, bearer tokens, and any exploration literal you name) and (b) check the files against `.claude/rules`. Runtime can't catch a dynamic id pasted from exploration — it still resolves today, passes all three steps, and breaks silently later — so this scan is the safety net.

Apply the fixes it reports in the main loop (the analyst is read-only; the path-scoped rules auto-load as you edit), then re-run `npx tsc --noEmit`, `k6 inspect`, and step 1 if behavior could have shifted. A scan hit that isn't a `config`/`__ENV` value is a correlation miss — extract it from a prior response instead of hardcoding.

## 6. Report

Summarize: requests scripted, lib modules created/reused, correlation decisions, the 3-step verification results, any refactors, and the run commands.

## 7. Trickle down (optional)

The 3-step run proves the journey on `main` only. To prove it trickles down to the released envs, offer to hand off to `verify-envs` — targeting **the journey just authored** (pass its scenario name automatically; don't make the user restate it) — which runs that journey once per env in the `ReleaseVersion` matrix and triages any cross-version drift. Don't fold that sweep into this skill; it's a separate, user-approved traffic run.
