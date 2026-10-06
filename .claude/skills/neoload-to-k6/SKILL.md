---
name: neoload-to-k6
description: Convert an existing NeoLoad virtual-user script into a k6 journey — parse the on-disk NeoLoad tree, distill the transaction spine, correlate from NeoLoad's own extractors, script into source/ wrappers + a flow with its fidelity tiers, then verify with the 3-step progressive run at full fidelity. Use when the user wants to port/migrate/convert a NeoLoad script (.nlp project, a `team/vus/<name>` folder) to k6.
---

# NeoLoad → k6 — convert a recorded VU into a k6 journey

One continuous pass: read the NeoLoad script as the **source of truth** (the traffic is already recorded and already correlated), distill it to the transaction spine, translate NeoLoad's correlation into k6, script straight into `source/` wrappers + a `source/flows/` journey wired into `source/tests/smoke.spec.ts`, then prove it with the same 3-step run escalation `generate-test` uses.

**Static-first, live-on-demand.** Unlike `generate-test` (which drives the live app), the correlation picture here comes from parsing the NeoLoad tree — no browser. The 3-step verify run is the live checkpoint. Only drop into `playwright-cli` for a *targeted* look when a verify step fails and the recording has drifted (see §5). Never re-record the whole flow — that throws away the recording's solved correlation and turns this into `generate-test`.

**Run this in the main conversation.** It needs the repo's existing endpoint wrappers in context, and the user must see step-by-step progress.

## Before starting

1. Locate the NeoLoad VU. A decoded on-disk project has `team/vus/<VU name>/` (a folder) plus a sibling `<VU name>.xml` (the VU definition). Filenames are URL-encoded: `#2F`=`/`, `#2E`=`.`, `@` prefixes a word. `#2826#2E2#29` = `(26.2)`.
2. Confirm the target flow and scope with the user — a recorded VU can be 100+ requests; agree on which operations to port.
3. **Target `main` on PERF** — port against the unreleased, highest-priority env so the port matches the newest schema and trickles down to released envs. A bare `npm run setup` writes exactly this (site `PERF`, env `main` are the defaults). Read `source/config/env.config.ts` for the target env, and check `temp/setup.json`/`temp/secret.json` exist (the run prerequisites).
4. **Tell the user upfront that the 3-step verification run sequence will run (always at `-e FIDELITY=full`, see §5)** — it is mandatory, so there is no approval prompt and no choice to offer; just state it and proceed. It is the only traffic this skill sends (parsing the tree sends none), together with a small seed run before it when the port adds or changes a seed (§5 step 0); name that run upfront too. This journey may **write** (each `Save2` mutates data); the DB snapshot reset owns cleanup, so journeys stay pure (no `teardown()`).
5. **Recon the k6 repo (delegated).** Dispatch `k6-authoring-analyst` for an *authoring kit* — reusable wrappers/endpoints, the closest existing journey template, the right `login_*` entry, the `SetupData` slice, and the barrel + `smoke.spec.ts` wiring points. It writes the full kit to `temp/claude/docs/recon-kit.md` and returns a short index; work from the index and `grep temp/claude/docs/recon-kit.md` for specifics, so the repo-side reuse picture stays out of the main context (the NeoLoad tree, §1, is distilled by `neoload-digest.cjs` — the analyst doesn't have it). Require the kit to be **self-sufficient to author from** — so demand, not just `file:line` pointers:
   - the **exact signature** of every wrapper to reuse or mirror (name + param list + return shape);
   - the **full payload-arrow skeleton** of the closest builder — its positional envelope, its `TransportTable` column list, and exactly which cells are parameterized vs captured constants;
   - the **exact `smoke.spec.ts` insertion lines** (scenario entry, threshold-map entry, `exec` wrapper, seed-pool gate) and the barrel `export *` lines;
   - **which `source/data/pools/` modules already exist** (a pool ported for an earlier journey is reused, not regenerated) — pass the analyst the pool names from the §1 digest;
   - the **seed decision** — pass the analyst the paired data-script VU name from the §1 digest and have it report whether an equivalent `source/seeds/<feature>.seed.ts` **already exists** (reuse it — the journey discovers its pool in `setup()` via the existing marker) or a new seed pass must be ported. A recorded journey's data-script often maps to a seed already in the repo, so this is the difference between reusing one line of `setup()` wiring and porting a whole create-spine. "Equivalent" means it leaves the data that data script leaves, not that it creates the same kind of record; the §6 coverage gate checks it.

   Then **author from the kit alone — do not reopen the analog `source/` modules it summarizes.** If a detail you need is missing, ask the analyst to extend the kit (a cheap sub-agent round-trip) rather than reading the 300–500-line module (`<feature>.api.ts`, a big `*.data.ts`) into the main context yourself. Re-reading model files the kit already covered is the second-biggest main-context token sink, after hand-dumping the tree (§1).

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
- **`variables/version_<ver>/*.txt`** — the concrete **values** behind the `team/variables/*.xml` defs, i.e. the journey's **data pools**: the delimited rows a `<variable-file>` cycles through (e.g. `P_26_2_BE_SpaceCode.txt` → 824 rows of column `spaceCodes`). A VU tree only ever *names* its variables, so a pool is invisible until you resolve the definition — and a `<variable-list>` def stores its rows as a **Base64 Java blob inline in the XML**, invisible to grep as well. The digest resolves both forms for you (see below); port each pool **complete** to `source/data/pools/` with `gen-pool.cjs` per §4. This also exposes seed→journey file chaining (the seed writes one file, the journey reads another).
- **`sla_profiles/*.xml`**: the two shared SLA profiles (`UserPath_Transactions` avg > 4 s, `Report` avg > 20 s) that each step opts into with `slaProfileName` + `slaProfileEnabled`. They are not per-transaction targets. The thresholds rule (§4) says how to port them.

**Parse the whole tree in one pass with the digest script** (zero traffic, deterministic):

```bash
node .claude/scripts/neoload-digest.cjs "team/vus/<VU>"
```

It prints one compact digest: step order, the transaction **spine** (each request classified SPINE / CHROME / DROP with its `<variable-extractor>` names), the solved **correlation map**, the **data pools** every `${P_…}` the VU references resolves to (row counts, columns, sample rows, and the `gen-pool.cjs` command to port each one — plus which `${P_…}` are constants/generated rather than pools), the **paired data-script VU** (from the test-data population), and a **dissection of each write / detail-form-open body** — resolved values pulled from the recorded-artifacts zips: envelope shape, populated transport-table cells by column name, and the `{Key,Value}` context arrays. **Read the digest, not the raw tree** — it keeps the XML, the extractor blocks, and the multi-KB captured bodies out of the main context. Hand-dumping the tree (`cat` the xml, ad-hoc node walkers, manual `unzip` + per-body dumps) instead of running the digest first is the main avoidable token sink in this workflow.

**Steps inside logic actions are steps too.** A `<loop-action loop="2">`, an `<if-action>` (then/else branches) or a `<try-action>` holds steps of its own in its folder. The digest lists them in execution order, marked `[inside loop loop-multipleServiceOrders ×2]` or `[inside if ItemAvailabilityForUser (then)]`. A loop means the flow repeats those steps that many times per iteration. An if means one branch runs: agree with the user which branch(es) to port. `gen-fidelity-lists.cjs` stops when a step number is recorded in both branches, because its tiers are keyed by step number.

The digest is **advisory** on the SPINE/CHROME split — it flags likely UI-chrome by endpoint suffix, but the final keep decision is yours (§2). Each spine request prints what it **consumes** (`consume ←`, the `${…}` tokens in its body/query) and what it **extracts** (`extract →`); §2 needs both.

For a body the digest doesn't dissect (a grid/search read, or a second capture), pull and dissect it directly:

```bash
unzip -o "team/vus/<VU>/%resources%/recorded-artifacts/<uid>.zip" -d /tmp/x   # req_*.txt body is after the first blank line
node .claude/scripts/inspect-capture.cjs /tmp/x/recorded-requests/req_*.txt            # shape + populated cells + correlation candidates
```

Every helper script this workflow uses lives in **`.claude/scripts/`** (that folder is the authoritative list) — invoke each as `node .claude/scripts/<name>.cjs` from the repo root, since output paths are cwd-relative. Use `node -e`, not `jq`/`python`.

**Feed the tools the ZIP body, never the VU xml.** The `<textPostContent>` body in a `<request>.xml` is *templated* — it carries `${…}` correlation tokens, so it is **not valid JSON** and `inspect-capture.cjs` / `gen-payload-builder.cjs` throw on the leading `$`. The recorded-artifacts `req_*.txt` body has the **resolved real values** (valid JSON); `neoload-digest.cjs` already reads from the zips. Read the VU xml directly only for the `<variable-extractor>` list and which cells are `${…}` tokens (the input to a gen spec's `params`/`regenerate`).

## 2. Distill to the transaction spine

A NeoLoad recording captures **everything the browser did**. Keep only the functional server calls; drop the rest:

- **Drop** static assets (css/js/html/fonts/images), telemetry (`/v1/traces`, analytics), and pure UI chrome (menu/column-cache/window-info/recently-used/grid-view reads that only paint the UI).
- **Keep** the writes (the `Save2`/create/update calls) and the reads whose extracted values **feed a later write**.
- **The `<variable-extractor>` blocks tell you which reads are load-bearing.** A read whose `C_…` extract is consumed by a downstream request stays. (A 100-call recording is often ~10–15 functional calls.)
- **A read that *consumes* a per-iteration value is functional flow too**, even when nothing consumes what it returns. If its `consume ←` line carries a `C_…` token or a jsAction output (the event key the user just picked, a stamp minted by the step before), it can't be a fixed replay. Keep it as a wrapper by default, especially a heavy one (multi-KB grid/detail responses). "Nothing reads its extract" proves it isn't needed for **correctness**; it says nothing about **load**. Downgrading such a read to chrome is a deliberate, reported choice, not the default.
- **Reads between writes can be load-bearing, not chrome** — e.g. a detail re-read that refreshes an optimistic-concurrency token (see §4), or the dialog/drawer a save prompt opens before the answering save (see §5). Don't drop a read just because it looks like a repaint.
- **Dropped ≠ gone — but only if the generator emits it.** What you drop here (static assets + UI chrome) replays in the **fidelity tiers**. Every port scripts them (§4a, `rules/fidelity.md`) and every ladder run uses `-e FIDELITY=full` (§5). The generator keeps scripted requests out of those tiers, so a downgraded read on a path it excludes fires at **no** tier. §4a's exclusion report and the §6 coverage gate are where you confirm every dropped request actually landed in a tier.

## 3. Correlate — translate NeoLoad's extractors, don't re-derive

NeoLoad already solved correlation; translate it. Classify each dynamic value (same scheme as `generate-test` §2):

| NeoLoad form | Meaning | k6 strategy |
|---|---|---|
| `${C_…}` with a `<variable-extractor>` | server-generated, extracted from a prior response | extract at runtime (parse the response by **column name**, not the captured positional index — layouts drift) |
| `${P_…}` project variable (host/version), or a single-row `<variable-list>` | environment | `source/config/env.config.ts` |
| `${P_…}` `<variable-file>` / multi-row `<variable-list>` column | a **data pool** of existing records | a generated `source/data/pools/<name>.data.ts`, selected with `pick_pool_value` — **every row, not the first few** (§4) |
| `${P_…}` whose rows share a generated prefix | rows its paired data-script VU created | discover at runtime via the seed marker; no pool module (§4) |
| `${P_…}` credential pool | user | the encrypted `source/data/creds/users.data.ts`, picked with `pick_user` |
| `${P_…}` `<variable-password>` (e.g. `P_API_UserId`/`P_API_Key`/`P_API_Secret`) | public-API user creds | the encrypted `source/data/creds/api.data.ts`, decrypted in `setup()` with `decrypt_api_credentials` and signed per iteration with `mint_api_jwt` |

**A `<variable-password>` value can't be read from the project.** Its `password-value` in `team/variables/*.xml` is encrypted with NeoLoad's built-in key, and NeoLoad isn't installed here, so the plaintext must come from the user. Ask for it **by NeoLoad variable name** (`P_API_Secret`), not by the account it belongs to, and say up front that `temp/secret.json` does **not** hold it: its `key` is only the passphrase that encrypts the repo's creds modules. A recorded JWT's payload exposes the user ID and key in plaintext, so only the secret needs supplying. Before minting, check the supplied secret against the recorded JWT: re-sign the recorded `header.payload` with it and compare the signature. A mismatch means the value is wrong, unless the creds were rotated since the recording.
| client-generated (uuid, nonce, timestamp) | made up by the browser | regenerate per request (`crypto.randomUUID()`, `Date.now()`) |

**Watch for NeoLoad smells — a recorded value that looks correlated but isn't.** A server-allocated id (e.g. an upload `FileKey`) can be left **hardcoded** in one request even though a later request correlates it, because the server round-trips the stale value within the recording session. On a fresh k6 run that stale id is wrong. Find the value's true runtime source (the response that first mints it) and correlate from there.

## 4. Script — reuse first, embed captured payloads, override identity

- **Reuse existing wrappers first** — the recon digest lists them; confirm against `source/` rather than re-reading. Momentus journeys share a lot (login, search, open-detail, the `Save2` envelope), so often the recording's login and several reads/writes already exist as wrappers and only the genuinely new operations need scripting.
- New endpoints get a thin wrapper in `source/apis/<feature>.api.ts`; new payloads a builder in `source/data/payloads/<feature>/`. The path-scoped rules (`apis`, `flows`, `data`, `scripting`, `exports`, `tests`) auto-load when you edit those files — follow them; don't re-derive conventions here.
- **Upload steps: bring the fixture, then match the recording's upload encoding.** An upload journey needs its file bytes copied from `custom-resources/` (§1) into `source/data/uploads/<feature>/` and `open()`-ed (binary mode, `'b'`) in the spec init context (per the data/tests rules). **Check the recorded request's `content-type` to pick the shape — Momentus has two, and they are not interchangeable:**
  - **Momentus core (`GenericServer/CacheFiles`) is base64-JSON, not multipart** (`content-type: application/json`) — the file bytes are `b64encode`-d inside a JSON array. Reuse `cache_document_file` (it base64-encodes the opened `ArrayBuffer` and posts `CacheFiles`); it returns the server-allocated `FileKey` to correlate into the document `Save2`. Do **not** wrap this in `http.file()`.
  - **True `multipart/form-data`** (e.g. the sales-ai file upload) uses a real `http.file(content, name, mime)` payload. Only here do you restore multipart — and do **not** reproduce NeoLoad's raw-body multipart workaround (its as-code YAML can't do binary multipart, so the recording fakes it); the k6 port sends the real upload.
- Give every lean-spine request from an opted-in step (`slaProfileEnabled="true"`) its profile's average in `<journey>Thresholds`: `avg<4000` for `UserPath_Transactions`, `avg<20000` for `Report`. Don't add a `p(95)` while porting. One goes in later, beside the average, only from a measured run whose commit records it. The full rule is in `rules/tests.md` under Thresholds.
- **Port every data pool the digest lists, complete.** For each pool in the digest's DATA POOLS section, run the `gen-pool.cjs` command it prints — that writes `source/data/pools/<name>.data.ts` with all N rows, and the flow picks per-iteration with `pick_pool_value`. Never retype pool values, and never substitute one captured literal for a pool: the recording's spread *is* part of the workload, and a 5-row stand-in for an 824-row pool passes every check in §5 while exercising a fraction of the data. Two things are *not* pools and the digest separates them out: constants/generated variables (a host, a counter, a timestamp — `source/config/` or regenerated per iteration), and a pool flagged with a shared generated prefix (its rows are the seed's output — see the seed decision below). The data rule auto-loads when you edit `source/data/pools/`.
- **Complete is not the same as valid on this env.** A recorded row can be one the env rejects: an account name the search refuses as too broad, a space that isn't bookable. Prune it and record it in the pool header with the server's reason (`rules/data.md`). When the journey reads a new pool through a search, add its probe, `source/probes/<pool>.probe.ts` (`rules/probes.md`), and tell the user to run it. The probe sends traffic, so it's the user's run, not part of the ladder.
- **Decide the prerequisite-data strategy before scripting the journey** (mirrors `generate-test` §3). If the journey has a paired `@u*` *data-script* VU (found via its test-data population, §1), that VU **creates** the records the journey reads — recognizable by `errorPolicy="STOP_AND_START"`, no SLA profile, `MODE_NO_PACING`/zero think-time, and a tail `DataWrite_*` js-action. Port it into `source/seeds/<feature>.seed.ts`, reusing existing api wrappers — a **separate seed pass**, not folded into the journey. The seeds rule auto-loads when you edit `source/seeds/`; in short:
  - **Port from the data script's own digest.** The journey digest's PAIRED DATA-SCRIPT section prints the command, at this VU's version. Never derive the seed from the journey's reads or from what the records look like: a hand-written seed creates a plain record where the data script leaves a booked event with a function and answered service orders.
  - **Leave the same data, not the same navigation.** Keep every write the data script makes per pass, and the prompt answer it sends. Repeat each `loop` as many times as the recording does. Carry the same cells in each save, and pick per iteration from every pool the data script picks from. Diff each save builder against the data script's recorded body (`compare-payload.cjs`) rather than reusing a builder that only looks similar. Drop a UI read unless a saved value comes from it.
  - **NeoLoad's records are a reference, not a substitute.** Discovery searches the seed's k6 prefix, so the records NeoLoad's data run left are never found, and every env runs the k6 seed. The data script's output file in `variables/version_<ver>/` (one per version its run covered, mapped to an env by `P_Performance_Sites`) names records worth comparing against, not reusing.
  - **Add the seed probe.** Write `source/probes/<feature>-seed.probe.ts` (`rules/probes.md`, Seed probes): it reads one NeoLoad-created record and one k6-seeded record back through the journey's read wrappers and compares their fields with `parity.helper.ts`. This is the only check of what the server made of the seed's requests; §6 of the coverage gate compares the requests alone. It needs an env that still holds NeoLoad's records, which `main` usually doesn't, so it's the user's run: name it in the report with its command, the env to point `temp/setup.json` at, and, when the journey doesn't pick from a live grid, a `-e REF_NAME=` taken from the file.
  - **Replace the handoff, never replay it.** The digest's DATA WRITES section names the variable the data script hands over (`C_ALT_EVT_DESC → Data_MultipleServiceOrders.txt`). Name the seeded records with a `config` prefix carrying the consuming journey's test id (`seedEventPrefix: 'k6-t34-booking-event'`), and have the journey's `discover_*` search that same key. Never replay captured keys.
  - **Keep in-flow discovery when the journey reads no handoff file.** Some journeys pick their record from a live grid during the flow instead: a `TransportDataRows[*]` extractor with matchNumber 0 (a random row) handed to a jsAction that splits it into variables (T08 picks a non-invoiced order this way). Port that grid read as the discovery, in the same step, and parse the row by column name. Add a `LIKE` search filter on the event description (the grid object's own column id, read from `ObjectColumnCacheServer/GetObjectColumns`) with the seed's prefix: the server caps a grid read at 1000 rows in its view's sort order, so on an env with more eligible rows than the recording saw, the seeded rows can fall past the cap. Don't add a `discover_*` to `setup()`. The seed still names its records with a test-id `config` prefix (`seedInvoiceEventPrefix: 'k6-t8-booking-event'`), so the records stay traceable and the review finds the seed by it.
  - **Fail a seed-data gap with `seed_gap_message`.** Whether discovery runs in `setup()` or in-flow, finding no seeded record throws or `fail()`s with `seed_gap_message(<journey>, <detail>)`, so `/verify-envs` can seed and re-run (`rules/seeds.md`).
  - **Size the seed for a journey that uses up its records.** When the journey's write takes the record out of its own pick list (an invoiced order leaves the non-invoiced grid), each iteration consumes one seeded record. Report the volume a `neoload` load run needs (VUs × run time ÷ pacing), and keep the seed's `SEED_COUNT` default above it or say it must be raised.
- **Large captured payloads: generate, don't transcribe.** Extract the concrete body from the request zip, then emit the builder with `node .claude/scripts/gen-payload-builder.cjs <capture> <spec.json>` (the spec maps runtime-varying cells to `params`, client-side values to `regenerate`, and lifts each transport table via `extractTable`) rather than hand-transcribing or hoisting the body to a shared constant. The generated builder must weave each runtime-varying cell in at its position (in a columnar transport table, the numeric `Values` key matching the column's `ColumnID`). Re-correlate per-record identity fields the same way — weave the runtime `source` value into its cell, not a post-build mutation — and lift each transport table into its own module-level `: TransportTable` builder the payload plugs in. This mirrors the repo's `copy-form`/`save` builders and the "regenerate/diff-verify, don't hand-edit" convention.
- **Name every record the journey creates `k6-t<id>-<what>-<vu><iter><epoch>`**, per the test-data naming rule in `rules/scripting.md` (`k6-t2-booking-event-…`), not with NeoLoad's text (`Performance BookingEvent …`, `NeoLoadFunction_…`). A seed uses the consuming journey's id. Only a tight-limit field keeps a short code that fits it.
- **Override every per-record identity field** from the correlated row (order nbr, account, event id, search key). A captured unique key left in place makes the server reject or mis-target the save.
- **Optimistic-concurrency tokens are load-bearing echo fields.** A header/record save often carries the row's last-update timestamp; the server rejects the save (`PrimaryKeyRecordChanged`) unless it matches the row's **current** value. Correlate it from the open-detail response and thread it into the save — do not replay the captured stamp. If a builder *omits* the timestamp columns it sidesteps the check (some do); if it *includes* them, you must correlate them.
- **Chain the token across sequential saves.** Each save bumps the row's timestamp, so re-read detail (or read it from the prior save's response, which returns the refreshed row) before the next header save.
- **Data isolation is stricter for record-modifying journeys.** An add-only journey tolerates two iterations sharing a seeded row; a header-modifying journey does not — the concurrency check turns a shared row into a failure. Give each iteration a **globally-unique** row (`exec.scenario.iterationInTest % pool.length`), not the `(__VU-1+__ITER)` formula (which collides across VU/iter pairs). Don't infer isolation from the recording: NeoLoad's data-script files are `global` scope with `CYCLE_VALUES`, which per the docs *shares rows across VUs and recycles them once exhausted* — only NeoLoad's `Unique` scope reserved a row per VU — so the port must impose uniqueness in k6, not trust the ported policy.
- Pick the VU's user with `pick_user` and register the journey in `smoke.spec.ts` (scenario + `exec` wrapper + `<journey>Thresholds`), per the tests rule.

## 4a. Fidelity tiers — mandatory, every port

Beyond the spine, the recording's UI-chrome and static requests replay as env-gated tiers, so a run
reproduces the browser's full load. **This is not optional and not a question for the user:** every port
generates the tiers, wires them into the flow, and is verified at `-e FIDELITY=full` (§5). Script the spine
(§4) first, then the tiers, then run the ladder.

- **Always run the generator, even when the digest reports `chrome 0 · static/telemetry 0`.** Its output and
  its `excluded as scripted` report are the evidence that nothing was missed. Wire the flow to the generated
  modules and the `include_ui` / `include_static` gates even if a tier comes out empty, so the journey picks
  up a re-recording without being rewired.
- Generate the lists from the tree: `node .claude/scripts/gen-fidelity-lists.cjs "<VU tree>" source/data/chrome/<journey>.chrome.ts source/data/static/<journey>.static.ts source/data/transport/<journey>.transport.ts` (do-not-hand-edit; regenerate on re-record).
- Before generating, tell the generator which recorded requests the journey scripts, so the tiers neither double-fire them nor drop them. It has three exclusion levels, so pick the narrowest that fits:
  - **`SPINE` (global)** — only paths every journey always scripts: writes, uploads (`GenericServer/CacheFiles` — a captured upload body is a huge base64 blob), sign-in/out, and correlation sources. **Never a read path.** A read on a shared path (`GetGridData2`, `GenericDetailServer/GetInitialData2`, `WindowServer/GetWindowInfo`) is a wrapper in some steps and UI paint in others. A global entry once dropped every unscripted occurrence, in every journey, from every tier.
  - **`JOURNEY_SPINE` (per journey, per step)** — a path the journey scripts in a given step, when that step records **only** the requests the wrapper reproduces.
  - **`JOURNEY_SPINE_REQUESTS` (per request)** — one request among several on the same path in a step. Match it by body prefix (the object id leading a `GetObjectColumns` body), query substring (`astrWindowID=…`), or `max` when the step records identical requests and the wrapper reproduces only some.
- **Read the generator's `excluded as scripted` report after every run.** It lists each request kept out of the tiers, by step, path and level. Every line must match a wrapper call in that step of the flow; an exclusion with no wrapper behind it means the request fires at no tier. A path+step entry that excludes 3 requests where the flow scripts 1 is the classic case: narrow it to `JOURNEY_SPINE_REQUESTS` and regenerate.
- A chrome request whose body **echoes a full selected grid row** (`USIDataGridServer/GetControlInfo`, carrying `ROW*_` tokens) can't be resolved by per-token subs from the spine — the row isn't a spine output. Full fidelity requires 1:1 parity, so always reproduce it as a **dedicated fidelity-gated wrapper** (see `get_service_order_control_info` / `get_event_control_info`): extend the row type (`ServiceOrderRow` / `EventRow`) and its `parse_grid_rows` mapping with the echoed columns — they come from the same grid read the spine already makes — add a table-builder that weaves those cells and a wrapper fired behind `include_ui`, and keep the endpoint in the generator's `SPINE` exclusion so the chrome tier doesn't double-fire it. Never leave it excluded and unfired.
- Wire the flow to fire each step's slice behind the `include_ui` / `include_static` gates alongside that
  step's spine call, and correlate the requests' `${…}` tokens through a subs map built from the
  correlation the spine already extracts.
- **Never `Read` the generated `*.chrome.ts` / `*.static.ts` into the main context** — they carry multi-KB
  opaque replay bodies the flow never touches by hand (tokens are substituted at fire time). To build the
  subs map, run `node .claude/scripts/fidelity-tokens.cjs source/data/chrome/<journey>.chrome.ts source/data/static/<journey>.static.ts --vu "<VU tree>"`:
  it prints the tokens per step and the **subs-map contract** (the full token-key set the flow must supply), each
  with its **provenance** — the step and request whose extractor mints it in the recording.
  Supply each token from the request its provenance names. A token that is *not* already a spine output (an
  event row key, an event name, a column-cache stamp of another object) needs its own `include_ui`-gated lookup
  wrapper that produces it into the subs map before the batch consumes it, plus a `JOURNEY_SPINE_REQUESTS`
  entry so the tier doesn't also fire that request. **Never alias** a token to a same-shaped value the spine
  already holds: two `GetObjectColumns` stamps from different steps/objects are different values. If you must
  see one specific generated request, `grep` its path — don't `Read` the file.
- The conventions — what the generator normalises (query strings, Base64 bodies, kept tokens, excluded
  spine dups, pruned stale endpoints), the substitute-or-skip contract, building the subs map, coarse
  tolerant tagging, think-time — live in `rules/fidelity.md`, which auto-loads when you edit the
  chrome/static/helper files. Don't re-derive them here.
- The §5 ladder runs at `-e FIDELITY=full`, so every step verifies the tiers: `http_req_failed` must stay 0 and no request may be skipped
  for an unresolved token. A chrome request that needs a response-derived value the spine doesn't produce
  gets its own gated wrapper (per the rule), not a blanked token.

## 5. Verify — 3-step progressive run

Pre-flight (zero traffic): `npx tsc --noEmit`, then `k6 inspect source/tests/smoke.spec.ts`.

Then the same escalation as `generate-test` §4, **always at full fidelity**. Every step carries `-e FIDELITY=full`. There is no other fidelity level for a port: never offer one, never ask, and a run without the flag doesn't count as a ladder pass.

| Step | Command | Proves |
|---|---|---|
| 1 | `k6 run -e SCENARIO=<journey> -e FIDELITY=full source/tests/smoke.spec.ts` | runs & correlates, spine + tiers (1 VU / 1 iter) |
| 2 | `… -e FIDELITY=full -e VUS=2 -e ITERS=2 -e USER_MODE=single …` | concurrency, one shared login |
| 3 | `… -e FIDELITY=full -e VUS=2 -e ITERS=2 -e USER_MODE=pool …` | per-user correlation & data isolation |

**Seed first (step 0), when the port adds or changes a seed.** Follow the `seed` skill for `main` and the journey with `+3` (three new records, not a top-up), before step 1. Then confirm in step 1's log that the journey ran on those records: the `discover_*` count names the seed's prefix, or the grid row it picked carries it. A ladder that passes on records NeoLoad's data run or an earlier seed left behind proves nothing about the seed. Step 3 needs at least as many seeded records as its 4 iterations, so pass `+4` or more when the journey uses up its records. A reused seed whose records already exist on `main` skips step 0.

Run each step via `k6-run-reporter` (hand it the exact command, and note the journey creates/modifies data so it checks per-VU token isolation); act on its verdict — `checks` 100%, `http_req_failed` 0, `dropped_iterations` 0, `iterations` > 0 — rather than reading the full summary. It saves each run's log under `temp/claude/reports/` for the response-body decode below.

**Decode the response before changing inputs.** A `Save2` frequently returns **HTTP 201 with `ResultValue ≠ 0`** — a server-side *validation* failure, not a transport error. The body's `MessageInfoList[].MessageKey` names the exact problem (`OrderDateGreaterThan30Days`, `PrimaryKeyRecordChanged`, a search-key clash, …). Log the body on failure and read it — never guess-and-iterate on inputs. `MessageMode: 2` is a confirmation prompt ("do you wish to proceed?"), not a hard reject; keep the input inside the allowed range rather than replaying an out-of-range captured value.

**A prompt the recording answers is part of the journey — reproduce the round trip.** When the recorded step holds two saves of the same endpoint with requests in between (`Save2` → `GetWindowInfo` / `GetObjectColumns` / a dialog or drawer `GetInitialData2` → `Save2_1`), the browser showed the prompt's dialog and the user answered it. Script it the same way, as flow-level calls:
1. The first save, returning the prompt.
2. The recorded reads between, correlated from the prompt's `MessageData` and the stamp the step mints, not replayed from the capture.
3. The answering save.

Give each its own **literal** tag default (`'SaveXConfirm'`, never a template like `` `${name}Confirm` ``, which no threshold check or review can resolve). Answering the prompt straight away drops the dialog's reads from the load, and a missing request never fails a check.

Loop rules (per `generate-test`): fix, re-run; if the fix touched correlation/shared state, re-run from step 1; cap at ~2–3 attempts per step, then surface to the user. A `p(95)` latency threshold crossing under 2-VU load is a performance observation, not a correctness failure — the ladder proves correctness, not SLO.

**Verify the journey as ported.**
- **The last ladder pass is on the final code.** If the flow or its wrappers change after a step passed, re-run that step and the ones after it (from step 1 if the change touched correlation or shared state). A type-only edit doesn't count.
- **Keep the pool pick as NeoLoad makes it.** If a random pool row fails, never hard-wire the pick to the row NeoLoad recorded just to get a green run: that stops the port spreading load across the pool, and the bad rows fail anyway under load. Decode the failure, report the row and its `MessageKey`, and stop. The fix is a prune recorded in the pool header (§4), not a pinned pick.
- **The ladder is the only traffic**, plus its step-0 seed run. Don't offer or recommend any other run: no pool sweeps, extra iterations or retests. A pool probe and a seed probe (§4) are the user's runs, named in the report. The only exception is the targeted live fallback below. There is no separate fidelity run: the ladder itself runs at `-e FIDELITY=full`.

**Targeted live fallback:** if a step fails and decoding points to drift (the recorded shape no longer matches the current app), drive just that one request with `playwright-cli` to see the current traffic — not a full re-record (expect the first `open` to hit the SPA nav timeout — poll `snapshot` rather than retrying; see `generate-test` §1).

## 6. Refactor & report

**Coverage gate (zero traffic).** The 3-step ladder can't see a request the port never sends: absent traffic passes every check. Before handoff, run the deterministic coverage half of the review:

```bash
node .claude/scripts/neoload-port-review.cjs "<VU tree>" source/flows/<journey>.flow.ts
```

Resolve every FLAG in these sections before reporting:
- **§2 SPINE COVERAGE:** a spine endpoint `NeoLoad ×n, k6 ×m`, a recorded request that `fire[s] at no tier`, or a request `double-fired at -e FIDELITY=ui`. Either script the request, fix the generator exclusion and regenerate, or record an explicit, reasoned omission in the report.
- **§4c TEST-DATA NAMES:** a record name off the `k6-t<id>-…` pattern.
- **§6 SEED:** the seed against the data-script VU — writes per pass, loop counts, saved tables, pools, and the shared prefix between seed and discovery (or the in-flow grid read that stands in for discovery). Confirm §6 prints the data-script comparison lines: a FLAG that no seed is compared means the seed's `config` prefix doesn't carry the test id. A fix to the flow or wrappers re-runs the ladder (§5). This gate is the script only; the judgment review (`/neoload-port-review`) stays in a fresh session (below).

Final structural pass against the auto-loaded rules. Delegate the compliance scan to `k6-authoring-analyst` (as in `generate-test` §5) over the new `source/` files — but tell it the embedded payload constants **intentionally** contain captured values (the embed-and-override pattern), so the hardcoded-value scan targets the **flow/wrapper logic**, which must carry no hardcoded dynamic ids. Also have it check **pool fidelity**: every pool in the digest's DATA POOLS section has a `source/data/pools/` module whose row count matches, is reached with `pick_pool_value`, and no pool value sits inline in a flow or a payload builder instead. A truncated pool is functionally correct, so §5 can never catch it — this scan is the only gate that does.

Report: NeoLoad steps ported vs dropped-as-chrome, wrappers reused vs created, **data pools ported (variable → module → row count, rows pruned, and any left to runtime seed discovery)**, the seed (data-script VU → seed file, writes per pass, the envs that need it run, and, for a journey that uses up its records, the volume a load run needs), correlation decisions (and any NeoLoad smells corrected), the step-0 seed run and the 3-step results, and the run commands, plus any probe for the user to run (a pool probe, and the seed probe with the env and `REF_NAME` it needs).

The 3-step run proves the journey on `main` only. The one next step to recommend is `/neoload-port-review <journey>` in a **fresh session** — a zero-traffic second look against the recording that doesn't inherit this session's assumptions. Only suggest it, and suggest nothing else (the cross-version `verify-envs` sweep is suggested by the review, not here): never run the review skill in this session. The porting context would make it cost more and would bias the second look. The coverage gate above runs the review's deterministic script, which needs no such protection. The skill's judgment of what that script flags is what stays fresh.
