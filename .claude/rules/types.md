---
paths: ["source/utils/types/**"]
---

# Type Module Conventions (`source/utils/types/`)

- `source/utils/types/<feature>.type.ts` — one type module per `source/apis/<feature>` surface
- `source/utils/types/common.type.ts` holds cross-cutting types (auth/session/setup, the core-API transport envelope)
- `source/utils/types/config.type.ts` holds the `Site` and `ReleaseVersion` unions — the environment/config type peer to `source/config/env.config.ts`, not a per-`apis`-surface feature module. `ReleaseVersion` (`main` + the live released version path segments) is the single source of truth for the version matrix: consumed by `env.config.ts` (typing `setup.env`) and read by the `verify-envs` skill to enumerate the matrix. A branch cut advances it in one line — drop the retired oldest segment, prepend the version `main` had resolved to; `tsc --noEmit` then flags any stale reference to the dropped version. The live window is always `main` (the next *unreleased* version) plus the three most-recently-released versions; Momentus minors run 1→2→3→4 then roll to the next major's `_1` (so `25_4` is followed by `26_1`, never `25_5`) — that successor is exactly what `main` resolves to.
- The setup data contract is composed as slices: `SetupData` (in `common.type.ts`) is the base (`version` only); a feature that seeds a pool defines `<Feature>Setup extends SetupData` with a feature-prefixed pool field (`soPool`) in its own `<feature>.type.ts`; the smoke aggregate `SmokeSetup` composes the slices plus the user pool. This keeps feature-row types out of `common.type.ts` (which would cycle, since feature modules import `common`) and lets each journey depend on just its slice. The aggregate currently lives in the feature module owning the only pool; when a second feature pool is added, move it to its own home rather than cross-importing feature-row types.
- Types live here only — never co-located in `source/apis/<feature>.api.ts`. Co-locating would create a cycle, since `source/data/` imports types and `source/apis/` imports `source/data/`
- How a type is *written* (`type` over `interface`, named index signatures over `Record`) is repo-wide style in `rules/typescript.md`, not a types-layer concern
- Re-exported through `source/utils/exports/types.exp.ts` and consumed from it; export names stay unique across the layer so `export *` never drops one (see `rules/exports.md`)
