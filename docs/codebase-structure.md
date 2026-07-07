# Codebase Structure

How the k6 test suite under `source/` is organized: the layers, what each is responsible for, how they
depend on one another, and how a single run flows through them. This is the map for anyone reading or
extending the repo. It describes the _architecture and naming patterns_ — the folders themselves are the
authoritative list of what exists, and the coding conventions for each layer live in `.claude/rules/`
(auto-loaded when editing that layer), not restated here.

## At a glance

A performance run is a stack of thin layers, each with one job:

- A **test spec** picks which journeys to run and how (VUs, iterations, thresholds).
- A **flow** is one user journey — login, then a sequence of named steps.
- An **API wrapper** is one endpoint call, with its tag, headers, correlation, and checks.
- **Helpers, data, config, and types** are the supporting inputs every request needs.

Nothing skips layers: a flow never makes a raw HTTP call, and a wrapper never hardcodes a host or a
version. That discipline is what keeps the suite maintainable and AI-authorable (see
[ai-assisted-authoring.md](./ai-assisted-authoring.md)).

## The layers and their dependency order

Dependencies point one direction — leaves first, entry points last:

```
config / types   (leaves — env values, load profiles, per-feature types)
      ↓
   helpers        (auth, headers, crypto, version, users — cross-cutting)
      ↓
    data          (request-body builders, upload fixtures, user pool)
      ↓
    apis          (one thin wrapper per endpoint surface)
      ↓
    flows         (composed user journeys; login owns the auth groups)
      ↓
 tests / seeds    (entry points k6 runs directly)
```

| Layer   | Folder                  | Responsibility                                                                                                                              | Naming pattern                        |
| ------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Config  | `source/config/`        | Environment values (derived per site/env) and load profiles + common thresholds                                                             | `env.config.ts`, `profiles.config.ts` |
| Types   | `source/utils/types/`   | Per-feature TypeScript types; also the version-matrix source of truth                                                                       | `<feature>.type.ts`                   |
| Helpers | `source/utils/helpers/` | Cross-cutting modules that fit no other layer — auth, header building, crypto, runtime version, user pool                                   | `<concern>.helper.ts`                 |
| Data    | `source/data/`          | Request-body builders (`payloads/`, feature-grouped), file fixtures (`uploads/`), and the committed user pool (`creds/`)                    | `<thing>.data.ts`                     |
| APIs    | `source/apis/`          | One thin wrapper per endpoint surface — issues the `http.*` call, tags it, checks it, extracts correlated values                            | `<feature>.api.ts`                    |
| Flows   | `source/flows/`         | One composed journey per file; calls the shared `login.flow.ts`, then its own numbered groups; also exports its per-endpoint SLA thresholds | `<journey>.flow.ts`                   |
| Tests   | `source/tests/`         | Entry-point specs that drive one or more journeys via k6 `scenarios`; each `exec` is a thin wrapper calling a flow                          | `<name>.spec.ts`                      |
| Seeds   | `source/seeds/`         | Bulk prerequisite-data scripts run once after a snapshot reset, reusing the API wrappers                                                    | `<feature>.seed.ts`                   |

The authoritative, up-to-date contents of each folder are the folder listings themselves; the table
describes the _shape_, not an inventory.

## Imports go through one barrel per layer

Every cross-folder import goes through a barrel in `source/utils/exports/` — one `<layer>.exp.ts` per
layer — so importing a layer's members costs a single line. A module reaches _lower_ layers through
their barrels and reaches a _same-layer_ peer by its direct file path (keeping the barrel out of any
same-layer cycle). Entry-point folders (`tests/`, `seeds/`) have no barrel — nothing imports them; k6
runs their files directly. The full rule (including why k6 forces relative full-`.ts`-extension paths
and how export-name uniqueness is preserved) is in `.claude/rules/exports.md`.

## How a run flows through the layers

A concrete trace, top to bottom:

1. **`k6 run source/tests/smoke.spec.ts`** — the spec defines a k6 `scenario` per journey; each
   scenario's `exec` wrapper calls one flow's journey function. `setup()` decrypts the user pool once
   and correlates the live app version.
2. **The flow** (e.g. `login.flow.ts` → a feature flow) calls the shared login entry, which owns the
   numbered auth groups and returns the session tokens, then runs its own numbered `group()` steps.
3. **Each step calls an API wrapper**, which builds its URL from `config`, its headers via the header
   helper, sends the tagged `http.*` request, `check()`s the response, and returns the correlated value
   (or `null`, which the flow guards on).
4. **Supporting inputs** — the request body from a `data/payloads/` builder, types from
   `utils/types/`, credentials from the decrypted pool — feed in from the leaf layers.

The same flow functions are reused by every entry point: the smoke aggregate runs each once as a
correctness/drift gate; a load spec runs them under a `loadProfile()` shape. Journey logic is never
duplicated outside its flow.

## Two runtime prerequisites (not in `source/`)

Both are written before any `k6 run` and are gitignored:

- `temp/setup.json` — the `--site`/`--env` selectors that derive `baseUrl` (written by `npm run setup`).
- `temp/secret.json` — the decryption passphrase for the committed, encrypted user pool (written by
  `npm run secret`).

k6 has no JSON module import, so config reads these with `open()` + `JSON.parse()`. Details are in the
project `CLAUDE.md` (Environment / Running tests) and `.claude/rules/config.md`.

## Where the conventions live

This doc is the structural map. The _rules_ for writing within each layer — tagging, headers,
correlation, checks, return contracts, self-documenting code, per-layer file layout — are in
`.claude/rules/`, scoped by file path so they load automatically when a matching file is edited. The
project `CLAUDE.md` is the always-loaded overview and the rules index.

## Sources

- Project `CLAUDE.md` — directory structure and running tests (this repo)
- `.claude/rules/` — per-layer conventions (exports, scripting, apis, flows, helpers, types, config, data, tests, seeds)
- [Grafana k6 — modules & imports](https://grafana.com/docs/k6/latest/using-k6/modules/)
