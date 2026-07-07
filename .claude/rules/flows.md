---
paths: ["source/flows/**"]
---

# Flow Conventions (`source/flows/`)

- `source/flows/<flow>.flow.ts` — multi-request journeys composed from `source/apis/` wrappers and `source/utils/helpers/auth.helper.ts`; flows never issue `http.*` directly
- `login.flow.ts` is the shared entry point: `loginToMomentusAssistant(user, version)` owns journey groups 1–2 and returns the session `{ bearerToken, salesAiJwt }`; `loginToEvents(user, version)` returns `{ bearerToken, encUserId }`
- **Each user journey lives here** as `source/flows/<journey>.flow.ts`, exporting one `<journey>Journey(user, data, ...)` function that owns the whole journey: it calls the relevant `login.flow.ts` entry, then its own numbered groups (starting at 3), checks, and a closing `sleep`. The test specs under `source/tests/` (the smoke aggregate, and any load test) call this one function via their `exec` wrappers — journey logic is never duplicated outside the flow
- A feature flow imports `login.flow.ts` by its direct path (`./login.flow.ts`), not the flows barrel — same-layer peers import directly (see `rules/exports.md`)
- Init-context-only inputs (an `open()`ed upload template) can't be read inside a flow — the caller opens them in the init context and passes them into the journey function as a parameter
- Setup discovery used by a test's `setup()` (e.g. discovering a seeded pool) lives as an exported helper in the relevant flow
- A flow also exports its journey's per-endpoint SLAs as `<journey>Thresholds` — a `Record<string, string[]>` of `http_req_duration{name:Tag}` entries for the endpoints it exercises (`login.flow.ts` exports `loginThresholds` for the auth endpoints). The flow owns these because it defines which endpoints the journey hits; the smoke test merges them for the journey(s) it runs (see `rules/tests.md`). Keep the export name unique across the layer for the barrel
- A flow wraps each composed step in its own numbered `group('N. Step', ...)` and calls its wrappers directly — a wrapper aborts the iteration itself on a genuine failure (see `rules/scripting.md`), so flows carry no per-call guard and no echo `check()`; a returned value is consumed straight (`const doc = openDocumentForm(...)`), a `void` command just runs. A flow adds a `check()` — paired with `fail()` when the step is a required prerequisite — only for a journey-level judgment it computes from a query result (a specific row present in a returned list, a saved id match)
- Correlated values and the return-guard contract follow `rules/scripting.md`
