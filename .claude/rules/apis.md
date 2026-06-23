---
paths: ["source/apis/**"]
---

# API Wrapper Conventions (`source/apis/`)

- `source/apis/<feature>.api.ts` — one module per API surface; thin wrappers around individual endpoints
- Feature names match the corresponding `source/types/<feature>.type.ts` module and the test file's feature area, so a reader can jump between wrapper, types, data, and test without guessing
- Wrappers import their payload builders from `source/data/` and their types from `source/types/<feature>.type.ts` — types are never defined inline here (see `rules/types.md`)
- Request authoring — tagging, header builders, correlation, checks, return contract, and polling — follows `rules/scripting.md`
