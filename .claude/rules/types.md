---
paths: ["source/types/**"]
---

# Type Module Conventions (`source/types/`)

- `source/types/<feature>.type.ts` — one type module per `source/apis/<feature>` surface
- `source/types/common.type.ts` holds cross-cutting types (auth/session/setup, the core-API transport envelope)
- Types live here only — never co-located in `source/apis/<feature>.api.ts`. Co-locating would create a cycle, since `source/data/` imports types and `source/apis/` imports `source/data/`
- No barrel `index.ts`; consumers import the specific feature file
