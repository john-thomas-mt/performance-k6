---
paths: ["source/**"]
---

# TypeScript Type-Authoring Style (`source/**`)

How to write types anywhere in `source/`, independent of which layer the file belongs to. Per-layer *organization* (where a type module lives, its barrel, cycle rules) is in `rules/types.md`; this file is about the *shape* of a type wherever it's declared.

- Prefer `type` aliases over `interface` for object shapes — uniform with the union/config types the repo already uses, and (being closed) a `type` gains an implicit index signature, so a JSON-parsed value of a pure-JSON shape casts with a single `as` (`res.json() as EventSaveResult[]`) instead of the `as unknown as` an `interface` forces. A shape with a non-JSON field (function, `Date`, class instance) still needs the `as unknown as` hop
- Write a string-keyed map as a named index signature — `{ [tableName: string]: string[] }`, not `Record<string, string[]>`. The key label (`tableName`, `columnIndex`, `header`) documents what the keys represent at zero type-checking cost, which `Record<string, V>` discards
- Type a parsed response with only the fields the code consumes as a named `type` — no `[key: string]: unknown` catch-all (a closed `type` already casts from `res.json()` with a single `as`, so the catch-all only hides real fields and reads as an `any`-dodge). Reserve a broad value type for data whose shape is genuinely runtime-dynamic: the transport-grid row `Values` is keyed by a stringified column index resolved at runtime from `TransportDataColumns`, so it's the shared `TransportValues` (a JSON-scalar named index signature), not a named-field shape. Prefer k6's `JSONValue` / `JSONObject` (imported from `k6`) over bare `unknown` for parsed JSON, and never reach for `any` — narrow a broad value with `typeof` / `Array.isArray` guards or an `x is T` predicate rather than an `as any` cast
- Let function return types infer rather than annotating them, unless a specific rule calls for the annotation (the `: TransportTable` data builders in `rules/data.md`) — and match the surrounding function's style rather than annotating one helper when its siblings rely on inference
