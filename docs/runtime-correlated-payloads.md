# Runtime-Correlated Save Payloads — Design & Risk Analysis

Whether to keep hardcoding the large captured `Save2` bodies (one frozen column table per entity) or
correlate them at runtime — fetch the form model the server itself returns, set only the business
fields, and post it back. This doc states the decision, analyses the two risks raised against it
(**performance-metric skew** and **lost bug-detection coverage**), backs the analysis with live-measured
evidence from PERF, then specifies the design and migration.

## The decision in one line

Replace the per-entity hardcoded column tables in `source/data/payloads/**/create.data.ts` with one
generic **fetch-initial → set-cells → save** path, because the Momentus server derives the extra
columns itself and accepts the lean fetched table — proven live — so the frozen tables add
maintenance cost and drift risk without buying measurement fidelity or bug coverage.

## Background — what a save payload is made of

Every `GenericDetailServer/Save2` is a positional array whose bulk is one serialized transport table
(`TransportDataColumns` schema + one `TransportDataRows` row). The web UI builds that table in two steps:

1. **Open the form** — `GetInitialData2` returns the full column schema plus a default row already
   populated with the server's defaults (event status `26`, price list, sensitivity, issue classes;
   account org / rep / `*AUTO` / designation).
2. **Save** — the client **materializes** extra columns onto that table, then posts `Save2`.

The materialization is a real, measurable delta:

| Entity  | `GetInitialData2` returns | Client `Save2` sends | Delta       |
| ------- | ------------------------- | -------------------- | ----------- |
| Account | 119 cols                  | 127 cols             | **+8, −0**  |
| Event   | 125 cols                  | 164 cols             | **+43, −4** |

The +columns are always the same _kinds_: computed/compound (`COMP_*`, `COMP_UF_*`, `cBOOKINGS`),
related-entity joins (`EventAccount_*`, `EvtExhib_*`, `Receivables_*`), and custom fields
(`cCUSTOM_FIELD_*`). These are **derived outputs, not inputs the save depends on.**

### Scope: create vs edit

This analysis and the live tests below are for the **create** scenario (`AddedRowKeys: ['10|-1']`,
id cell `-1`). The reliable create/edit discriminator is the row-key block — create uses
`AddedRowKeys` with `10|-1`; edit uses `ModifiedRowKeys` with the record's real `rowKey` and the real
id — **not** `SaveMode` (which is window-specific: create-event `7`, create-SO `0`, edit-event `4`,
edit-SO `0`). The runtime pattern generalizes to edit and is arguably a better fit there: fetching an
existing record returns its real populated row, so the 43 fields carry their real values for free and
only the changed cells are set; the one extra requirement is correlating the real `rowKey` into
`ModifiedRowKeys`.

## The three approaches compared

|                             | Real UI                  | Current k6 (frozen capture)                 | Proposed (runtime-correlated) |
| --------------------------- | ------------------------ | ------------------------------------------- | ----------------------------- |
| Form-open `GetInitialData2` | Yes (always)             | **No** — posts `Save2` directly             | Yes                           |
| Save column set             | Materialized (164 / 127) | Materialized, **frozen** from one recording | Lean fetched (125 / 119)      |
| Column schema source        | Live server              | Hardcoded ~1,300-line table                 | Live server (per run)         |
| Adapts to schema change     | n/a                      | No — breaks or goes stale silently          | Yes — always current          |

Two independent changes are bundled here, and the risk analysis must separate them:

- **Change A** — _adding the form-open fetch_ (proposed has it, current does not).
- **Change B** — _sending the lean column set instead of the materialized one_ (the 43/8 fewer columns).

The concern raised is about **Change B**. Change A is a separate realism improvement addressed below.

## Live evidence (PERF, 2026-07-10)

All figures measured directly, not estimated:

- **Lean save is accepted.** A `Save2` built from the lean `GetInitialData2` table with only the
  business cells set returned `ResultValue: 0` for both entities — account `00176092` (119 cols) and
  event `80295` (125 cols, vs the client's usual 164). The server does not require the materialized
  columns.
- **The lean-created record is correct.** Reading event `80295` back: `EVT_DESC`, `CUST_NBR`
  (`00159220`), `EVT_STATUS` (`26`) and the server-assigned `EVT_ID` all persisted, and the derived
  column `cSTART_DATE_TIME` (`1786266000000`) was **computed by the server** although it was never
  sent. Direct proof the materialized columns are server-derived.
- **Size.** Lean event save table ≈ **13.6 KB**; full 164-col ≈ **17.9 KB** — a **~4.3 KB (~31%)**
  difference on the save body. The form-open `GetInitialData2` response is ≈ **520 KB**.

## Risk 1 — does it skew performance metrics?

### Change B (43/8 fewer columns on the save)

**Verdict: negligible skew on the metric that matters.**

- **Upload bytes:** −4.3 KB per event save. In isolation tiny; against a full create round-trip
  (which in the proposed design also carries the ~520 KB form-open fetch) it is well under 1% of bytes
  moved. The suite's SLA target is server latency, not upload bandwidth, so this does not move the
  needle. If bandwidth saturation ever becomes an explicit test goal, revisit — it is not one today.
- **`http_req_duration{name:Save2}`:** dominated by server-side validation + DB insert + the server's
  own recompute of the derived columns (the server computes them regardless — proven by the
  `cSTART_DATE_TIME` read-back). Measured directly in the lean-vs-full A/B (event create, n=30 per
  variant, single warm sequential VU — see migration step 4): the lean save was **not** faster despite
  the smaller body; it ran **~0.2s slower at the median/p95** (lean median 1.48s / p95 1.72s vs full
  1.26s / 1.49s). Save cost is server-compute-bound, not upload-bound, and sending the pre-materialized
  columns saves the server a little recompute. The key metric-fidelity takeaway: the runtime/lean path
  **never _under_-reports save cost** — it reports equal-or-slightly-higher `Save2` latency, so it
  cannot make the system look faster than it is (both variants sit far inside the p95<5000ms SLA).

### Change A (adding the form-open fetch)

**Verdict: realism-positive, and isolated from the save metric.**

- Every real user opens the form (a ~520 KB `GetInitialData2` with real server-side assembly) before
  saving. The **current** suite skips it and therefore _under-generates_ per-create server load. Adding
  it makes the request sequence and server load **more** faithful, not less.
- It carries its own tag (`http_req_duration{name:...}`), so it never contaminates the `Save2` SLA
  metric. It does lengthen per-iteration duration and raise aggregate load — correctly.

**Net on performance:** the proposed design measures the save just as accurately and models the create
journey _more_ realistically. The one thing to keep honest is to tag the fetch separately (below).

## Risk 2 — does it miss bugs the extra fields would catch?

This is the more nuanced concern. Answered in three parts.

### The 43 fields themselves catch essentially nothing extra on a create

On a new blank record the materialized columns are null / empty / default (computed outputs, empty
UDFs, empty related-entity joins). They carry no meaningful input, so sending them exercises only the
server's handling of _empty_ derived columns. The read-back confirms the server computes the real ones
itself. So the incremental functional coverage from shipping the 43 columns on a create is close to
zero.

### There is a genuine, if modest, coverage change — name it honestly

- The proposed path exercises the **lean-table save**, which no real user issues (the UI always sends
  the materialized set). A server bug that triggers _only_ on the full payload (a parser quirk on a
  specific materialized column, a validation keyed on column count, a computed-column interaction)
  would be missed — and in principle the lean path could pass where the production path fails.
- **Drift signal trade-off.** A frozen capture can fail loudly when the save contract changes (a real
  drift signal, though it also goes stale silently). The runtime path **auto-adapts** to schema
  changes: fewer false reds, but it will not _surface_ a contract change on its own.

### Weigh against what this suite is for

These are **performance** tests plus a **drift gate**, not a functional-regression suite. Functional
correctness of a save (every field persisting, computed columns right) is owned by the QE UI-automation
suite. The k6 smoke's correctness role is narrow: does the script still correlate, and does the payload
still satisfy the server. For that purpose the losses above are acceptable — and mitigable.

## Can the extra fields be sourced dynamically?

A natural follow-up: rather than omit the 43 columns (proposed) or freeze them (current), could we
fetch their definitions at runtime and rebuild the exact materialized payload? The definitions **are**
discoverable — but harvesting them faithfully is strictly worse than both alternatives.

- **Source found:** the client assembles the materialized columns from `ObjectColumnCacheServer/GetObjectColumns`.
  The event object's catalog response contains the missing definitions (`cBOOKINGS`, `cCUSTOM_FIELD_*`,
  `cCOORDINATORS`, `EventAccount_*`, `EventContact_*`, `EventType_*`, `EvtExhib_*`). They are **not** in
  the `GenericDetailServer/GetInitialData2` response, nor in `GetWindowInfo` (484 bytes, routing metadata only).
- **Cost:** `GetObjectColumns` is called **~30 times** during one form load (one per object / related-entity /
  UDF set); 8 sampled calls already total **~5.3 MB** (the event catalog alone is ~1.1 MB; several are
  1.5–1.7 MB). The full load is ~10–20 MB.
- **Complexity:** each response is the object's **entire** column catalog (a superset of the 164), `d`-encoded
  (`d11`=name, `d19`=type, …). Rebuilding the save table means decoding that format **and** replicating the
  client's column _selection + `ColumnID` ordering_ — which is the materialization logic itself.

The clarifying point: dynamic sourcing only ever buys the _values_, which come from `GetInitialData2`
and are already handled. The extra columns' **definitions are stable** — they change only when Momentus
adds a field/UDF (a rare release event), so they never need to be dynamic. There is therefore no
dynamic route that beats either omitting the 43 (proposed) or, if one journey needs exact-UI parity,
freezing that single capture (legitimate precisely because the column _set_ is stable while values are
fetched). The fully-dynamic-faithful path is the worst of three worlds: multi-MB runtime data **plus**
`d`-format decoding **plus** reproducing the selection logic — to recreate columns the server does not
require and that are null/computed on a create.

## Accepted limitations & mitigations

| Limitation                                                 | Mitigation                                                                                                                                                                                      |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lean path is not the exact production save path            | Retain **one** representative journey (or a periodic check) that posts the full materialized capture, preserving production-path coverage.                                                      |
| Runtime fetch masks a save-contract change (no loud drift) | Add a lightweight **schema-contract check**: diff the fetched `TransportDataColumns` against an expected column set and `warn` on change — restores the drift signal without freezing the body. |
| Added fetch could contaminate the save SLA                 | Tag the form-open `GetInitialData2` separately; assert its own SLA; keep `Save2` thresholds clean.                                                                                              |
| "43 fields inert" argument is create-only                  | On **edit**, fetch returns the record's _real_ current values, so round-tripping them is correct by construction — edits are a stronger case for fetch-based, not a weaker one.                 |
| Claim rests on two entities                                | Before batch migration, run the lean-vs-full **A/B measurement** (Save2 latency + size, identical conditions) to confirm metric-neutrality empirically.                                         |

## How the edit path varies (and why it favours the runtime approach)

Verified live (event edit fetch) and against the repo's true edit `Save2`
(`service-orders/edit-general.data.ts`).

**Edit fetch (`GetInitialData2`, edit window):** same endpoint as create, with `wdwMode: 2`, the edit
window id, and the real record id in the context bag. The schema is ~98% the same (event: 125 cols both
ways) but **not identical** — two columns swap (edit surfaces `cEVT_STATUS`/`cEVT_STATUS__SORT`, create
carries `EV200_EXH_ISSUE_TYPE`/`_CLASS`) and the order differs — so an edit must fetch the _edit_ form,
not reuse a create template (a non-issue since the design fetches per-operation). The row comes back
**fully populated with the record's real values** (92/125 vs 54 defaults), and the response is ~3×
larger (1.65 MB vs 520 KB).

**Edit write (`Save2`):** the envelope skeleton is unchanged; three things differ from create:

1. Row keys — `ModifiedRowKeys: [rowKey]`, `AddedRowKeys: []` (create is the reverse, with `10|-1`).
2. A larger window bag carrying the full record identity, all correlated from the list row
   (`OrdAcct`, `EvtID`, `ExhibitorID`, `FuncID`, `InvoiceNbr`, `RowKeyList`, `OrderNbr`, …).
3. **Optimistic-concurrency stamps** — `ER100_ENT_DATE_ISO`/`UPD_DATE_ISO` must echo the record's
   _current_ stamps or the server rejects with `PrimaryKeyRecordChanged`.

The runtime approach absorbs most of this for free and is a **stronger** fit on edit than on create:

- The fetch returns the fully-populated real row, so nothing is hardcoded — only the edited cell(s)
  change. (Hardcoding an edit is worse than create: 92 live values vs 54 defaults.)
- The concurrency stamps arrive _in_ the fetched row, so round-tripping them is automatic — this
  **removes the dedicated `read_order_header_stamps` correlation step** the current edit uses.
- What still needs correlating is what is correlated from the list row today: the `rowKey` (into
  `ModifiedRowKeys`) and the identity fields in the window bag.

One heavier case to plan for: `service-orders/save.data.ts` adds line items via
`AdditionalTableKey…AddedRowKeys` (a nested child-table add) — more envelope complexity than a plain
header edit, though the same fetch-mutate-save shape applies to the child table.

## Search (`GetGridData2`) — the other large captured payload

Every journey searches before it edits, and the search payload is the other big captured structure
(events search = 407 lines). It embeds the **`dm*` saved-view block** — `dm17` is a positional
column-view array (`ObjectColumnID`, widths, sort) — plus the **recording user's id** hardcoded in
`dm9`/`dm11` (`JOEK`/`MARI`/`USISETTING`). This is the same class of frozen, drift-prone structure as a
`Save2` table; notably, the one real cross-version drift found in the NeoLoad→k6 work was a _positional
grid-column index shift at 25.3→25.4_ — i.e. exactly this `dm17` area.

Verified live (read-only) that `GetGridData2` **tolerates a fully lean payload**: dropping the entire
`dm*` block _and_ the saved-search identity (`ID`/`SearchID` → 0), leaving only the window bag and one
`SearchFilter`, still returns the correct row — the server resolves a **default column set** (15 cols
vs the saved view's 25). That default set contains **every column the `search_events` wrapper
correlates**, including `cROW_KEY` and `EV200_EVT_ID`.

So search is actually _simpler_ than the save path — it needs **no fetch at all**:

- A generic `gridSearchPayload(descriptor, filterColumnId, filterValue)` replaces each entity's
  hardcoded 300–400-line search literal.
- It **drops the drift-prone `dm17` positional column-view array** (the historical drift source) and
  **eliminates the hardcoded recording-user ids** — the server-resolved default view is more stable
  than a captured saved view.
- What stays per-entity is small and stable: the window id, the object id, and the filter column's
  `ObjectColumnID`.

This closes the request-type inventory: **`Save2`** (write) and **`GetGridData2`** (search) are the
only two types carrying large, drift-prone captured structures, and both are addressable — `Save2` by
runtime fetch-mutate-save, search by a lean filter-only payload. `GetInitialData2` detail opens are
already small requests; list opens are already generalized (`navigation.data.ts`); `GetWindowInfo` /
`CacheFiles` are tiny; document flows are just `Save2` + `GetInitialData2` + a small upload; auth is
handled by helpers; sales-ai is out of scope.

## Design

One generic path replaces the per-entity column tables.

```
1. GetInitialData2(windowDescriptor)   → server returns full schema + default row
2. set_cell(table, columnName, value)  → set only the business fields (name, account, dates)
3. Save2(save2Envelope(windowBag, table))
```

Building blocks (all generic, small):

- **`set_cell(table, columnName, value)`** in `transport.helper.ts` — the inverse of the existing
  `parse_grid_rows`; resolves `ColumnName → column index → Values[index]`. One helper, every entity.
- **`save2Envelope(windowBag, dataTables)`** — the positional skeleton + change-tracking block +
  refresh block, shared across entities (the Tier-1 dedup: the `SaveMode:7` / `AddedRowKeys` and
  `AutoRefresh` blocks are currently copy-pasted per entity).
- **A per-entity window descriptor** — like the existing `navScreens`:
  `{ windowId, editWindowId, windowObjectId, idKey, extraContext }`. A few lines per entity.
- **A fetch-initial wrapper** in `source/apis/<feature>.api.ts` (tagged separately) returning the
  table for the flow to mutate.
- **`gridSearchPayload(descriptor, filterColumnId, filterValue)`** — a single lean `GetGridData2`
  builder (window bag + one `SearchFilter`, no `dm*` view block) replacing each entity's 300–400-line
  search literal. No fetch needed.

What legitimately stays per-entity (and is small): the window descriptor values, and the **business
cells** each flow sets (name, account, dates) — the actual meaningful input, not the ~160 boilerplate
columns. Child entities (service orders) thread parent context through the window bag as a runtime
param, exactly as today.

What this removes: the ~1,300-line `create.data.ts` column tables, and most of the `payload-drift`
maintenance burden for saves (columns always match the live schema).

## Migration plan

Following the repo rule to move one file first and verify before a batch:

1. **[done]** Add the generic transport helpers. Landed `set_cell(table, columnName, value)` and
   `initial_data_table(res, name)` in `transport.helper.ts`. The shared `save2_envelope(head, windowBag,
table, changeTracking?)` (plus the shared `save2CreateChangeTracking` block and refresh block) was
   deferred through the accounts migration and **extracted at the events step** (step 5) — now that two
   entities share it, the seam is drawn from real variation: the per-entity bits are the 7-scalar
   positional `head` and the `windowBag`; the change-tracking (create) and refresh blocks are shared.
   Accounts and events both build their saves through it.
2. **[done]** Migrate **accounts** end to end: `open_account_create_form` fetch wrapper (tagged
   `OpenAccountCreateForm`), `create_account` now takes the fetched table, the create flow does
   fetch → set-cell → save, and the ~127-column hardcoded table in `accounts/create.data.ts` is
   deleted (replaced by `accountCreateFormPayload()` + `accountSavePayload(table, name)` setting only
   `EV870_NAME`; every load-bearing default arrives pre-populated in the fetched row).
3. **[done]** Verified — `tsc --noEmit` and `k6 inspect` clean, and the 3-step progressive run all
   PASS (PERF, 2026-07-13): 1 VU/1 iter 19/19 checks; 2×2 `USER_MODE=single` 58/58; 2×2
   `USER_MODE=pool` 58/58; `http_req_failed` 0%, no dropped iterations, no HTTP 0. Nine distinct
   accounts created, each verified present in its own search with matching code (per-user correlation
   isolates cleanly). Warm p(95): `OpenAccountCreateForm` ≈ 1.8–1.9s, `CreateAccount` ≈ 0.4–1.1s. The
   single-iteration cold run hit 5.49s on the ~520 KB form-open fetch (a cold-first-request artifact,
   well inside the 5000ms SLA once warm), so no threshold change was needed.
4. **[done]** Lean-vs-full A/B measured on PERF, 2026-07-13, using **event create** as the demanding
   case (+43 columns — the heaviest delta — with the existing 164-column frozen capture as the "full"
   arm). Both arms interleaved under one warm sequential VU (no serialization confound), the lean
   form-open fetch tagged separately so it never contaminates the save metric. n=30 per variant,
   100% success (ResultValue 0), `http_req_failed` 0%:

   |                | Lean (125 cols) | Full (164 cols)                            |
   | -------------- | --------------- | ------------------------------------------ |
   | `Save2` body   | 15,079 B        | 19,702 B (**~23% / ~4.6 KB smaller lean**) |
   | `Save2` median | 1.48s           | 1.26s                                      |
   | `Save2` p(95)  | 1.72s           | 1.49s                                      |

   **Result:** save latency is comparable and server-compute-bound — the lean save is _not_ faster
   despite the smaller body; it runs **~0.2s slower** at the median/p95 (the client-sent materialized
   columns save the server a little recompute). This refines the earlier "materially identical" wording
   but strengthens the conclusion: the runtime path never _under_-reports save cost, so it cannot skew
   metrics optimistically, and both arms sit far inside the p95<5000ms SLA. See the refined Risk 1
   (Change B) verdict above.

5. **[events done, SO pending]** Roll the pattern to events and service orders.
   - **Events (done, PERF 2026-07-13):** `open_event_create_form` fetch wrapper + `create_event` now
     takes the fetched table; `events/create.data.ts`'s ~164-column frozen table is replaced by
     `eventCreateFormPayload()` + `eventSavePayload(table, description)` (business cells only — the
     server defaults status 26 / price list / sensitivity / issue classes / designation arrive in the
     fetched row). Business values mirror the old capture so the **seed event is unchanged**; the seed
     (`service-orders.seed.ts`, the only prior consumer of `create_event`) now fetches then creates. A
     new `create_event` **journey** (`create-event.flow.ts`) was added and registered in the smoke
     gate. The shared `save2_envelope` was extracted here (see step 1). Verified: `tsc`/`k6 inspect`/
     ESLint clean; 3-step run all PASS (1×1 19/19; 2×2 single 58/58; 2×2 pool 58/58; `http_req_failed`
     0%, no HTTP 0). Warm p(95): `OpenEventCreateForm` ~2.2–2.5s, `CreateEvent` ~1.2–1.7s. Nine events
     created, each found in its own search with matching id.
   - **Service orders — edit header (done, PERF 2026-07-13):** the edit shape, confirmed the strongest
     fit for the runtime pattern. Live spike first proved the claim: the SO detail `GetInitialData2`
     (EM9158) returns a single **106-column ER100 header table** with `ER100_ORD_DATE` and the
     concurrency stamps already in the row; echoing it back with only `ER100_ORD_DATE` changed +
     `ModifiedRowKeys` returned `ResultValue 0` with the row modified. Migrated: `open_service_order_detail`
     now returns that header table (via `find_transport_table`), `edit_service_order_general` /
     `save_and_close_service_order` take the fetched table, `edit-general.data.ts` sets one cell and wraps
     the shared `save2_envelope` with an edit change-tracking block (`ModifiedRowKeys`), and the frozen
     ~111-column table **plus the entire `read_order_header_stamps` correlation step are deleted** — the
     stamps ride along in the fetched row. Verified: `tsc`/`k6 inspect`/ESLint clean; 3-step run all PASS
     (1×1 30/30; 2×2 single 102/102; 2×2 pool 102/102), **zero `PrimaryKeyRecordChanged`**, no HTTP 0.
     Warm p(95): `EditServiceOrderGeneral` ~0.37s, `SaveAndCloseServiceOrder` ~0.37s. (One transient
     server-side `CacheFiles` HTTP 500 on the unrelated document step cleared on re-run.)
   - **Service orders — add items / child table (done, PERF 2026-07-13):** the `AdditionalTableKey…`
     child-row add (`save.data.ts`, window EM9160) posted a header table **and** a 77-column line-items
     table adding catalog items (Cherry Pie / Cheesecake, items 217/216 with full rate/cost/tier data).
     **Key finding: this shape does not follow the server-recompute pattern.** A live spike proved a
     **lean item row** (identity + quantity, rates dropped) **fails deterministically** (`ResultValue 1`,
     "Problems Saving", reproduced) — unlike a header edit, a line item's rate/cost **is persisted
     business input**, sourced from the catalog at selection, not a derived output. So the runtime fix
     is "**fetch the catalog rows live**", not "send lean". The catalog load is a
     **`USIDataGridServer/GetGridData2` on ObjectID 457** (recovered from the
     `temp/captures/raw/pricelist-search-661.json` capture) carrying the SO identity context + one
     item-name `SearchFilter`; live-verified that a **lean version (no dm view block)** returns the
     catalog rows fully populated with tier rates, and that an **echoed fetched row saves directly**
     (`ResultValue 0`, item added — no 72→77 column reconciliation needed; the server accepts the
     fetched row as-is). Migrated: `orderItemCatalogPayload` (lean `GetGridData2`) + `load_order_item_catalog`
     wrapper + `pickCatalogItemRow` (pick by `CC716_SEQ`, set `cQUANTITY`); a shared
     `add_service_order_items` flow helper fetches the catalog per item, echoes the picked rows into the
     child table via `AdditionalTableKey`, and saves; the **frozen 77-column catalog table is deleted**
     (item identities 216/217 stay as business constants, like an account number). Both SO journeys
     (`service_order_items`, `edit_service_orders`) use it. Verified: `tsc`/`k6 inspect`/ESLint clean;
     `service_order_items` 3-step all PASS (1×1 18/18; 2×2 single 54/54; 2×2 pool 54/54) and the full
     `edit_service_orders` integration run 32/32; `http_req_failed` 0%, no `ResultValue 1`/HTTP 0/
     PrimaryKeyRecordChanged. Warm p(95): `LoadItemCatalog` ~0.29s, `SaveServiceOrderItems` ~0.7s. The
     items-save order **header** table stays a parameterized (identity-woven) frozen table — it carries
     no catalog data, so it is not a drift liability; the catalog data, which was, is now fetched.
   - Still to add: the schema-contract check, and the exact-path-coverage decision. Note the frozen
     event capture was the only exact-UI save actually exercised (via the seed); after this migration
     exact-path coverage remains through the still-frozen SO journeys until they migrate.
6. **[pending]** Replace the per-entity search literals with the lean `gridSearchPayload` builder
   (independent of the save work — no fetch, so it can land first if preferred). Verify each search
   still correlates the `cROW_KEY`/id it feeds downstream.

## Open decisions

- **Exact-path coverage:** keep one full-materialized journey, or rely on the QE UI suite? (Recommend
  keeping one.)

## Convention & tooling changes to make when promoting past POC

This work is a **proof of concept**: the accounts journey was migrated and verified, but the repo's
convention files (`.claude/rules/`, `.claude/skills/`, `.claude/agents/`, `CLAUDE.md`) were
**intentionally left unchanged**. The runtime-correlated pattern conflicts with, or extends, several
of them; when the pattern graduates from POC to the standard, these are the edits to make (recorded
here so nothing is lost):

- **`rules/data.md`** — the rule "weave every varying value into the literal at its own cell … never a
  post-build mutation of the row by column name" was written for **hardcoded literal** tables where the
  author owns the `ColumnID`s. A runtime-fetched table has an unknown column order at authoring time, so
  setting cells **by column name** via `set_cell(table, columnName, value)` is the only correct path and
  must be carved out as the sanctioned runtime-correlation exception (not the forbidden literal
  mutation). Add the exception paragraph and point it at `set_cell`.
- **`rules/scripting.md`** (Correlation) — currently frames correlation as weaving a `source` value
  into a literal cell by numeric `Values` key. Add the **fetch → set-cell → save** shape as the
  save-path correlation idiom: fetch the form model with `GetInitialData2`, resolve the table with
  `initial_data_table(res)`, set business cells by name with `set_cell`, post via `Save2`. Note the
  fetch carries its **own tag** so it never contaminates the `Save2` SLA metric.
- **`rules/helpers.md`** / transport helper — document `set_cell` and `initial_data_table` as the two
  generic transport-table helpers (inverse of / companion to `parse_grid_rows`), plus the shared
  `save2Envelope` skeleton once it is extracted at the events/SO step.
- **`rules/apis.md` / `rules/flows.md`** — record the **fetch-initial wrapper** shape: a
  `open_<entity>_create_form` wrapper posting `GetInitialData2` and returning the `TransportTable`, and
  a create wrapper that takes that table as a parameter; the flow threads the fetched table between the
  two numbered groups (as `create-account.flow.ts` now does with group 3 "Open Create Account Form").
- **`generate-test` and `neoload-to-k6` skills** — both currently script saves by pasting a captured
  `Save2` column table into `source/data/payloads/**/create.data.ts`. To adopt the runtime pattern they
  must instead author the fetch-mutate-save path (window descriptor + business-cell map, no frozen
  table). Search authoring likewise moves to the lean `gridSearchPayload` builder (step 6). Until then
  the skills still emit the old frozen-capture shape.
- **`CLAUDE.md`** — once the pattern is standard, the workflow prose ("script straight into `source/`
  wrappers + a `source/flows/` journey") should mention the runtime fetch-mutate-save path as the
  default for saves and searches, replacing the implicit "capture the full payload" assumption.

## Sources / evidence

- Live PERF tests, 2026-07-10: lean `Save2` accepted for account `00176092` and event `80295`
  (`ResultValue: 0`); read-back of `80295` confirming server-computed `cSTART_DATE_TIME`; column-count
  and byte-size measurements above.
- Live PERF read test, 2026-07-10: lean `GetGridData2` (no `dm*` block, `ID`/`SearchID` = 0) returned
  event `80295` by filter with a server-resolved 15-column default view containing all 8 columns the
  `search_events` wrapper correlates (incl. `cROW_KEY`).
- k6 request headers / correlation conventions: `.claude/rules/scripting.md`.
- Transport-grid parsing: `source/utils/helpers/transport.helper.ts` (`parse_grid_rows`).
