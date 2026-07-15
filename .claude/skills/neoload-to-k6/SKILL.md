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
5. **Recon the k6 repo (delegated).** Dispatch `k6-authoring-analyst` for an *authoring kit* — reusable wrappers/endpoints, the closest existing journey template, the right `login_*` entry, the `SetupData` slice, and the barrel + `smoke.spec.ts` wiring points. It writes the full kit to `temp/recon-kit.md` and returns a short index; work from the index and `grep temp/recon-kit.md` for specifics, so the repo-side reuse picture stays out of the main context (the NeoLoad tree, §1, is still parsed in the loop — it's the source of truth the analyst doesn't have). Ask the analyst to put in the kit the **exact skeleton of the closest payload builder** (its `TransportTable` column list and which cells are parameterized) and the **signatures of the wrappers to reuse or mirror** — not just `file:line` pointers. Authoring from those skeletons avoids re-reading large analog modules (a 500-line `document.data.ts`, a full `<feature>.api.ts`) into the main context, which is the real token cost.

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

# dissect a pulled JSON body (shape + populated transport cells + correlation candidates)
node scripts/inspect-capture.js /tmp/x/recorded-requests/req_1.txt.json
```

The helper scripts (`inspect-capture.js`, `gen-payload-builder.js`, `gen-fidelity-lists.js`) live at **repo-root `scripts/`** — run them from the repo root as shown, not from the skill folder.

**Dissect and generate from the ZIP body, not the VU xml.** The `<textPostContent>` body inside a `<request>.xml` is *templated* — it carries `${…}` correlation tokens, so it is **not valid JSON** and `inspect-capture.js` / `gen-payload-builder.js` will throw on the leading `$`. The recorded-artifacts `req_*.txt` body has the **resolved real values** (valid JSON) — feed *that* to the tools, and read the VU xml only for the `<variable-extractor>` list and which cells are `${…}` tokens (that mapping is the input to the gen spec's `params`/`regenerate`). If you must parse an xml body directly (before a zip exists), scrub the tokens to placeholders in one pass first — replace `"?${…}"?` (optional surrounding quotes) with a single quoted placeholder — or the parse fails. Reaching for the xml body and hand-writing scrub/dump scripts instead of using the zip is the main avoidable token sink in this workflow.

## 2. Distill to the transaction spine

A NeoLoad recording captures **everything the browser did**. Keep only the functional server calls; drop the rest (the *why* — static-content vs application/API roles, why replay over-states asset load, and the Momentus same-origin/no-CDN caveat — is in [docs/conversion-strategy-and-roadmap.md](../../../docs/conversion-strategy-and-roadmap.md), "Filtering a recording down to the transaction spine"):

- **Drop** static assets (css/js/html/fonts/images), telemetry (`/v1/traces`, analytics), and pure UI chrome (menu/column-cache/window-info/recently-used/grid-view reads that only paint the UI).
- **Keep** the writes (the `Save2`/create/update calls) and the reads whose extracted values **feed a later write**.
- **The `<variable-extractor>` blocks tell you which reads are load-bearing.** A read whose `C_…` extract is consumed by a downstream request stays; a read nothing consumes is chrome. (A 100-call recording is often ~10–15 functional calls.)
- **Reads between writes can be load-bearing, not chrome** — e.g. a detail re-read that refreshes an optimistic-concurrency token (see §4). Don't drop a read just because it looks like a repaint; check whether a write consumes its extract.
- **Dropped ≠ gone.** What you drop here (static assets + UI chrome) can be replayed as **optional additive fidelity tiers** (`-e FIDELITY=ui|full`) for a lean-vs-browser-realistic comparison — a pass *after* the spine is green (see §4a and `rules/fidelity.md`).

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

- **Reuse existing wrappers first** — the recon digest lists them; confirm against `source/` rather than re-reading. Momentus journeys share a lot (login, search, open-detail, the `Save2` envelope), so often the recording's login and several reads/writes already exist as wrappers and only the genuinely new operations need scripting.
- New endpoints get a thin wrapper in `source/apis/<feature>.api.ts`; new payloads a builder in `source/data/payloads/<feature>/`. The path-scoped rules (`apis`, `flows`, `data`, `scripting`, `exports`, `tests`) auto-load when you edit those files — follow them; don't re-derive conventions here.
- **Upload steps: bring the fixture, then match the recording's upload encoding.** An upload journey needs its file bytes copied from `custom-resources/` (§1) into `source/data/uploads/<feature>/` and `open()`-ed (binary mode, `'b'`) in the spec init context (per the data/tests rules). **Check the recorded request's `content-type` to pick the shape — Momentus has two, and they are not interchangeable:**
  - **Momentus core (`GenericServer/CacheFiles`) is base64-JSON, not multipart** (`content-type: application/json`) — the file bytes are `b64encode`-d inside a JSON array. Reuse `cache_document_file` (it base64-encodes the opened `ArrayBuffer` and posts `CacheFiles`); it returns the server-allocated `FileKey` to correlate into the document `Save2`. Do **not** wrap this in `http.file()`.
  - **True `multipart/form-data`** (e.g. the sales-ai file upload) uses a real `http.file(content, name, mime)` payload. Only here do you restore multipart — and do **not** reproduce NeoLoad's raw-body multipart workaround (its as-code YAML can't do binary multipart, so the recording fakes it); the k6 port sends the real upload.
- Port each step's `sla_profile="…SLA"` into the journey's `<journey>Thresholds` using the real latency targets from `sla_profiles/*.xml` (§1), not guessed values.
- **Decide the prerequisite-data strategy before scripting the journey** (mirrors `generate-test` §3). If the journey has a paired `@u*` *data-script* VU (found via its test-data population, §1), that VU **creates** the records the journey reads — recognizable by `errorPolicy="STOP_AND_START"`, no SLA profile, `MODE_NO_PACING`/zero think-time, and a tail `DataWrite_*` js-action. Port its create-spine (the numbered create steps plus any `loop.xml` for bulk volume) into `source/seeds/<feature>.seed.ts` reusing existing api wrappers — a **separate seed pass**, not folded into the journey. Replace NeoLoad's `DataWrite`→`.txt`→`<variable-file>` handoff with the repo's seed-marker discovery (the journey finds its own rows at runtime); never replay the captured keys. The seeds rule auto-loads when you edit `source/seeds/`.
- **Large captured payloads: generate, don't transcribe.** Extract the concrete body from the request zip, then emit the builder with `node scripts/gen-payload-builder.js <capture> <spec.json>` (the spec maps runtime-varying cells to `params`, client-side values to `regenerate`, and lifts each transport table via `extractTable`) rather than hand-transcribing or hoisting the body to a shared constant. The generated builder must weave each runtime-varying cell in at its position (in a columnar transport table, the numeric `Values` key matching the column's `ColumnID`). Re-correlate per-record identity fields the same way — weave the runtime `source` value into its cell, not a post-build mutation — and lift each transport table into its own module-level `: TransportTable` builder the payload plugs in. This mirrors the repo's `copy-form`/`save` builders and the "regenerate/diff-verify, don't hand-edit" convention.
- **Override every per-record identity field** from the correlated row (order nbr, account, event id, search key). A captured unique key left in place makes the server reject or mis-target the save.
- **Optimistic-concurrency tokens are load-bearing echo fields.** A header/record save often carries the row's last-update timestamp; the server rejects the save (`PrimaryKeyRecordChanged`) unless it matches the row's **current** value. Correlate it from the open-detail response and thread it into the save — do not replay the captured stamp. If a builder *omits* the timestamp columns it sidesteps the check (some do); if it *includes* them, you must correlate them.
- **Chain the token across sequential saves.** Each save bumps the row's timestamp, so re-read detail (or read it from the prior save's response, which returns the refreshed row) before the next header save.
- **Data isolation is stricter for record-modifying journeys.** An add-only journey tolerates two iterations sharing a seeded row; a header-modifying journey does not — the concurrency check turns a shared row into a failure. Give each iteration a **globally-unique** row (`exec.scenario.iterationInTest % pool.length`), not the `(__VU-1+__ITER)` formula (which collides across VU/iter pairs). Don't infer isolation from the recording: NeoLoad's data-script files are `global` scope with `CYCLE_VALUES`, which per the docs *shares rows across VUs and recycles them once exhausted* — only NeoLoad's `Unique` scope reserved a row per VU — so the port must impose uniqueness in k6, not trust the ported policy.
- Pick the VU's user with `pick_user` and register the journey in `smoke.spec.ts` (scenario + `exec` wrapper + `<journey>Thresholds`), per the tests rule.

## 4a. Fidelity tiers — optional, additive (only if the user wants lean-vs-full)

Beyond the spine, the recording's UI-chrome and static requests replay as env-gated tiers so a run can
compare lean vs. browser-realistic load. Do this only after the spine (§4) is green, and only if the user
asks for it.

- Generate the lists from the tree: `node scripts/gen-fidelity-lists.js "<VU tree>" source/data/chrome/<journey>.chrome.ts source/data/static/<journey>.static.ts` (do-not-hand-edit; regenerate on re-record).
- Before generating, confirm the journey's **write/upload spine endpoints are in the generator's `SPINE` exclusion** (e.g. `GenericServer/CacheFiles`). A spine endpoint missing from that list leaks into the chrome tier and double-fires — and a captured upload body is a huge base64 blob. Add it to `SPINE` (it's a correct general fix) and regenerate.
- A chrome request whose body **echoes a full selected grid row** (`USIDataGridServer/GetControlInfo`, carrying `ROW*_` tokens) cannot be resolved from spine correlation without extracting the whole row — it is pure grid-control paint. Add it to the generator's `UNREPRODUCIBLE` exclusion and prune it, rather than chase 20+ per-column subs; note the prune in the report (no silent caps).
- Wire the flow to fire each step's slice behind the `include_ui` / `include_static` gates alongside that
  step's spine call, and correlate the requests' `${…}` tokens through a subs map built from the
  correlation the spine already extracts.
- The conventions — what the generator normalises (query strings, Base64 bodies, kept tokens, excluded
  spine dups, pruned stale endpoints), the substitute-or-skip contract, building the subs map, coarse
  tolerant tagging, think-time — live in `rules/fidelity.md`, which auto-loads when you edit the
  chrome/static/helper files. Don't re-derive them here.
- Verify with a `-e FIDELITY=full` run (§5): `http_req_failed` must stay 0 and no request may be skipped
  for an unresolved token. A chrome request that needs a response-derived value the spine doesn't produce
  gets its own gated wrapper (per the rule), not a blanked token.

## 5. Verify — 3-step progressive run

Pre-flight (zero traffic): `npx tsc --noEmit`, then `k6 inspect source/tests/smoke.spec.ts`.

Then the same escalation as `generate-test` §4:

| Step | Command | Proves |
|---|---|---|
| 1 | `k6 run -e SCENARIO=<journey> source/tests/smoke.spec.ts` | runs & correlates (1 VU / 1 iter) |
| 2 | `… -e VUS=2 -e ITERS=2 -e USER_MODE=single …` | concurrency, one shared login |
| 3 | `… -e VUS=2 -e ITERS=2 -e USER_MODE=pool …` | per-user correlation & data isolation |

Run each step via `k6-run-reporter` (hand it the exact command, and note the journey creates/modifies data so it checks per-VU token isolation); act on its verdict — `checks` 100%, `http_req_failed` 0, `dropped_iterations` 0, `iterations` > 0 — rather than reading the full summary. It saves each run's log under `temp/` for the response-body decode below.

**Decode the response before changing inputs.** A `Save2` frequently returns **HTTP 201 with `ResultValue ≠ 0`** — a server-side *validation* failure, not a transport error. The body's `MessageInfoList[].MessageKey` names the exact problem (`OrderDateGreaterThan30Days`, `PrimaryKeyRecordChanged`, a search-key clash, …). Log the body on failure and read it — never guess-and-iterate on inputs. `MessageMode: 2` is a confirmation prompt ("do you wish to proceed?"), not a hard reject; keep the input inside the allowed range rather than replaying an out-of-range captured value.

Loop rules (per `generate-test`): fix, re-run; if the fix touched correlation/shared state, re-run from step 1; cap at ~2–3 attempts per step, then surface to the user. A `p(95)` latency threshold crossing under 2-VU load is a performance observation, not a correctness failure — the ladder proves correctness, not SLO.

**Targeted live fallback:** if a step fails and decoding points to drift (the recorded shape no longer matches the current app), drive just that one request with `playwright-cli` to see the current traffic — not a full re-record (expect the first `open` to hit the SPA nav timeout — poll `snapshot` rather than retrying; see `generate-test` §1).

## 6. Refactor & report

Final structural pass against the auto-loaded rules. Delegate the compliance scan to `k6-authoring-analyst` (as in `generate-test` §5) over the new `source/` files — but tell it the embedded payload constants **intentionally** contain captured values (the embed-and-override pattern), so the hardcoded-value scan targets the **flow/wrapper logic**, which must carry no hardcoded dynamic ids. Apply its findings in the loop.

Report: NeoLoad steps ported vs dropped-as-chrome, wrappers reused vs created, correlation decisions (and any NeoLoad smells corrected), the 3-step results, and the run commands.

The 3-step run proves the journey on `main` only. NeoLoad re-recorded per version precisely because it couldn't parameterize this; k6 can. Offer to hand off to `verify-envs` — targeting **the journey just ported** (pass its scenario name automatically; don't make the user restate it) — to prove the port trickles down across the `ReleaseVersion` matrix and surface any cross-version drift. A separate, user-approved traffic run, not part of this skill.
