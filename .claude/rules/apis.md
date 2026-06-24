---
paths: ["source/apis/**"]
---

# API Wrapper Conventions (`source/apis/`)

- `source/apis/<feature>.api.ts` — one module per API surface; thin wrappers around individual endpoints
- Feature names match the corresponding `source/utils/types/<feature>.type.ts` module and the test file's feature area, so a reader can jump between wrapper, types, data, and test without guessing
- Wrappers import their payload builders from the data barrel and their types from the types barrel — types are never defined inline here (see `rules/types.md`)
- Request authoring — tagging, header builders, correlation, checks, return contract, and polling — follows `rules/scripting.md`
- Wrappers are re-exported through `source/utils/exports/apis.exp.ts` and consumed from it; a new wrapper module adds its `export *` line there (barrel pattern and cycle guard in `rules/exports.md`)
