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
- If a wrapper is reused in different scenario contexts, accept the tag name as a parameter with a default (see `getOpportunities(jwt, name = 'GetOpportunities')`) so metrics stay separately tagged
- Headers are never inlined: use `buildHeaders(token, version)` for the Momentus core API and `salesAiHeaders(jwt)` for the sales-ai API (both from `source/utils/helpers/headers.helper.ts`)
- URLs are built from `config` values — never hardcode hosts or versions in a wrapper; the sales-ai `tenantId` is correlated from the session JWT (see Correlation), not `config`

## Correlation — never hardcode dynamic values
Every value the server generates must be extracted at runtime from a prior response:
- App `version` header → `fetchServerVersion()` (regex on `app85.cshtml`); throws if the page fetch fails or the `?v=` token is missing (no static fallback)
- Momentus bearer token (`<id>|<hex>`) → `signIn()` response
- Sales-ai JWT → `maAuthenticate()` response
- Sales-ai `tenantId` → decoded from the sales-ai JWT's `tenant_id` claim via `tenantIdFromJwt()`; throws if the claim is absent (no static fallback)
- `traceId` → upload/submit responses; reuse it for follow-up status requests
Client-generated values (`x-nonce`, `wsid`, sessionIds, timestamps) are produced fresh per request with `crypto.randomUUID()` / `new Date()`, never copied from a capture.

When a capture-derived payload template is reused for a *different* record (e.g. a templated detail/`Save2` body sent for another service order), re-correlate every **per-record-unique** field from the target row — overwrite it by column name (`setRowValue`), don't leave the captured value. A unique search key such as `ER100_SO_SEARCH` left at the captured order's value makes the server reject the save ("the value entered in the search field already exists for another order"). These fields read like static template data but are identity, not shape.

## Checks
- Every wrapper asserts on its own response with `check(res, {...})`
- Check labels are prefixed with the request tag name: `'SignIn: status is 201'`
- Assert at minimum: expected status code, and shape of the value the caller depends on (token present, JSON array, traceId present)

## Return contract
- Wrappers that extract a value return the extracted value, or `null` on failure — callers guard with early return
- List/GET wrappers may return the raw `res` when callers need the body
- On failure, log before returning: `console.error(`[VU ${__VU}] <wrapper> failed — HTTP ${res.status}`)` — always include the `[VU ${__VU}]` prefix

## Polling for async results
- Async server-side processing (AI extraction, queued jobs) is verified by polling a list/status endpoint with its own tag name (e.g. `PollOpportunities`), a fixed interval, and a hard `maxWaitSeconds` ceiling
- Match on a unique per-run token planted in the request payload; prefer fields the backend preserves verbatim (e.g. email addresses) over fields it normalises (e.g. event names)
