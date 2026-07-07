# Conversion Strategy & Roadmap — NeoLoad → k6

How the existing NeoLoad Enterprise suite gets converted to k6, and the plan to reach full coverage.
This doc carries the _why_ behind filtering a recording down to what matters, the per-journey conversion
method, the live migration tracker (backlog + status), the load model, and the phased roadmap.

## The core insight that makes this cheap

NeoLoad's maintenance policy is to **re-record each script per release** — which is why the NeoLoad tree
carries a full copy of every journey for every version (25.3 / 25.4 / 26.1 / 26.2). Analysis of that
tree found those per-version copies are **mechanical duplicates, not genuine re-recordings**: all API
requests had byte-identical recorded response code/time/size across versions (impossible for
independent recordings), and inter-version differences were purely mechanical (URL version segment,
per-version data-variable names, fresh UUIDs, whitespace). Across three releases the **only genuine
functional drift** was a single grid-column index shift — happening once at 25.3→25.4, then frozen.
NeoLoad re-records wholesale because it stores captured literal payloads with hand-mapped correlation
and cannot surgically patch one request.

k6 does not have that constraint. The strategy is therefore **parameterize, don't re-record**:

- Port each journey **once** as parameterized TypeScript.
- Handle the release version through **config**, not a duplicated script.
- Handle test data through **data files / seed scripts**, not embedded captures.
- Catch the rare real drift (like that column-index shift) with an automated **version-matrix check**,
  reading volatile values by name rather than fixed position where possible.

The result: what is four NeoLoad scripts per journey collapses to **one** k6 script. The suite shrinks
as it converts.

## Filtering a recording down to the transaction spine

A recording proxy captures **everything the browser fired** for a session — every CSS/JS/HTML-template
fetch, every image and font, every metadata/cache call, every telemetry ping — alongside the handful of
requests that are the operation under test. That is correct behaviour for a _recorder_; the mistake is
replaying all of it as the load model. As a worked example, the `T34_CopyServiceOrders` VU records ~149
HTTP requests across 8 steps:

| Category                                | Share      | Examples                                                                             | Replay in a backend load test? |
| --------------------------------------- | ---------- | ------------------------------------------------------------------------------------ | ------------------------------ |
| Static assets                           | ~13        | `Content/css`, `modernizr`, `favicon.ico`, logo `.svg`                               | No                             |
| SPA template/component fetches          | ~40        | `*.component.html`, `views/*.html`                                                   | No                             |
| Framework / UI-chrome API calls         | ~45        | `GetObjectColumns` (×31), `GetMenuItemsObject`, `GetWindowInfo`, notification counts | No                             |
| Real-time infra                         | 2          | `signalr/negotiate`, `signalr/start`                                                 | Generally no                   |
| **Functional server calls (the spine)** | **~10–15** | `SignIn`, `GetGridData2` (search), `SetSelectedSection`, the copy call, the `Save2`  | **Yes**                        |

Roughly 90% of the recording is browser bootstrap, SPA chrome, and static delivery. Only the last row is
the transaction under test.

### Two roles: static content vs application/API

The split that drives filtering is **what a request makes the server do**, not which box serves it.

- **Static-content role** — the server hands back a file that already exists on disk, byte-for-byte
  (CSS, JS bundles, SPA HTML templates, images, fonts). Near-zero work, identical for every user, highly
  cacheable.
- **Application/API role** — the server computes the response by running code: authenticate, query the
  DB, apply business rules, return JSON built on the fly. This is the path that consumes DB connections,
  CPU, locks, and memory — the path that falls over under load.

**In Momentus these are the same host.** Both a static asset and an API call go to
`performance.ungerboeck.net`, `sec-fetch-site: same-origin`, behind one AWS load balancer. There is no
separate CDN host — so the distinction is one of **role and cost**, not two machines.

| Signal           | Static asset                           | Transaction / API             |
| ---------------- | -------------------------------------- | ----------------------------- |
| Path             | `/Content/`, `/scripts/`, `/app/…html` | `/api/…`                      |
| Method           | `GET`                                  | `GET`/`POST`, returns JSON    |
| Response         | a file (css/js/html bytes)             | computed JSON from the DB     |
| Cacheability     | cached hard by the browser             | never cached — must be fresh  |
| Cost per request | ~free (serve bytes)                    | expensive (auth + DB + logic) |

The clinching tell is the cache-busting fingerprint: `GET /Content/css?v=59B7r7hHFh4…`. A `v=<hash>`
query means the file is cached effectively forever and only re-fetched when the hash changes on deploy —
the defining behaviour of a static asset. `SignIn` carries no such fingerprint because its response can
never be cached.

### What to keep

Keep the **functional writes** (`Save2`/create/update calls) and the **reads whose extracted values
feed a later write** — the search that yields the event/order id, the detail read that yields an
optimistic-concurrency token. Drop the rest. The load-bearing signal is NeoLoad's own
`<variable-extractor>` blocks: a read whose `C_…` value is consumed downstream stays; a read nothing
consumes is chrome. Check **consumption, not appearance** — a detail re-read that refreshes a
concurrency token is load-bearing even though nothing visible changed.

### Why replaying the rest is wrong (not just wasteful)

1. **It doesn't model real users.** A returning user serves static assets and SPA templates from browser
   cache; per-iteration replay re-fetches them every time, overstating asset load.
2. **It tells you nothing about the ceiling.** The capacity limit lives in the DB-backed `/api` path;
   loading up assets dilutes the signal from the requests that actually saturate.
3. **Third-party traffic shouldn't be tested at all.** Analytics/telemetry/auth calls to servers you
   don't own are excluded on principle.
4. **Maintenance.** Hundreds of replayed requests break on unrelated UI refactors for no analytical gain.

Filtering to the spine is right for **backend/API capacity testing** — this project's goal. Two cases
sit outside that default and are deliberate, separate scenarios if ever needed: full end-user experience
including front-end delivery (use a real browser-based test, not replayed static assets), and
shared-front-door contention (whether asset load starves the app tier at the shared ALB/TLS layer).

## How a single journey is converted

The repo encodes this as the `neoload-to-k6` skill — a static-first, AI-assisted port:

1. **Parse the NeoLoad tree** for that virtual user — its request XMLs and `<variable-extractor>`
   correlation blocks are the source of truth, so there is no need to re-record against the live app.
2. **Distil the transaction spine** (the section above) — a ~150-request recording becomes a ~10–15-call
   journey.
3. **Translate correlation** from NeoLoad's solved extractors into k6, reusing existing endpoint
   wrappers.
4. **Port the paired data script** (a NeoLoad `@u*` data-population VU) into a k6 seed script rather
   than folding provisioning into the journey.
5. **Verify** with the standard progressive run (1 VU → concurrent → different logins), then prove
   trickle-down across the live version matrix.

Live browser exploration is a **targeted fallback** only when a verify step fails on drift — never a
full re-record. This is what keeps the per-journey conversion cost low and largely AI-driven (see
[ai-assisted-authoring.md](./ai-assisted-authoring.md); the codebase the port targets is mapped in
[codebase-structure.md](./codebase-structure.md)).

## Migration tracker — backlog & status

The cross-reference between the NeoLoad virtual-user scripts and their k6 equivalents. The two sides
don't share a naming scheme, so this mapping can't be derived from either repo alone — it is maintained
here as a living tracker. **Source of truth for the flow set** is the NeoLoad `team/vus/` tree in the
sibling `performance` repo (the `@t*` journey VUs and `@u*` data-script VUs); when a VU is added or
retired there, update this table.

**How to read** — _Type_: `base` (transactional, higher VU weight) or `report` (analytical, spike
pattern), inferred from the flow name. _Seed_: the paired `@u*` data-script VU that provisions
prerequisite data (from the `@population_@test@data_@t*` mapping); blank means no dedicated data script.
_k6 status_: ✅ ported · 🟡 likely ported, mapping unconfirmed · ⬜ not started.

### Journeys (`@t*`)

| T#   | Flow                                 | Type    | Seed (`@u*`)            | k6 status                                         |
| ---- | ------------------------------------ | ------- | ----------------------- | ------------------------------------------------- |
| T01  | AccountCreation                      | base    | —                       | ⬜                                                |
| T02  | BookingEvent                         | base    | — (feeds U05/U07)       | ⬜                                                |
| T03  | ViewContact_ServiceOrder             | base    | —                       | ⬜                                                |
| T04  | CopyEvent                            | base    | —                       | ✅ `copy-event`                                   |
| T05  | PaymentReceiptReport                 | report  | —                       | ⬜                                                |
| T06  | BadgeReport                          | report  | —                       | ⬜                                                |
| T07  | DailyFunctionReport                  | report  | —                       | ⬜                                                |
| T08  | InvoiceEvents                        | base    | U01                     | ⬜                                                |
| T09  | PurchaseOrders                       | base    | —                       | ⬜                                                |
| T10  | VoucherProcessing                    | base    | U02                     | ⬜                                                |
| T11  | PaymentPlan                          | base    | U05                     | ⬜                                                |
| T12  | LaunchAndLogin                       | base    | —                       | 🟡 `login` (shared auth — confirm if this is T12) |
| T13  | DailyWorkOrderReport                 | report  | —                       | ⬜                                                |
| T14  | DetailGeneralLedgerReport            | report  | —                       | ⬜                                                |
| T16  | CopyPasteEventFunction               | base    | U07                     | ⬜                                                |
| T17  | EventRevenueMetricReport             | report  | —                       | ⬜                                                |
| T18  | SpaceUtilizationReport               | report  | —                       | ⬜                                                |
| T19  | OpportunityConversionReport          | report  | —                       | ⬜                                                |
| T20  | EditServiceOrders                    | base    | U05                     | ✅ `edit-service-orders`                          |
| T21  | AddPriceLists(ServiceOrders)         | base    | —                       | 🟡 `service-order-items` (confirm)                |
| T22  | Cut-PasteEventFunction               | base    | U07                     | ⬜                                                |
| T23  | DashboardOptimization                | base    | U09 (likely)            | ⬜                                                |
| T24  | DashboardWidgetOptimization          | base    | U09 (likely)            | ⬜                                                |
| T25  | EventsPageLoad_GeneralTab            | base    | U10                     | 🟡 `navigation` (confirm)                         |
| T26  | EventsPageLoad_ActivitiesTab         | base    | U10                     | ⬜                                                |
| T27  | EventsPageLoad_SearchInActivitiesTab | base    | —                       | ⬜                                                |
| T28  | Gadgets_Load                         | base    | —                       | ⬜                                                |
| T29  | MixedGadgets_Load                    | base    | —                       | ⬜                                                |
| T30  | CrystalReport                        | report? | —                       | ⬜ (strategy doc lists as 10-VU base — confirm)   |
| T31  | RoomDiagramFileStorage               | base    | U12 (azure-blob upload) | ⬜ (fixtures in `custom-resources/`)              |
| T32  | LaunchNewBrowserTab                  | base    | —                       | ⬜                                                |
| T33  | AddEventFromProfile                  | base    | —                       | ⬜                                                |
| T34  | CopyServiceOrders                    | base    | U13                     | ⬜                                                |
| T35  | ModifySOByBoothNumber                | base    | U16                     | ⬜                                                |
| T36  | CopyExhibitors                       | base    | —                       | ⬜                                                |
| T37  | EventOrderReport                     | report  | —                       | ⬜                                                |
| T38  | WorkOrderItemsListData               | base    | —                       | ⬜                                                |
| T39a | Jaarbeurs_Dashboard                  | base    | U09 (likely)            | ⬜ (customer-specific — confirm scope)            |
| T39b | Jaarbeurs_Dashboard_Widgets          | base    | U09 (likely)            | ⬜ (customer-specific — confirm scope)            |
| T40  | AppLaunchBenchmark                   | base    | —                       | ⬜ (micro-benchmark — confirm scope)              |
| T41  | StartupRPCBenchmark                  | base    | —                       | ⬜ (micro-benchmark — confirm scope)              |
| T42  | NotesListData                        | base    | —                       | ⬜                                                |
| T43  | DocumentsListData                    | base    | U18 (add documents)     | ⬜                                                |

_No T15 exists in the tree. T39 has two variants (dashboard + widgets)._

### Seed scripts (`@u*`) not yet mapped to a journey

| `@u*`                            | Purpose                  | Disposition                                                |
| -------------------------------- | ------------------------ | ---------------------------------------------------------- |
| U11_DataScript_DatadogTracking   | Datadog tracking         | Infra/telemetry util — likely does not port                |
| U14_DataScript_FetchEventDetails | Fetch event details      | Generic prerequisite — may feed several journeys; classify |
| U15_PatchControllerTimeout       | Controller timeout patch | Infra util — does not port                                 |
| U19_DataScript_CheckedOut        | Checked-out record state | Likely feeds T31 / T43 — confirm                           |

### Out of scope — sales-ai journeys

Momentus Assistant / sales-ai is a **separate initiative** from this NeoLoad Enterprise migration and is
deliberately kept out of this backlog and load model. These journeys are already ported and belong to
that separate scope — listed only so they aren't re-ported as if they were Enterprise `@t*` flows:
`opportunities`, `file-upload` (opportunity upload; ≠ T31 Enterprise room-diagram), `introductory-email`.

### Open decisions (resolve before finalizing the backlog)

1. **Scope-out candidates** — T40/T41 (micro-benchmarks) and T39a/T39b (Jaarbeurs customer-specific)
   are likely outside the standard suite. Confirming removes ~4.
2. **Tentative mappings** — confirm T12→`login`, T21→`service-order-items`, T25→`navigation`.
3. **T30 category** — report vs base; drives its VU weight in the load profile.
4. **Unmapped `@u*`** — which of U11/U14/U15/U19 are journey seeds vs infra utilities.

## The load model is reproduced, not reinvented

The performance strategy (owned by Perf Automation, on Confluence) defines two shapes the k6 suite must
reproduce:

- **A blended load suite** — 33 business flows, 3 batches, 5-min overlapping rotation, ~110 min total.
  Non-reporting flows run at a higher VU weight (ramp → steady → ramp-down); reporting flows run at a
  lower weight delivered as intermittent spikes during the steady state; ~100 VUs peak per batch. k6
  expresses this as scenarios in one entry file — which is also the performance-fidelity-correct way to
  model blended production load, not just a k6 convenience (see
  [k6-architecture-and-open-source.md](./k6-architecture-and-open-source.md)).
- **A progressive standalone** — a 7-phase progression (0→10→50→100 VUs, 30-min plateaus) for capacity
  read — which maps almost for free onto the single-journey run mode plus a progressive profile.

The sizing input (10 concurrent VUs/flow × 30-min steady) sets the seed-pool size for record-modifying
journeys that need globally-unique rows. Note the current `source/config/profiles.config.ts`
`load`/`stress` stages are placeholders that do **not** yet match these numbers.

### Current load-spec state

- `source/tests/smoke.spec.ts` — correctness/drift gate: every ported journey once. Registration target
  for each new journey (scenario + `exec` wrapper + `<journey>Thresholds`).
- `source/tests/load.spec.ts` — currently a **single-journey POC**: runs only `navigation` under
  `ramping-vus` from `loadProfile('load')`. The batch-rotation model (base-vs-report split, reporting
  spikes, 5-min batch overlap) is **not yet built** — that suite spec, composing all journeys, is the
  load-side deliverable this tracker feeds.

## Roadmap (phased)

| Phase                      | Goal                                            | Exit criteria                                                                                                                                 |
| -------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **1 — Foundation** (done)  | Prove the toolchain end-to-end                  | Repo, config, CI build gate, a first tranche of journeys ported and verified across the version matrix                                        |
| **2 — Backlog conversion** | Port the remaining `@t*` journeys + `@u*` seeds | Each journey passes the 3-step verify and the version-matrix sweep; tracker fully ✅; scoping decisions resolved                              |
| **3 — Load suite**         | Build the batch-rotation load spec              | Blended scenarios + reporting spikes wired to the strategy's load profile; runs on the CI agents                                              |
| **4 — Cutover**            | Retire NeoLoad as the source of truth           | k6 suite runs on schedule against the version matrix; results reporting in place; NeoLoad decommissioned and its license/SaaS spend recovered |

Each phase is independently valuable: even before cutover, the ported journeys run for free on owned
agents and are maintained by the AI-assisted verify loop rather than by re-recording.

## Why the migration itself is low-risk

- **Static-first**: the NeoLoad tree is a complete, offline specification of each journey — the port
  reads it rather than depending on live capture, so it is deterministic and reviewable.
- **Per-journey verify gate**: nothing is considered ported until it passes concurrency and multi-login
  correlation runs and the version-matrix sweep.
- **Incremental**: journeys convert one at a time into a suite that already runs; there is no big-bang
  switchover.
- **AI-assisted**: the repetitive work is driven by Claude against defined skills, keeping the human
  cost — and the calendar — down.

## Sources

- Conversion procedure — `neoload-to-k6` skill (`.claude/skills/`)
- Duplicate-per-version finding and the parameterize-don't-re-record rationale — project analysis of the sibling `performance` repo (NeoLoad `team/vus/` tree)
- Filtering rationale — k6 [load-testing websites guide](https://grafana.com/docs/k6/latest/testing-guides/load-testing-websites/), [scenarios](https://grafana.com/docs/k6/latest/using-k6/scenarios/), [browser module](https://grafana.com/docs/k6/latest/using-k6-browser/)
- Load model — performance strategy on Confluence; k6 mapping in [k6-architecture-and-open-source.md](./k6-architecture-and-open-source.md)
