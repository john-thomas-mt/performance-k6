---
name: neoload-port-review
description: Review a finished NeoLoad → k6 port against its recording, in a fresh session — step and spine coverage, correlation, recorded values left hardcoded, every variables/ pool and generated variable, the data-setup (seed) pairing, SLA thresholds and wiring. Zero traffic, review only. Use when the user wants to review, audit or double-check a ported journey (`/neoload-port-review <journey>`).
---

# NeoLoad port review — check a port against its recording

An independent second look at a journey `neoload-to-k6` produced. The **recording is the reference**, not
the porting session: don't read its recon kit or reasoning, and don't assume a choice was right because
the code looks deliberate. Run it in a **fresh session** so nothing from the port leaks in.

**Review only, zero traffic.** Never `k6 run`, never `playwright-cli`, never edit `source/`. Findings go
to a report; fixes belong to an authoring session.

## 1. Gather the evidence (one command)

Resolve the flow from the argument (a scenario name like `lead_account` → `source/flows/lead-account.flow.ts`),
then run:

```bash
node .claude/scripts/neoload-port-review.cjs "C:/momentus-projects/performance" source/flows/<journey>.flow.ts
```

Given the NeoLoad project root, it picks the VU from the flow's step prefix and the version its pools were
generated from (pass the VU tree dir instead to override). It prints OK / FLAG / INFO lines across eight
areas — steps ↔ groups, spine coverage per step, correlation, token-literal leaks, variables (pools
row-for-row, cross-version files, credentials, generated/constant translations), seed pairing, SLA ↔
thresholds, wiring. **Everything it prints OK is verified — don't re-check it.** Your job is the FLAGs, the
INFOs that ask for confirmation, and the judgment checks in §3.

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
| `k6 reaches n call sites` (INFO) | two unconditional calls where the recording has one | the extra call sites are a fallback/retry branch |
| token-literal leak | the value is server-minted or per-record (ids, keys, stamps, names that must be unique) | it's the recorder's typed input the server only echoes back, identical every run |
| GUID / bearer-token literal | a session token, API key or record GUID pasted into a flow, wrapper or type file | a fixed schema or app id the server expects on every call — cite where it's constant |
| consumed but extracted nowhere | nothing in k6 produces the value | a jsAction or the `_N` occurrence of a multi-match extractor produces it |
| pool rows differ | truncated or retyped pool | the module header documents a deliberate filter — check the reason still holds |
| pool across versions `DIFFERS` | the journey runs on a version whose rows are not the ported ones | rows are env-independent or discovered at runtime |
| generated variable, no evidence | the flow never regenerates it (a captured timestamp/counter replayed) | translated under another name — cite where |
| seed expected | no `source/seeds/` pass and no `setup()` discovery for the rows the journey reads | an existing seed + marker covers it — cite both |
| SLA / threshold mismatch | a spine request has no threshold, or its limit contradicts the NeoLoad SLA | the repo's convention for shared helper tags |

## 3. Judgment checks the script can't make

Read the **hand-written** files only: the flow, the journey's `source/apis/*.api.ts` wrappers and its
`source/utils/types/*.type.ts` (the path-scoped `.claude/rules` for those layers apply). Check:

- **Correlation by column name**, not a captured positional index; each extract has a `check` + `fail`.
- **Per-record identity** overridden from the correlated row (ids, account, search key) — no captured key.
- **Optimistic-concurrency stamps** correlated from the latest read and chained across sequential saves.
- **Data isolation**: a record-modifying journey gives each iteration a unique row
  (`exec.scenario.iterationInTest % pool.length`), not a shared or `(__VU-1+__ITER)` row.
- **Business-rule prompts**: a `Save2` returning `ResultValue ≠ 0` fails loudly with its `MessageInfoList`.
- **Seed** (when §1 flagged one): the seed ports every create step and the `loop.xml` volume, plants the
  marker, and the journey discovers its rows in `setup()` — no replayed captured keys, no seed-output file
  ported as a static pool.
- **Fidelity tiers**, if `source/data/chrome/<journey>.chrome.ts` exists: run
  `node .claude/scripts/fidelity-tokens.cjs source/data/chrome/<journey>.chrome.ts source/data/static/<journey>.static.ts`
  and confirm the flow's subs map supplies every contract token. Never `Read` the generated tier files.

## 4. Report

Write `temp/claude/docs/port-review-<journey>.md`:

1. **Verdict** — `clean`, `minor findings` or `needs fixes`, with the VU + version reviewed.
2. **Findings**, most severe first. Each: severity (**High** = wrong load or breaks under concurrency /
   on another env · **Medium** = diverges from the recording · **Low** = convention), the NeoLoad evidence
   (file / token / recorded value — mask credentials), the k6 `file:line`, and the suggested fix.
3. **Accepted deviations** — FLAGs judged acceptable, one line of reason each, so a later review doesn't
   re-open them.
4. **Verified clean** — one line per area the script passed.

Then give the user the verdict, the High/Medium findings, and the report path. Offer to hand the fixes to
an authoring session; do not apply them here.

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
