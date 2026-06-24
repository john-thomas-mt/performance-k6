---
paths: ["source/utils/types/**"]
---

# Type Module Conventions (`source/utils/types/`)

- `source/utils/types/<feature>.type.ts` — one type module per `source/apis/<feature>` surface
- `source/utils/types/common.type.ts` holds cross-cutting types (auth/session/setup, the core-API transport envelope)
- Types live here only — never co-located in `source/apis/<feature>.api.ts`. Co-locating would create a cycle, since `source/data/` imports types and `source/apis/` imports `source/data/`
- Re-exported through `source/utils/exports/types.exp.ts` and consumed from it; export names stay unique across the layer so `export *` never drops one (see `rules/exports.md`)
