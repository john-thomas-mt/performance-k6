---
name: perf-2-seed-review
description: Step 2 of the NeoLoad port pipeline — review a ported seed against its data-script VU, in a fresh session: writes per pass, loop counts, saved tables, pools, prompt answers, replayed keys and the seed probe. Zero traffic, review only. Use when the user wants to review or double-check a seed (`/perf-2-seed-review <journey VU>`).
---

# 2 · Seed review — check a seed against its data-script VU

**Pipeline** (each step in a fresh session; each ends by handing over the next command):
`perf-1-seed-port` → **`perf-2-seed-review`** → `perf-3-journey-port` → `perf-4-journey-review` → `/verify-envs`.

An independent second look at a seed `perf-1-seed-port` produced. The **data-script recording is the reference**,
not the porting session: don't read its recon kit or reasoning, and don't assume a choice was right because the code
looks deliberate.

**Review only, zero traffic.** Never `k6 run`, never `playwright-cli`, never edit `source/`. Findings go to a
report; fixes belong to an authoring session.

## 1. Gather the evidence (one command)

The argument is the journey VU tree. Resolve the flow path from its test id
(`source/flows/t<id>-<flow>.flow.ts`; it may not exist yet — the script accepts that with `--only 6b`), then run:

```bash
node .claude/scripts/neoload-port-review.cjs "<journey VU>" source/flows/t<id>-<flow>.flow.ts --only 6b
```

Section 6b compares the seed with the data-script VU at the journey's version, judged by the data it leaves, not its
navigation:
- which envs NeoLoad's own data run left records on;
- which seed it compares (by the discovery prefix when the flow exists, else the `config` prefix carrying the test id);
- the seed's record names (`k6-t<id>-<what>-<vu><iter><epoch>`);
- each write per pass, and every `loop` count;
- each saved table, cell by cell;
- every pool the data script picks per iteration;
- that the seed has its seed probe, `source/probes/<feature>-seed.probe.ts`;
- a `seed target` INFO (NeoLoad's planned size and the rows per version). `/seed … neoload` reads it; it needs no verdict.

**Everything it prints OK is verified — don't re-check it.** How the journey finds the records (section 6) belongs to
`perf-4-journey-review`.

## 2. Judge each FLAG — targeted evidence only

For each FLAG decide **real finding** vs **acceptable** (with the reason). Open only what the line cites: a k6
`file:line` with `Read` `offset`/`limit`; a generated payload module by `grep`, never whole; NeoLoad evidence by
`grep`-ing the data script's request XML, or dissecting one body (`unzip -o "<VU>/%resources%/recorded-artifacts/<uid>.zip"
-d <scratch>`, then `inspect-capture.cjs` on the `req_*.txt`); a suspect builder with `compare-payload.cjs`.

| FLAG | Usually real when | Usually acceptable when |
|---|---|---|
| `<U> <endpoint> ×n per pass, seed ×m: the seed leaves out / adds a write` | the seed leaves different data from the data script (a missing function save, a missing prompt answer) | the write is UI state only, not the seeded record. Say which |
| `<U> runs loop … — the seed has no loop of n` | the seed creates fewer (or more) child records per parent than the data script | none |
| `<U> picks P_… per iteration … is not picked with pick_pool_value in the seed` | the seed pins one value (a fixed account) where the data script spreads across the pool | none |
| `… n column(s) NeoLoad fills from a token, k6 sends a literal` | the token is per-iteration or per-record (dates, names, keys, a pool value) | the token resolves to a value that is constant across runs. Cite its definition |
| `… n literal column(s) differ from the recording` | an option that changes what the server does (copy flags, scope, status, phase) | a captured timestamp or display string the server ignores. Say which |
| `a recorded table … matches no builder table` | the body leaves out a table the save carries (a child table such as item lines) | the table is built by code the parser can't read (a helper, a spread). Cite where |
| `` `<template>` does not follow k6-t<id>-… `` / `carries test id …` | a seeded record is named some other way, or with another test's id | the value is not a record name (a header, a window id, a search term). Say what it is |
| `no source/seeds script names its records with a k6-t<id>- config prefix` | always real: no seed creates this journey's records under its test id | none |
| `no source/seeds script names its records with the discovery prefix` | always real: the journey looks for records no seed creates | none |
| `<seed> has no seed probe` | always real: nothing reads the seed's records back beside NeoLoad's (`rules/probes.md`) | none |
| `data-script VU …: tree not found` | the population names a VU missing from this project export | the data script exists only at another version. Cite which |

## 3. Judgment checks the script can't make

Read the seed, its probe, and the wrappers and builders it calls (the path-scoped rules for those layers apply).
Check:

- **Prompt answers:** a prompt the data script answers is answered the same way (the same answer and the same
  answering body).
- **Read-sourced cells:** a saved cell that takes its value from a read takes it from the same read.
- **No replayed keys:** no captured key from the data script's recording is replayed.
- **Navigation** (a UI read the seed skips) is not a finding unless a saved value depends on it.
- **The finder:** the seed's top-up count reads its records through the prefix-filtered read the journey will
  discover them with (an event search, or a grid read with a `LIKE` filter on the prefix).
- **Seed probe:** every field in the `…IdentityFields` lists it skips really varies per record (a key, a name, a date,
  a pool pick, an account default). A skipped status or type field hides exactly the difference the probe exists to catch.
- **Seed volume** for a journey whose write takes the record out of its own pick list: compare the `SEED_COUNT`
  default with what the `neoload` profile consumes (VUs × run time ÷ pacing) and note a shortfall as an observation.

## 4. Report

Write `temp/claude/docs/seed-review-<feature>.md`, with the same structure as the journey review:

1. **Verdict**: `clean`, `minor findings` or `needs fixes`, with the data-script VU + version reviewed and the FLAG
   tally by verdict.
2. **FLAG triage**: one row per FLAG, in output order: `# | FLAG | Verdict | Reason`. Verdict is exactly one of
   **Real**, **Accepted** (a genuine difference, kept on purpose: say why it's safe) or **False positive** (the seed
   is correct and the script couldn't see it).
3. **Findings**: the Real rows plus any §3 issues, most severe first: `# | Severity | Issue | Evidence | Fix`
   (**High** = leaves different data or breaks under concurrency · **Medium** = diverges from the recording ·
   **Low** = convention), or `None.`
4. **Other observations**: one line each; leave the section out when there are none.
5. **Verified clean**: one line per area the script passed.
6. **Script gaps**: one line per False positive naming what `neoload-port-review.cjs` would need to recognise it;
   leave out when none.

Give the user the verdict line, the FLAG triage table (Reason kept to one short clause), any Findings and the report
path. Offer to hand fixes to an authoring session; don't apply them here.

**Fixes need re-verifying.** A change to the seed, its wrappers or builders needs a fresh `/seed main <feature> +3` run
and the §1 command again. A change to the finder also affects an already-ported journey, so it needs that journey's
3-step run too. A probe-only change needs `k6 inspect`.

## 5. Handover

End with exactly one next command, with its arguments filled in, to run after `/clear` (or in a new session):

- `clean` (or fixes landed and re-verified), journey not ported yet: `/perf-3-journey-port <journey VU>`.
- `clean`, journey already ported (a re-ported seed): `/verify-envs <journey scenario>`.
- Open High/Medium findings: say the next step waits for the fixes, and name it.
