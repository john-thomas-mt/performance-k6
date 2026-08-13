---
paths: ["source/apis/**"]
---

# API Wrapper Conventions (`source/apis/`)

- `source/apis/<feature>.api.ts` — one module per API surface; thin wrappers around individual endpoints
- Feature names match the corresponding `source/utils/types/<feature>.type.ts` module and the test file's feature area, so a reader can jump between wrapper, types, data, and test without guessing
- Wrappers import their payload builders from the data barrel and their types from the types barrel — types are never defined inline here (see `rules/types.md`)
- Request authoring — tagging, header builders, correlation, checks, return contract, and polling — follows `rules/scripting.md`
- **An endpoint exercised by more than one journey exports its SLA here**, as `<endpoint>Thresholds` (a single `http_req_duration{name:Tag}` entry), and each consuming flow spreads it into its own `<journey>Thresholds` (see `rules/flows.md`). One endpoint gets one tag, one set of checks, and one number: when two flows each declared their own SLA for a shared tag, the spec's threshold merge silently kept whichever spread last and the surviving number was decided by import order rather than by intent. Spreading a single definition also keeps the per-journey gating working, since the flow still declares which endpoints its journey hits. A tag only one journey hits keeps its SLA in that flow
- Wrappers are re-exported through `source/utils/exports/apis.exp.ts` and consumed from it; a new wrapper module adds its `export *` line there (barrel pattern and cycle guard in `rules/exports.md`)
