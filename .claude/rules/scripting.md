---
paths: ["source/apis/**", "source/flows/**", "source/utils/helpers/**"]
---

# Request Scripting Conventions (`source/apis/`, `source/flows/`, `source/utils/helpers/`)

Cross-cutting rules for the request-making layer. `apis/` wrappers and the `http.*`-issuing helpers
(`auth.helper.ts`, `version.helper.ts`) follow all of the below. `flows/` compose those wrappers — they don't
call `http.*` themselves, but they thread correlated values through and guard on wrapper return
values, so the Correlation and Return-contract sections apply to them too. Per-folder layout lives in
each folder's own rule file (`rules/apis.md`, `rules/flows.md`, `rules/helpers.md`).

## Requests
- Every `http.*` call carries `tags: { name: 'PascalCaseName' }` — this drives per-endpoint thresholds (`http_req_duration{name:...}`)
- If a wrapper is reused in different scenario contexts, accept the tag name as a parameter with a default (see `get_opportunities(jwt, name = 'GetOpportunities')`) so metrics stay separately tagged
- Headers are never inlined: use `build_headers(token, version)` for the Momentus core API and `sales_ai_headers(jwt)` for the sales-ai API (both from `source/utils/helpers/headers.helper.ts`)
- URLs are built from `config` values — never hardcode hosts or versions in a wrapper; the sales-ai `tenantId` is correlated from the session JWT (see Correlation), not `config`

## Correlation — never hardcode dynamic values
Every value the server generates must be extracted at runtime from a prior response:
- App `version` header → `fetch_server_version()` (regex on `app85.cshtml`); throws if the page fetch fails or the `?v=` token is missing (no static fallback)
- Momentus bearer token (`<id>|<hex>`) → `sign_in()` response
- Sales-ai JWT → `ma_authenticate()` response
- Sales-ai `tenantId` → decoded from the sales-ai JWT's `tenant_id` claim via `tenant_id_from_jwt()`; throws if the claim is absent (no static fallback)
- `traceId` → upload/submit responses; reuse it for follow-up status requests
Client-generated values (`x-nonce`, `wsid`, sessionIds, timestamps) are produced fresh per request with `crypto.randomUUID()` / `new Date()`, never copied from a capture.

Momentus **window-session ids** (`wdwid`/`EditWdwID`, format `SA<digits>`) are client-generated the same way: the client allocates them and sends them in the request, and the server merely echoes them back in its response context. Generate them per iteration (unique per window), never extract them from a response even though they appear there. The one server-derived value in that flow is `ContextObjectID`: `WindowServer/GetWindowInfo?astrWindowID=<wdwid>` takes the client-held wdwid and returns it, so that one you do extract.

When a capture-derived payload template is reused for a *different* record (e.g. a templated detail/`Save2` body sent for another service order), re-correlate every **per-record-unique** field from the target row — weave the `source` value into its cell in the table builder (the numeric `Values` key matching that column's `ColumnID`), don't leave the captured value. A unique search key such as `ER100_SO_SEARCH` left at the captured order's value makes the server reject the save ("the value entered in the search field already exists for another order"). These fields read like static template data but are identity, not shape.

When you re-send a transport table **echoed from a `CreateNewRows`/read response** into a grid `Save2`, the
response encodes every cell as a **string**, but the grid `Save2` requires each column's **native type**
(Int32/Decimal/DateTime as numbers). Coerce the echoed row to its column `DataType` (`coerce_transport_types`)
before sending — the browser type-coerces implicitly, so a raw string echo fails server-side validation.

## Checks
- Every wrapper asserts on its own response with `check(res, {...})`
- Read a response body as text with `body_text(res)` (helpers barrel), never `res.body` directly — k6 types `body` as `string | ArrayBuffer | null`, so stringifying it in a template or calling `.includes()`/`.match()` on it raw trips the `no-base-to-string` lint rule; `body_text` narrows it to a string
- Check labels are prefixed with the request tag name: `'SignIn: status is 201'`
- Assert at minimum: expected status code, and shape of the value the caller depends on (token present, JSON array, traceId present)
- On a genuine failure — bad status/shape, an unmet expectation, or a poll timeout — the wrapper records the failed `check` and then aborts the iteration with `fail(...)` (see Return contract). The `check` runs *before* the `fail` so the failure lands in the `checks` metric and trips the threshold — `fail()` alone would abort silently without failing the test. A flow does **not** re-check a wrapper's outcome; the wrapper owns its own assertion. Because k6 groups are dynamic-scope, a wrapper's checks called inside `group('N. …', …)` already inherit that group's tag, so per-step attribution is automatic
- A flow adds its own `check()` only for a journey-level judgment the wrapper cannot make — one computed in the flow from a query's returned data (a specific row is present in a list, a saved id matches). When that judgment is also a required prerequisite, pair it with a `fail()`: `if (!check(null, { 'Source event found': () => Boolean(source) })) fail('source event not found')`

## Return contract
- A wrapper `check`s its response and, on a genuine failure, aborts the iteration with `fail(...)` — it never returns a `null` failure sentinel. On success it returns the value the caller consumes for correlation or a downstream call, or **nothing** (`void`) when the caller only needed the step to succeed (the return type reflects this: a consumed value, or `void` for a gate-only command). `fail()` aborts only the current iteration — the VU proceeds to its next iteration, and a genuinely-failed iteration aborting is correct. This keeps a broken journey from silently completing as a partial iteration that under-generates load. The pass/fail *verdict* comes from thresholds (`checks`, `http_req_failed`), not from `fail()`
- **Queries are the exception:** a list/GET wrapper reused across tolerant or retry contexts (e.g. the poll loop retries `get_opportunities` on a transient non-200) records its `check` and returns its result — a possibly-empty list or the raw `res` — rather than failing. "Is the row/data I need present?" is then a journey-level judgment the flow makes (see Checks)
- `setup()` uses `throw` (not `fail`) — a setup failure aborts the whole run, whereas `fail()` is scoped to a VU iteration; a wrapper called from `setup()` that `fail()`s still propagates as a run-aborting throw
- On failure, log before aborting: `console.error(`[VU ${__VU}] <wrapper> failed — HTTP ${res.status}`)` then `fail(...)` — always include the `[VU ${__VU}]` prefix
- Declare an optional *input* as `param?: T`; reserve `| null` for fields the server sends as JSON `null`. A `param: T | null = null` that's only truthiness-checked is just an optional argument — use `?`.

## Polling for async results
- Async server-side processing (AI extraction, queued jobs) is verified by polling a list/status endpoint with its own tag name (e.g. `PollOpportunities`), a fixed interval, and a hard `maxWaitSeconds` ceiling
- Match on a unique per-run token planted in the request payload; prefer fields the backend preserves verbatim (e.g. email addresses) over fields it normalises (e.g. event names)
