---
paths: ["source/utils/helpers/**"]
---

# Helper Conventions (`source/utils/helpers/`)

`source/utils/helpers/` holds cross-cutting modules that fit none of `apis/` (endpoint wrappers), `flows/`
(journeys), `types/`, `config/`, or `data/` — a module lives by what it does:
- `auth.helper.ts` — `signIn()`, `signInSession()`, `maAuthenticate()`: authentication request wrappers that mint the Momentus bearer token / sales-ai JWT
- `headers.helper.ts` — the only home for header builders (`buildHeaders` for the Momentus core API, `salesAiHeaders` for the sales-ai API); add a new builder here when a new API surface appears
- `version.helper.ts` — `fetchServerVersion()`: extracts the app `version` from `app85.cshtml`
- `users.helper.ts` — `pickUser()`: selects from the `SharedArray` user pool, honoring `USER_MODE`
- `payload.helper.ts` — transport-envelope transforms shared across `source/data/` builders (`setRowValue`, `setColumnValueAllRows`, `getColumnValue`): set/read `TransportTable` cells by column name rather than positional index. Lives here, not in a module-local `data/<module>/helpers.ts`, once a transform is used by more than one data module

Helpers that issue `http.*` (`auth.helper.ts`) follow the request-authoring rules in `rules/scripting.md`. Helpers that don't issue `http.*` (`users.helper.ts`, `payload.helper.ts`) are pure utilities.
