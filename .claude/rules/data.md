---
paths: ["source/data/**"]
---

# Data & Fixture Conventions (`source/data/`)

## Layout
Data is organized first by module (with a sub-module level when a module has several flows),
mirroring `source/apis/` and the app nav (`#/momentusAssistant/<page>`), then by kind:

```
source/data/
  users.data.ts                     # cross-cutting user pool — root, never module-scoped
  <module>/*.data.ts                # request-body data for that module's flows
  <module>/<sub>/*.data.ts          # add a sub-module level only when a module needs it
  <module>/helpers.ts               # optional module-local helper shared by that module's builders
  uploads/<module>/<sub>/           # files fed to http.file()
```

Module (and sub-module) names match the corresponding `source/apis/<feature>.api.ts` wrapper and the
test file's feature area, so a reader can jump between wrapper, data, and test without guessing.

## Request-body data — `source/data/<module>/`
Request bodies are **TS object builders**, never `.json`/`.txt` templates loaded via `open()`:
- Export a function that takes the runtime-varying values as parameters (e.g. `runToken`, a
  correlated row) and returns the payload object/array — `manualEntryPayload(runToken)`,
  `copyFormPayload(encUserId, source)`, `searchPayload(searchValue)`.
- Per-iteration uniqueness is interpolated inside the builder (template literals), not by
  `{{runToken}}` string substitution on opened text.
- Builders may import from `source/types/<feature>.type.ts` (or `source/types/common.type.ts`) and carry logic. They stay in `source/data/`, not elsewhere in `source/`.
- Logic shared across a single module's builders lives in a module-local `helpers.ts` (e.g. `source/data/events/helpers.ts` for `todayMidnightUtc`). Once a transform is shared across more than one data module, promote it to `source/helpers/payload.helper.ts` (transport-envelope cell setters/readers, e.g. `setRowValue`) rather than duplicating it per module — see `rules/helpers.md`.
- Callers import and call the builder directly in the VU function — no init-context `open()`.

## Upload fixtures — `source/data/uploads/<module>/<sub>/`
Anything passed to `http.file()` goes here, never in the request-body folders:
- Opened by literal path in the init context: `open('../data/uploads/<module>/<sub>/<file>')`
- Binary fixtures (pdf, images, xlsx) must use binary mode: `open(path, 'b')`
- Name fixtures for their content, not the consuming test (e.g. `sample-opportunity.txt`)

## User pool — `source/data/users.data.ts`
- A TS module exporting `users: User[]`; gitignored — holds QE accounts, never committed.
- Imported and wrapped in `SharedArray` so it's parsed once and shared across VUs:
  `import { users as userData } from '../data/users.data.ts';`
  `const users = new SharedArray<User>('users', () => userData);`
- Picked with `pickUser(users)` from `source/helpers/users.helper.ts`.

## Loading rules
- Request-body builders and the user pool are imported as TS modules — no `open()`.
- `open()` is reserved for `source/data/uploads/**` fixtures and is init-context only — never inside
  the VU function (see `rules/tests.md`).
