---
name: perf-4-journey-review
description: Step 4 of the NeoLoad port pipeline — review a finished NeoLoad → k6 journey port against its recording, in a fresh session: step and spine coverage, correlation, recorded values left hardcoded, test-data names, every variables/ pool and generated variable, how the journey finds its seeded records, SLA thresholds and wiring. Zero traffic, review only. The seed itself is perf-2-seed-review's. Use when the user wants to review, audit or double-check a ported journey (`/perf-4-journey-review <journey>`).
---

# 4 · Journey review — check a port against its recording

**Pipeline** (each step in a fresh session; each ends by handing over the next command):
`perf-1-seed-port` → `perf-2-seed-review` → `perf-3-journey-port` → **`perf-4-journey-review`** → `/verify-envs`.

An independent second look at a journey `perf-3-journey-port` produced. The **recording is the reference**, not
the porting session: don't read its recon kit or reasoning, and don't assume a choice was right because
the code looks deliberate. Run it in a **fresh session** so nothing from the port leaks in.

**Review only, zero traffic.** Never `k6 run`, never `playwright-cli`, never edit `source/`. Findings go
to a report; fixes belong to an authoring session.

## 1. Gather the evidence (one command)

Resolve the flow from the argument (a scenario name like `lead_account` → `source/flows/t1-lead-account.flow.ts`),
then run:

```bash
node .claude/scripts/neoload-port-review.cjs "C:/momentus-projects/performance" source/flows/<journey>.flow.ts --skip 6b
```

Section 6b, the seed against its data-script VU, is skipped: it's `perf-2-seed-review`'s.

Given the NeoLoad project root, it picks the VU from the flow's step prefix and the version its pools were
generated from (pass the VU tree dir instead to override). It prints OK / FLAG / INFO lines across these
areas:
- **steps ↔ groups**, including the steps a `loop`/`if`/`try` action holds (an INFO says how often or on which
  branch each runs)
- **spine coverage per step:** every enabled request in every page, not just each page's first. A spine request the
  flow only reaches behind `include_ui`/`include_static` FLAGs, because a lean run skips it. The lean spine's page
  order is compared with the recording; requests within one page fire in parallel, so their order isn't checked.
- **fidelity tiers page by page (2b):** a missing tier set FLAGs whenever the recording has chrome or static
  requests. Each generated page must hold requests from one recorded page, pages come in recorded order, every
  recorded non-api request is placed, and no sequential page is replayed as a parallel batch. Version-prefixed
  pool names are ignored for the match.
- **correlation**, including jsActions that compose variable names (`C_CUST_NBR_1`) or set each key of a map
  (`for (var v in map) setValue(v, …)`, one variable per column of a picked row). Key-map variables print as one INFO
  naming what the jsAction reads, and a consumed name one suffix short of a jsAction-set one prints as a NeoLoad typo
- **token-literal leaks:** scanned in what the journey itself reaches. Typed input the extracting request already
  sends prints as INFO.
- **transport tables (4b):** each recorded Save2/HDF2 first row is compared by `ColumnName` to the builder of the
  wrapper that posts the same endpoint. A builder that echoes a live table is compared on the cells it sets. A
  recorded table no builder declares FLAGs, or prints as INFO when a builder of that step takes a `TransportTable`.
- **test-data names (4c):** every per-iteration record name the journey writes must read
  `k6-t<id>-<what>-<vu><iter><epoch>`, with this VU's test id unpadded. A name cut to length prints as INFO.
- **variables:** pools row-for-row per column, cross-version files, credentials, jsAction-set variables (a
  computed subs-map key counts) and generated/constant translations, `p_` included.
- **seed discovery (6):** whether the journey needs seeded records, and then how it finds them:
  - a `discover_*` in smoke `setup()`, or, when the recording picks a random grid row in-flow (a `TransportDataRows`
    extractor with matchNumber 0 feeding a jsAction), the same grid read in the same k6 step;
  - that discovery and the seed share one `config` prefix carrying this journey's test id.
- **SLA ↔ thresholds:** tags are resolved per call site, and shared `...xThresholds` spreads are followed. Tags
  fired only behind a fidelity guard or only outside the journey (setup discovery) print as INFO.
- **wiring**

**Everything it prints OK is verified — don't re-check it.** Your job is the FLAGs, the INFOs that ask for
confirmation, and the judgment checks in §3.

## 2. Judge each FLAG — targeted evidence only

For each FLAG decide **real finding** vs **acceptable** (with the reason). Open only what the line cites:

- a k6 `file:line` → `Read` with `offset`/`limit` around it; `grep` a generated payload module, never
  `Read` it whole (they run to thousands of lines).
- NeoLoad evidence → `grep` the step's request XML for the token or endpoint, or dissect one body:
  `unzip -o "<VU>/%resources%/recorded-artifacts/<uid>.zip" -d <scratch>` then
  `node .claude/scripts/inspect-capture.cjs <scratch>/recorded-requests/req_*.txt`.
- a builder you suspect has drifted from its capture → `node .claude/scripts/compare-payload.cjs`.

How to read the common FLAGs:

| FLAG | Usually real when | Usually acceptable when |
|---|---|---|
| spine endpoint `NeoLoad ×n, k6 ×m` | a later write consumes its extract (see §3 of the output) | pure UI paint the classifier missed — say which |
| `in k6, not recorded in this step` | the call moved to the wrong group (timings mis-attributed) | it's a shared helper fired at a step boundary |
| `recorded ×n (chrome), fired ×m — … fire at no tier` | a generator exclusion (global `SPINE`, a too-wide `JOURNEY_SPINE` path+step) swallowed a request no wrapper sends — fix the exclusion and regenerate | the endpoint is on the generator's `DEAD` list or a version gate (cite it) |
| `lean ×n + ui tier ×m — double-fired` | a wrapper reproduces a request the tier also emits — add a `JOURNEY_SPINE`/`JOURNEY_SPINE_REQUESTS` exclusion and regenerate | the wrapper call is conditional (a fallback/retry branch) and the tier copy is the recorded one |
| `[NN] <tier>: n of m pages out of recorded order` | the tier file was generated before the generator walked pages in recorded order. Regenerate it | never acceptable. Recorded page order is what the replay reproduces |
| `[NN] <tier> page n … matches no single recorded page` | the tier merges requests from two pages, or was generated from a different VU/version than the one reviewed | the reviewed VU is not the one the tier was generated from. Rerun against that VU and cite it |
| `[NN] n recorded non-api request(s) fire at no tier` | a generator exclusion swallowed a static/transport request no wrapper sends. Fix it and regenerate | the request is scripted by a wrapper the exclusion list doesn't name. Cite the wrapper |
| `[NN] page(s) set playRequestsSequentially but replayed as one parallel batch` | always real: the page needs its requests fired one after another | none |
| `no complete tier set … though the recording has n chrome/static/telemetry requests` | always real: tiers are mandatory, so a `-e FIDELITY=ui/full` run sends only the spine | none |
| `×n lean ×m: … reached only behind include_ui/include_static` | the recording fires it unconditionally and a later write uses what it returns (an id, a key) | a UI read the lean spine replaces with pool data, and no spine body needs its output. Cite where the value comes from instead |
| `spine order differs from the recording` | a refresh read moved ahead of the write it follows, or a call moved across a page boundary. The timings and server state differ | k6 needs the reversed order to correlate (a stamp read before a save). Cite the dependency |
| `… n column(s) NeoLoad fills from a token, k6 sends a literal` | the token is per-iteration or per-record (dates, names, keys, a pool value) | the token resolves to a value that is constant across runs. Cite its definition |
| `… n literal column(s) differ from the recording` | an option that changes what the server does (copy flags, scope, status, phase) | a captured timestamp or display string the server ignores. Say which |
| `a recorded table … matches no builder table` | the body leaves out a table the save carries (a child table such as item lines), so the record is saved without it | the table is built by code the parser can't read (a helper, a spread). Cite where it is built |
| `a recorded table … is not declared in k6; <builder> takes a TransportTable` (INFO) | the builder takes the table but drops it from the body | it posts the live table it is handed (a form read, a staged row). Confirm in the builder |
| `` `<template>` does not follow k6-t<id>-… `` / `carries test id …` | a record the journey or seed creates is named some other way, or with another test's id | the value is not a record name (a header, a window id, a search term). Say what it is |
| `seed prefix '…' does not carry the consuming journey's id` | always real: a seed's records are named for the journey that reads them | none |
| `discovery searches config.<key> … no source/seeds script names its records with it` | always real: the journey looks for records no seed creates | none |
| `k6 reaches n call sites` (INFO) | two unconditional calls where the recording has one | the extra call sites are a fallback/retry branch |
| token-literal leak | the value is server-minted or per-record (ids, keys, stamps, names that must be unique) | it's the recorder's typed input the server only echoes back, identical every run |
| GUID / bearer-token literal | a session token, API key or record GUID pasted into a flow, wrapper or type file | a fixed schema or app id the server expects on every call — cite where it's constant |
| consumed but extracted nowhere | nothing in k6 produces the value | a jsAction or the `_N` occurrence of a multi-match extractor produces it |
| pool rows differ | truncated or retyped pool | the module header documents a deliberate filter — check the reason still holds |
| pool across versions `DIFFERS` | the journey runs on a version whose rows are not the ported ones | rows are env-independent or discovered at runtime |
| generated variable, no evidence | the flow never regenerates it (a captured timestamp/counter replayed) | translated under another name — cite where |
| `no discover_* the flow defines is called from smoke setup()` | always real: nothing finds the data script's records at runtime | none (in-flow grid discovery is recognised and prints OK instead) |
| `the recording picks its record in-flow … the lean flow does not read it in that step` | always real: the journey has no source for the record the recording picks | none |
| `n variable(s) set by jsAction … from its key map` (INFO) | k6 takes them from a captured value, or from a different row than the one it writes to | the flow parses them from the same live row (grid row type, `get_cell` by column). Cite the wrapper |
| SLA / threshold mismatch | a lean-spine request from an opted-in step lacks the profile's `avg<`, or a `p(95)` replaces it | the step has `slaProfileEnabled="false"` (launch/login in most VUs). Cite the step |
| `p(95)` beside the average (INFO) | no commit records the measured run behind it | the commit that added it gives the run and the measured value (e.g. `202dc9d`) |

## 3. Judgment checks the script can't make

Read the **hand-written** files only: the flow, the journey's `source/apis/*.api.ts` wrappers and its
`source/utils/types/*.type.ts` (the path-scoped `.claude/rules` for those layers apply). Check:

- **Correlation by column name**, not a captured positional index; each extract has a `check` + `fail`.
- **Per-record identity** overridden from the correlated row (ids, account, search key) — no captured key.
- **Optimistic-concurrency stamps** correlated from the latest read and chained across sequential saves.
- **Data isolation**: a record-modifying journey gives each iteration a unique row
  (`exec.scenario.iterationInTest % pool.length`), not a shared or `(__VU-1+__ITER)` row.
- **Seeded-record picks** for a journey whose write takes the record out of its own pick list (an invoiced order
  leaves the non-invoiced grid): a modulo pick over a shrinking live list only stays unique while the stock exceeds
  the iterations in flight. The seed's volume is `perf-2-seed-review`'s; here, check that the journey reaches its
  records through the seed's finder and fails a gap with `seed_gap_message`.
- **Business-rule prompts**: a `Save2` returning `ResultValue ≠ 0` fails loudly with its `MessageInfoList`.
- **Fidelity tiers**, if `source/data/chrome/<journey>.chrome.ts` exists: run
  `node .claude/scripts/fidelity-tokens.cjs source/data/chrome/<journey>.chrome.ts source/data/static/<journey>.static.ts`
  and confirm the flow's subs map supplies every contract token. Never `Read` the generated tier files.

## 4. Report

Write `temp/claude/docs/journey-review-<journey>.md`:

1. **Verdict** — `clean`, `minor findings` or `needs fixes`, with the VU + version reviewed and the FLAG
   tally by verdict (e.g. `6 FLAGs: 0 real · 1 accepted · 5 false positive`).
2. **FLAG triage** — one table row per FLAG the script printed, in output order, nothing else in it:

   | # | FLAG | Verdict | Reason |
   |---|---|---|---|
   | 1 | `P_API_Key` no k6 translation | False positive | translated in `api.data.ts` (`key`), decrypted in `setup()` |

   Verdict is exactly one of:
   - **Real**: the port is wrong. Give it a severity in Findings.
   - **Accepted**: a genuine difference from the recording, kept on purpose. Say why it's safe.
   - **False positive**: the port is correct and the script couldn't see it. Note the script gap in
     §6 of the report so the script can be taught it, and keep the reason to the evidence.
3. **Findings**: only the **Real** rows plus any judgment-check (§3) issues, most severe first. Each row has a
   severity (**High** = wrong load or breaks under concurrency / on another env · **Medium** = diverges from
   the recording · **Low** = convention), the NeoLoad evidence (file / token / recorded value, with credentials
   masked), the k6 `file:line`, and the suggested fix. Use a table with `# | Severity | Issue | Evidence | Fix` columns, or write `None.`
4. **Other observations**: things you noticed outside the FLAG list that are worth knowing but need no fix,
   one line each. Leave the section out when there are none. Don't pad it with facts that merely restate an OK.
5. **Verified clean**: one line per area the script passed.
6. **Script gaps**: one line per False positive naming what `neoload-port-review.cjs` would need to
   recognise it. Leave the section out when there are none.

Then give the user the verdict line, the FLAG triage table (keep the Reason column to one short clause),
any Findings, and the report path. Don't restate the OK areas or the observations in chat. Offer to hand
the fixes to an authoring session; do not apply them here.

## 5. Re-verify only if the script changed

A review that changes nothing needs no run: the port's own 3-step verification still stands. Once fixes
land in `source/`, that verification no longer covers the new code, so tell the user what the fixes need:

- **Any change to a flow, wrapper, builder, pool or type** → the 3-step progressive run from `CLAUDE.md`
  (1 VU / 1 iter → `-e USER_MODE=single` → `-e USER_MODE=pool`). It sends traffic, so it needs the user's
  go-ahead and the passphrase prerequisites.
- **Wiring-only changes** (`neoload.spec.ts` scenarios, threshold maps, barrels) → `k6 inspect`, plus
  `--execution-requirements` for the load spec. This sends no traffic, and no run is needed.
- In both cases, re-run the §1 command (zero traffic) and confirm that only the accepted FLAGs remain.
  Record the outcome as a status note at the top of the report.

## 6. Handover

End with exactly one next command, with its arguments filled in, to run after `/clear` (or in a new session):

- `clean`, or fixes landed and re-verified (§5): `/verify-envs <journey scenario>` — the in-depth check that the port
  trickles down across the `ReleaseVersion` matrix. It is a separate traffic run, not part of this review.
- Open High/Medium findings: say the sweep waits for the fixes, which go to an authoring session.
