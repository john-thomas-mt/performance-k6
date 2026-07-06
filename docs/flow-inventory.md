# Flow Inventory — NeoLoad → k6 Migration Tracker

The cross-reference between the NeoLoad virtual-user scripts and their k6 equivalents, used to
scope and track the port. The two sides don't share a naming scheme, so this mapping can't be
derived from either repo alone — it's maintained here as a living tracker.

- **Source of truth for the flow set:** the NeoLoad `team/vus/` tree in the sibling `performance`
  repo (the `@t*` journey VUs and `@u*` data-script VUs). When a VU is added or retired there, update
  this table — the folder listing is authoritative, this doc is the tracker.
- **Source of truth for the load model** (VU counts, ramp, reporting spikes, batch rotation): the
  performance-engineering strategy doc on Confluence. Its per-flow flow-count is stale; use `team/vus/`
  for the backlog and the strategy doc only for the load-profile shape. How that shape maps to k6
  scenarios is in [load-architecture-and-workload-modeling.md](./load-architecture-and-workload-modeling.md).
- **How a flow is ported:** the [`neoload-to-k6`](../.claude/skills/neoload-to-k6/SKILL.md) skill —
  distil the transaction spine (see [filtering-recorded-traffic.md](./filtering-recorded-traffic.md)),
  port the paired `@u*` seed into [`source/seeds/`](../source/seeds/), verify with the 3-step run,
  then prove trickle-down with the `verify-envs` skill.

## How to read

- **Type** — `base` (transactional, 10 VUs in the load profile) or `report` (analytical, 2 VUs, spike
  pattern). Inferred from the flow name; confirm against the strategy doc where flagged.
- **Seed** — the paired `@u*` data-script VU that provisions this journey's prerequisite data, from
  the `@population_@test@data_@t*` mapping in `team/populations/`. A blank means no dedicated data
  script (the flow reads existing snapshot data or creates its own inline).
- **k6 status** — ✅ ported · 🟡 likely ported, mapping unconfirmed · ⬜ not started.

## Backlog — journeys (`@t*`)

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

## Seed scripts (`@u*`) not yet mapped to a journey

| `@u*`                            | Purpose                  | Disposition                                                |
| -------------------------------- | ------------------------ | ---------------------------------------------------------- |
| U11_DataScript_DatadogTracking   | Datadog tracking         | Infra/telemetry util — likely does not port                |
| U14_DataScript_FetchEventDetails | Fetch event details      | Generic prerequisite — may feed several journeys; classify |
| U15_PatchControllerTimeout       | Controller timeout patch | Infra util — does not port                                 |
| U19_DataScript_CheckedOut        | Checked-out record state | Likely feeds T31 / T43 — confirm                           |

## Out of scope — sales-ai journeys

Momentus Assistant / sales-ai is a **separate scope** from this NeoLoad Enterprise migration and is
not mixed into this backlog or load model. These journeys are already ported and belong to that
separate initiative — listed here only so they aren't re-ported as if they were Enterprise `@t*` flows.

| k6 journey           | Surface                                                           |
| -------------------- | ----------------------------------------------------------------- |
| `opportunities`      | MA / sales-ai                                                     |
| `file-upload`        | MA / sales-ai (opportunity upload; ≠ T31 Enterprise room-diagram) |
| `introductory-email` | MA / sales-ai                                                     |

## Open decisions (resolve before finalizing the backlog)

1. **Scope-out candidates** — T40/T41 (micro-benchmarks) and T39a/T39b (Jaarbeurs customer-specific)
   are likely outside the standard suite. Confirming removes ~4.
2. **Tentative mappings** — confirm T12→`login`, T21→`service-order-items`, T25→`navigation`.
3. **T30 category** — report vs base; drives its VU weight in the load profile.
4. **Unmapped `@u*`** — which of U11/U14/U15/U19 are journey seeds vs infra utilities.

## Current load-spec state

- [`source/tests/smoke.spec.ts`](../source/tests/smoke.spec.ts) — correctness/drift gate: every
  ported journey once. Registration target for each new journey (scenario + `exec` wrapper +
  `<journey>Thresholds`).
- [`source/tests/load.spec.ts`](../source/tests/load.spec.ts) — currently a **single-journey POC**:
  runs only `navigation` under `ramping-vus` from `loadProfile('load')`. The batch-rotation model
  (base-vs-report split, reporting spikes, 5-min batch overlap) from the strategy doc is **not yet
  built** — that suite spec, composing all journeys, is the load-side deliverable this inventory feeds.
