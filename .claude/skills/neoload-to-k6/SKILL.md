---
name: neoload-to-k6
description: Convert an existing NeoLoad virtual-user script into a k6 journey — parse the on-disk NeoLoad tree, distill the transaction spine, correlate from NeoLoad's own extractors, script into source/ wrappers + a flow, then verify with the 3-step progressive run. Use when the user wants to port/migrate/convert a NeoLoad script (.nlp project, a `team/vus/<name>` folder) to k6.
---

# NeoLoad → k6 — convert a recorded VU into a k6 journey

One continuous pass: read the NeoLoad script as the **source of truth** (the traffic is already recorded and already correlated), distill it to the transaction spine, translate NeoLoad's correlation into k6, script straight into `source/` wrappers + a `source/flows/` journey wired into `source/tests/smoke.spec.ts`, then prove it with the same 3-step run escalation `generate-test` uses.

**Static-first, live-on-demand.** Unlike `generate-test` (which drives the live app), the correlation picture here comes from parsing the NeoLoad tree — no browser. The 3-step verify run is the live checkpoint. Only drop into `playwright-cli` for a *targeted* look when a verify step fails and the recording has drifted (see §5). Never re-record the whole flow — that throws away the recording's solved correlation and turns this into `generate-test`.

**Run this in the main conversation.** It needs the repo's existing endpoint wrappers in context, and the user must see step-by-step progress.

## Before starting

1. Locate the NeoLoad VU. A decoded on-disk project has `team/vus/<VU name>/` (a folder) plus a sibling `<VU name>.xml` (the VU definition). Filenames are URL-encoded: `#2F`=`/`, `#2E`=`.`, `@` prefixes a word. `#2826#2E2#29` = `(26.2)`.
2. Confirm the target flow and scope with the user — a recorded VU can be 100+ requests; agree on which operations to port.
3. **Target `main` on PERF** — port against the unreleased, highest-priority env so the port matches the newest schema and trickles down to released envs. A bare `npm run setup` writes exactly this (site `PERF`, env `main` are the defaults). Read `source/config/env.config.ts` for the target env, and check `temp/setup.json`/`temp/secret.json` exist (the run prerequisites).
4. **Get approval once, upfront, for the 3-step verification run sequence** — that is the only traffic this skill sends (parsing the tree sends none). This journey may **write** (each `Save2` mutates data); the DB snapshot reset owns cleanup, so journeys stay pure (no `teardown()`).

## 1. Parse the NeoLoad tree (zero traffic)

The tree, top down:

- **`<VU>.xml`** — the `<actions-container>` lists `<weighted-embedded-action uid=…>` in **execution order**. This, not the folder listing, is the true step order.
- **`actions-container/<step>.xml`** — a `basic-logical-action-container` naming the step and listing its child request UIDs in order. Step names read like the user journey (`_02_login`, `_06_edit_general`, …).
- **`actions-container/<step>/<request>.xml`** — each `http-action` carries everything: `method`, `path` (`/${P_Performance_Sites.version_26_2}/api/…`), every `<header>`, the request body in `<textPostContent><![CDATA[…]]>`, and — the gift — `<variable-extractor>` blocks (NeoLoad's solved correlation: name, `regExp`/`jsonpath`, source).
- **`%resources%/recorded-artifacts/<uid>.zip`** — `recorded-requests/req_*.txt` (raw HTTP request with **real captured values**), `recorded-responses/res_*` (the response), and a screenshot. Use these to embed concrete payloads and to inspect responses without a live run.
- **`%resources%/scripts/jsAction_*.js`** — custom JS (random data selection, date generation) → translate to a k6 data builder / helper.
- **`team/variables/`** — project variables. `${P_…}` = project data (hosts, versions, data-file columns, credential pools); `${C_…}` = correlated (extracted at runtime).
- **`team/populations/@population_@test@data_@t<NN>…`** — the **seed↔journey map**, and the reason a journey may need out-of-band setup. Its `<description>` names the journey (`T08_InvoiceEvents`) and its `<split virtualUserUid>` names the `@u<NN>_@data@script_…` VU that provisions it — the authoritative pairing (VU-name matching alone is unreliable: a journey often reads a differently-named consumption file than the one its seed writes). These run in a dedicated *Test Data Preparation* scenario (`team/scenarios/@scn_@test@data_*`), separate from the load run — so the seed is a **separate pass**, not a step inside the journey.

Three project-root folders (siblings of `team/`) hold data the steps only reference **by name** — the VU tree gives the reference, these give the thing:

- **`custom-resources/`** — the actual **upload fixtures** a step sends (e.g. `P_RoomDiagramFiles/{light,medium,heavy}/*.dwg|*.pdf` for `T31`); the VU references them by a `${P_…}` file variable, but the bytes live here, not in `vus/`. Copy the ones a ported journey needs into `source/data/uploads/<feature>/` (see §4).
- **`variables/version_<ver>/*.txt`** — the concrete **values** behind the `team/variables/*.xml` defs: real column layout and sample rows (e.g. `P_26_2_DataScript_VoucherProcessing.txt` → column `supplierName`). The extractor names the variable; this gives the shape/values to embed in a `source/data/` builder or match as a seed marker, and exposes seed→journey file chaining (the seed writes one file, the journey reads another).
- **`sla_profiles/*.xml`** — the actual **latency targets** behind each step's `sla_profile="…SLA"` name; port these numbers into the journey's `<journey>Thresholds` (§4) instead of guessing.

Useful commands (adapt paths; use `node -e`, not `jq`/`python`):

```bash
# journey step order + names
cat "team/vus/<VU>.xml"                 # weighted-embedded-action order
ls "team/vus/<VU>/actions-container"    # step folders + think-times

# dump transactional requests across the journey (method/path/extractors/body),
# filtering asset + telemetry noise — write a small node walker over the step folders
# (match method= and path=, skip .css/.js/.html/.ico, print <variable-extractor name=…>)

# pull a concrete request body from its zip (real values, valid JSON)
unzip -o "team/vus/<VU>/%resources%/recorded-artifacts/<uid>.zip" -d /tmp/x
#   req_*.txt is a raw HTTP request: body is after the first blank line
```

## 2. Distill to the transaction spine

A NeoLoad recording captures **everything the browser did**. Keep only the functional server calls; drop the rest (the *why* — static-content vs application/API roles, why replay over-states asset load, and the Momentus same-origin/no-CDN caveat — is in [docs/conversion-strategy-and-roadmap.md](../../../docs/conversion-strategy-and-roadmap.md), "Filtering a recording down to the transaction spine"):

- **Drop** static assets (css/js/html/fonts/images), telemetry (`/v1/traces`, analytics), and pure UI chrome (menu/column-cache/window-info/recently-used/grid-view reads that only paint the UI).
- **Keep** the writes (the `Save2`/create/update calls) and the reads whose extracted values **feed a later write**.
- **The `<variable-extractor>` blocks tell you which reads are load-bearing.** A read whose `C_…` extract is consumed by a downstream request stays; a read nothing consumes is chrome. (A 100-call recording is often ~10–15 functional calls.)
- **Reads between writes can be load-bearing, not chrome** — e.g. a detail re-read that refreshes an optimistic-concurrency token (see §4). Don't drop a read just because it looks like a repaint; check whether a write consumes its extract.

## 3. Correlate — translate NeoLoad's extractors, don't re-derive

NeoLoad already solved correlation; translate it. Classify each dynamic value (same scheme as `generate-test` §2):

| NeoLoad form | Meaning | k6 strategy |
|---|---|---|
| `${C_…}` with a `<variable-extractor>` | server-generated, extracted from a prior response | extract at runtime (parse the response by **column name**, not the captured positional index — layouts drift) |
| `${P_…}` project variable (host/version) | environment | `source/config/env.config.ts` |
| `${P_…}` data-file column / credential pool | user/data | `source/data/` builder / the encrypted user pool |
| client-generated (uuid, nonce, timestamp) | made up by the browser | regenerate per request (`crypto.randomUUID()`, `Date.now()`) |

**Watch for NeoLoad smells — a recorded value that looks correlated but isn't.** A server-allocated id (e.g. an upload `FileKey`) can be left **hardcoded** in one request even though a later request correlates it, because the server round-trips the stale value within the recording session. On a fresh k6 run that stale id is wrong. Find the value's true runtime source (the response that first mints it) and correlate from there.

## 4. Script — reuse first, embed captured payloads, override identity

- **Grep `source/` for each endpoint path first — reuse existing wrappers.** Momentus journeys share a lot (login, search, open-detail, the `Save2` envelope). Often the recording's login and several reads/writes already exist as wrappers; only the genuinely new operations need scripting.
- New endpoints get a thin wrapper in `source/apis/<feature>.api.ts`; new payloads a builder in `source/data/payloads/<feature>/`. The path-scoped rules (`apis`, `flows`, `data`, `scripting`, `exports`, `tests`) auto-load when you edit those files — follow them; don't re-derive conventions here.
- **Upload steps: bring the fixture, restore real multipart.** An upload journey needs its file bytes copied from `custom-resources/` (§1) into `source/data/uploads/<feature>/` and `open()`-ed in the spec init context (per the data/tests rules). Script the real `http.file()` multipart — do **not** reproduce NeoLoad's raw-body multipart workaround (its as-code YAML can't do binary multipart, so the recording fakes it); the k6 port restores the real upload.
- Port each step's `sla_profile="…SLA"` into the journey's `<journey>Thresholds` using the real latency targets from `sla_profiles/*.xml` (§1), not guessed values.
- **Decide the prerequisite-data strategy before scripting the journey** (mirrors `generate-test` §3). If the journey has a paired `@u*` *data-script* VU (found via its test-data population, §1), that VU **creates** the records the journey reads — recognizable by `errorPolicy="STOP_AND_START"`, no SLA profile, `MODE_NO_PACING`/zero think-time, and a tail `DataWrite_*` js-action. Port its create-spine (the numbered create steps plus any `loop.xml` for bulk volume) into `source/seeds/<feature>.seed.ts` reusing existing api wrappers — a **separate seed pass**, not folded into the journey. Replace NeoLoad's `DataWrite`→`.txt`→`<variable-file>` handoff with the repo's seed-marker discovery (the journey finds its own rows at runtime); never replay the captured keys. The seeds rule auto-loads when you edit `source/seeds/`.
- **Large captured payloads: generate, don't transcribe.** Extract the concrete body from the request zip and build it as a single self-contained object literal *inside* the `source/data/payloads/` builder — weave each runtime-varying cell in at its position (in a columnar transport table, the numeric `Values` key matching the column's `ColumnID`), rather than hand-transcribing or hoisting the body to a shared constant. Re-correlate per-record identity fields the same way — weave the runtime `source` value into its cell, not a post-build mutation — and lift each transport table into its own module-level `: TransportTable` builder the payload plugs in. This mirrors the repo's `copy-form`/`save` builders and the "regenerate/diff-verify, don't hand-edit" convention.
- **Override every per-record identity field** from the correlated row (order nbr, account, event id, search key). A captured unique key left in place makes the server reject or mis-target the save.
- **Optimistic-concurrency tokens are load-bearing echo fields.** A header/record save often carries the row's last-update timestamp; the server rejects the save (`PrimaryKeyRecordChanged`) unless it matches the row's **current** value. Correlate it from the open-detail response and thread it into the save — do not replay the captured stamp. If a builder *omits* the timestamp columns it sidesteps the check (some do); if it *includes* them, you must correlate them.
- **Chain the token across sequential saves.** Each save bumps the row's timestamp, so re-read detail (or read it from the prior save's response, which returns the refreshed row) before the next header save.
- **Data isolation is stricter for record-modifying journeys.** An add-only journey tolerates two iterations sharing a seeded row; a header-modifying journey does not — the concurrency check turns a shared row into a failure. Give each iteration a **globally-unique** row (`exec.scenario.iterationInTest % pool.length`), not the `(__VU-1+__ITER)` formula (which collides across VU/iter pairs). Don't infer isolation from the recording: NeoLoad's data-script files are `global` scope with `CYCLE_VALUES`, which per the docs *shares rows across VUs and recycles them once exhausted* — only NeoLoad's `Unique` scope reserved a row per VU — so the port must impose uniqueness in k6, not trust the ported policy.
- Pick the VU's user with `pick_user` and register the journey in `smoke.spec.ts` (scenario + `exec` wrapper + `<journey>Thresholds`), per the tests rule.

## 5. Verify — 3-step progressive run

Pre-flight (zero traffic): `npx tsc --noEmit`, then `k6 inspect source/tests/smoke.spec.ts`.

Then the same escalation as `generate-test` §4:

| Step | Command | Proves |
|---|---|---|
| 1 | `k6 run -e SCENARIO=<journey> source/tests/smoke.spec.ts` | runs & correlates (1 VU / 1 iter) |
| 2 | `… -e VUS=2 -e ITERS=2 -e USER_MODE=single …` | concurrency, one shared login |
| 3 | `… -e VUS=2 -e ITERS=2 -e USER_MODE=pool …` | per-user correlation & data isolation |

Read the summary for concrete signals: `checks` 100%, `http_req_failed` 0, `dropped_iterations` 0.

**Decode the response before changing inputs.** A `Save2` frequently returns **HTTP 201 with `ResultValue ≠ 0`** — a server-side *validation* failure, not a transport error. The body's `MessageInfoList[].MessageKey` names the exact problem (`OrderDateGreaterThan30Days`, `PrimaryKeyRecordChanged`, a search-key clash, …). Log the body on failure and read it — never guess-and-iterate on inputs. `MessageMode: 2` is a confirmation prompt ("do you wish to proceed?"), not a hard reject; keep the input inside the allowed range rather than replaying an out-of-range captured value.

Loop rules (per `generate-test`): fix, re-run; if the fix touched correlation/shared state, re-run from step 1; cap at ~2–3 attempts per step, then surface to the user. A `p(95)` latency threshold crossing under 2-VU load is a performance observation, not a correctness failure — the ladder proves correctness, not SLO.

**Targeted live fallback:** if a step fails and decoding points to drift (the recorded shape no longer matches the current app), drive just that one request with `playwright-cli` to see the current traffic — not a full re-record.

## 6. Refactor & report

Final structural pass against the auto-loaded rules. Then the static hardcode scan from `generate-test` §5 — but note the embedded payload constants **intentionally** contain captured values (that's the embed-and-override pattern); the scan targets the **flow/wrapper logic**, which must carry no hardcoded dynamic ids.

Report: NeoLoad steps ported vs dropped-as-chrome, wrappers reused vs created, correlation decisions (and any NeoLoad smells corrected), the 3-step results, and the run commands.

The 3-step run proves the journey on `main` only. NeoLoad re-recorded per version precisely because it couldn't parameterize this; k6 can. Offer to hand off to `verify-envs` — targeting **the journey just ported** (pass its scenario name automatically; don't make the user restate it) — to prove the port trickles down across the `ReleaseVersion` matrix and surface any cross-version drift. A separate, user-approved traffic run, not part of this skill.
