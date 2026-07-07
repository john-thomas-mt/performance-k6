---
paths: ["source/**"]
---

# TypeScript Type-Authoring Style (`source/**`)

How to write types anywhere in `source/`, independent of which layer the file belongs to. Per-layer *organization* (where a type module lives, its barrel, cycle rules) is in `rules/types.md`; this file is about the *shape* of a type wherever it's declared.

- Prefer `type` aliases over `interface` for object shapes — uniform with the union/config types the repo already uses, and (being closed) a `type` gains an implicit index signature, so a JSON-parsed value of a pure-JSON shape casts with a single `as` (`res.json() as EventSaveResult[]`) instead of the `as unknown as` an `interface` forces. A shape with a non-JSON field (function, `Date`, class instance) still needs the `as unknown as` hop
- Write a string-keyed map as a named index signature — `{ [tableName: string]: string[] }`, not `Record<string, string[]>`. The key label (`tableName`, `columnIndex`, `header`) documents what the keys represent at zero type-checking cost, which `Record<string, V>` discards
