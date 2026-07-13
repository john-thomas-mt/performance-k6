---
name: payload-drift
description: Detect whether captured save payloads embedded in the data builders (today all `Save2`, but any captured write body applies) have drifted from what the live Momentus API now expects — by running the smoke test (all scripts, one iteration) and triaging failures. Use after a Momentus upgrade or config change, or when a test fails with server-side validation errors rather than correlation bugs.
---

# Validate payload drift

The committed `source/data/**.data.ts` builders embed captured save-payload templates. Every write in
the suite currently funnels through the one generic `GenericDetailServer/Save2` endpoint, so those
templates are `Save2` bodies today — but the same drift can hit any captured write body. When the QE
environment changes — a Momentus release, or a config change (UDF sets, layouts, price lists) — the
live API can start expecting a differently-shaped payload, and the embedded template goes stale.

**The detector is the test suite itself.** Running every script once against the live server is
authoritative: a stale payload makes the server reject the save, the check fails, and the failing
script names the builder to fix. This catches more than structure (correlation, auth, env) and needs
no separate tooling. The comparator scripts here are an *optional* pinpoint aid for the awkward case
where a save returns HTTP 200 with an error body.

## When to use
- After QE takes a Momentus release or a configuration change.
- When a journey starts failing with server validation errors (cryptic `ResultValue`, "column not
  found", range rejections) that aren't correlation breaks.
- As a pre-load sanity check that the embedded payloads still match the environment.

## Before starting
This sends real traffic to QE (VPN required). Tell the user before running, and take run approval
once for the whole sequence.

## 1. Run the smoke test
Run the full smoke suite via `k6-run-reporter` — hand it the command below and tell it the journeys create data, so its verdict names any failed save-success check (and the failing wrapper's logged `HTTP <status>`) without pulling the verbose summary into the main context:
```
k6 run source/tests/smoke.spec.ts
```
Every journey runs once (one iteration per k6 scenario). From the reporter's verdict:
- **All checks pass** → no drift. Done.
- **A check fails** → note which one. Check names are unique per journey, so a failure identifies the
  journey and step even though scenario logs interleave. The reporter saves the run log under `temp/` for the §2 body-level triage.

## 2. Triage a failure
A failed save-success check (e.g. `New event created`, `Service order items saved`) on a journey
whose login and reads passed points at **payload drift** in that journey's builder. A failure in the
login/read steps instead points at auth/correlation/env — out of scope here.

Confirm it's the payload: look at the failing write wrapper's logged `HTTP <status>` and response
body. A non-2xx, or a 200 whose body carries a `ResultValue` error, on the save request is the drift
signal. Today every write funnels through the generic `GenericDetailServer/Save2` endpoint, so that's
the usual culprit — but the same reasoning applies to any write wrapper carrying a captured payload
(e.g. a sales-ai manual-entry or file-upload post), so read the failing wrapper's own request rather
than assuming `Save2`.

## 3. (Optional) Pinpoint the structural change
When the save returns 200-with-error and the body doesn't say which field is wrong, diff the builder's
emitted body against a fresh recording. Re-capture the current payload for that action (drive the app via
the `generate-test` flow's exploration and save the request body to `temp/captures/raw/<name>.json`),
then:
```
# run the committed builder and print its emitted payload as JSON (use the exported builder name)
node .claude/skills/payload-drift/scripts/materialize-template.cjs source/data/payloads/<module>/<file>.data.ts <builderName> > temp/object.json

# shape-diff it against the fresh recording (exit 0 = clean, 1 = drift)
node .claude/skills/payload-drift/scripts/compare-payload.cjs temp/object.json temp/captures/raw/<name>.json
```
The diff ignores dynamic leaf values and reports only structure — added/removed fields and type
changes — naming the drifted column where the array carries a stable id field.

## 4. Fix the builder and re-verify
Update the affected `source/data/**.data.ts` builder:
- For a changed/added/removed field, regenerate the body from the fresh capture (never hand-transcribe
  a large payload), keeping each varying cell parameterized the way the builder already had it.
- Reconcile the parameterization: if a varying cell's column was renamed/removed, move it to the new
  column — and parameterize any new per-record-unique (identity) field by weaving the `source` value
  into its cell (the numeric `Values` key matching the column's `ColumnID`) in the table builder.

Then re-run `npx tsc --noEmit`, `k6 inspect source/tests/smoke.spec.ts`, and the smoke run again until
the checks pass.

## Notes
- This only works if each script asserts **body-level** save success, not just HTTP 200 — Momentus
  returns 200 on a failed save (`Save2` and its siblings alike). A status-only check lets drift pass
  green; fix the check first.
- `temp/` (captures, extracted JSON) is disposable scratch — wipe it freely afterward.
