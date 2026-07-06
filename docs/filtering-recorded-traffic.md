# Filtering Recorded Traffic to the Transaction Spine

Why a recorded virtual-user script (NeoLoad, or any record-and-replay proxy) captures far more than a load test should replay, and how to decide what to keep. This backs the [`neoload-to-k6`](../.claude/skills/neoload-to-k6/SKILL.md) conversion workflow, whose step 2 ("distill the transaction spine") applies the rule this doc explains. For where these filtered journeys then sit in a load run, see [load-architecture-and-workload-modeling.md](./load-architecture-and-workload-modeling.md).

## The problem: a recorder captures the whole browser, not the transaction

A recording proxy sits at the network layer and captures **everything the browser fired** for a session: every CSS/JS/HTML-template fetch, every image and font, every metadata/cache call, every telemetry ping, alongside the handful of requests that are the operation you set out to test. That is correct behaviour for a _recorder_ — it is not a bug, and it is not NeoLoad "doing it wrong." The mistake is replaying all of it verbatim as the load model.

As a worked example, the `T34_CopyServiceOrders` VU records ~149 HTTP requests across 8 steps. Categorized:

| Category                                | Share      | Examples                                                                                                                                                        | Replay in a backend load test? |
| --------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| Static assets                           | ~13        | `Content/css`, `scripts/modernizr`, `localforage.min.js`, `favicon.ico`, logo `.svg`                                                                            | No                             |
| SPA template/component fetches          | ~40        | `enterprise-dist/.../*.component.html`, `views/*.html`, `common.blocks/*.html`                                                                                  | No                             |
| Framework / UI-chrome API calls         | ~45        | `ObjectColumnCacheServer/GetObjectColumns` (×32), `GetMenuItemsObject`, `GetRecentlyUsedMenuItems`, `WindowServer/GetWindowInfo`, dashbar / notification counts | No                             |
| Real-time infra                         | 2          | `signalr/negotiate`, `signalr/start`                                                                                                                            | Generally no                   |
| **Functional server calls (the spine)** | **~10–15** | `GenericServer/SignIn`, `UsiDataGridServer/GetGridData2` (search), `SetSelectedSection`, the copy call, the `Save2`                                             | **Yes**                        |

Roughly 90% of the recording is browser bootstrap, SPA chrome, and static delivery. Only the last row is the transaction under test.

## Two roles: static content vs application/API

The split that drives filtering is **what a request makes the server do**, not which box serves it.

- **Static-content role** — the server hands back a file that already exists on disk, byte-for-byte: CSS, JS bundles, SPA HTML templates, images, fonts. Near-zero work (read file, send bytes), identical for every user every time, and highly cacheable.
- **Application/API role** — the server computes the response by running code: authenticate the user, query the database, apply business rules, return JSON built on the fly. The response depends on who you are, what you asked, and current data. This is the path that consumes DB connections, CPU, locks, and memory — the path that falls over under load.

**In Momentus these are the same host.** Both a static asset and an API call go to `${P_Performance_Host}` (`performance.ungerboeck.net`), `sec-fetch-site: same-origin`, behind one AWS load balancer (`AWSALB` cookie). There is no separate CDN host — so the distinction here is one of **role and cost**, not two different machines. The load balancer may route `/Content/*` and `/api/*` to different target groups, but either way the work profile differs enormously.

### Telling them apart in a recording

| Signal           | Static asset                           | Transaction / API             |
| ---------------- | -------------------------------------- | ----------------------------- |
| Path             | `/Content/`, `/scripts/`, `/app/…html` | `/api/…`                      |
| Method           | `GET`                                  | `GET` or `POST`, returns JSON |
| Response         | a file (css/js/html bytes)             | computed JSON from the DB     |
| Cacheability     | cached hard by the browser             | never cached — must be fresh  |
| Cost per request | ~free (serve bytes)                    | expensive (auth + DB + logic) |

The clinching tell is the cache-busting fingerprint: the Momentus CSS request is `GET /Content/css?v=59B7r7hHFh4…` (NeoLoad stored the hash as `${C_css_version}`). A `v=<hash>` query means the URL is built so the browser caches the file effectively forever and only re-downloads when the hash changes on deploy — the defining behaviour of a static asset. `SignIn` carries no such fingerprint because its response can never be cached.

## What to keep: the transaction spine

Keep the **functional writes** (the `Save2`/create/update calls) and the **reads whose extracted values feed a later write** — the search that yields the event/order id, the detail read that yields an optimistic-concurrency token. Drop the rest.

The load-bearing signal is NeoLoad's own `<variable-extractor>` blocks: a read whose `C_…` value is consumed by a downstream request stays; a read nothing consumes is chrome. Do not drop a read just because it looks like a repaint — a detail re-read that refreshes a concurrency token is load-bearing even though nothing visible changed. Check consumption, not appearance.

## Why replaying the rest is wrong (not just wasteful)

1. **It doesn't model real users.** A returning user serves static assets and SPA templates from browser cache — they don't re-request `modernizr.js` or `toast.component.html` on every action. Per-iteration replay re-fetches them every time, **overstating** asset load in a way no real session produces.
2. **It tells you nothing about the ceiling.** Serving a cached CSS file was never going to break; the capacity limit lives in the DB-backed `/api` path. Loading up the assets dilutes the signal from the requests that actually saturate.
3. **Third-party traffic shouldn't be tested at all.** Analytics/telemetry/auth calls to servers you don't own are excluded on principle — don't load-test infrastructure that isn't yours.
4. **Maintenance.** Hundreds of replayed requests break on UI refactors unrelated to the API under test, for no analytical gain.

## The decision is goal-driven

Filtering to the spine is right for **backend/API capacity testing** — this project's goal. Two cases sit outside that default:

- **Full end-user experience, including front-end delivery.** Don't chase this by replaying recorded static assets — protocol replay models cache, request parallelism, and render timing incorrectly anyway. Use a real browser-based test (k6's browser module), or include a _representative, batched_ subset of assets only for a deliberate cold-cache first-load scenario.
- **Shared-front-door contention.** Because Momentus serves assets and API from the same origin, asset traffic does share the ALB, TLS termination, and network with the app tier. If you specifically want to know whether asset load starves the app tier at that shared layer, that is a deliberate, separate scenario — not something folded into a transaction capacity test.

## How this maps to this repo

The [`neoload-to-k6`](../.claude/skills/neoload-to-k6/SKILL.md) workflow already encodes this: parse the NeoLoad tree, then distill to the spine — drop asset/telemetry/UI-chrome, keep the writes and the reads that feed them, using the `<variable-extractor>` blocks to tell which reads are load-bearing. A ~150-request recording becomes a ~10–15-call k6 journey. This doc is the _why_ behind that step; the skill is the _how_.

## Sources

- https://grafana.com/docs/k6/latest/testing-guides/load-testing-websites/
- https://grafana.com/docs/k6/latest/using-k6/scenarios/
- https://grafana.com/docs/k6/latest/using-k6/http-requests/
- https://k6.io/hybrid-performance-testing/
- https://grafana.com/docs/k6/latest/using-k6-browser/
