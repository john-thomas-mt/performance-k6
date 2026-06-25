---
paths: ["source/utils/helpers/**"]
---

# Helper Conventions (`source/utils/helpers/`)

`source/utils/helpers/` holds cross-cutting modules that fit none of `apis/` (endpoint wrappers), `flows/`
(journeys), `types/`, `config/`, or `data/`. One module per concern, named `<concern>.helper.ts`; a module
lives by what it does (authentication wrappers, header building, version discovery, user selection, user-pool
decryption, shared payload transforms, and the like).

Placement conventions:
- Header builders have exactly one home here — add a new builder when a new API surface appears, and never inline headers at a call site.
- A transport-envelope transform (set/read cells by column name rather than positional index) is promoted here once it is shared by more than one `source/data/` builder, rather than duplicated in a module-local `data/<module>/helpers.ts`.
- Helpers that issue `http.*` follow the request-authoring rules in `rules/scripting.md`; helpers that don't are pure utilities.
