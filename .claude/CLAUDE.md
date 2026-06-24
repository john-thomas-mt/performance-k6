# Momentus k6 Performance Tests — Claude Guide

## What this repo is
k6 performance test scripts for Momentus, produced via an AI-assisted workflow: explore the app with `playwright-cli`, capture the API traffic behind each user action, then script it as k6 journeys with proper correlation and parameterization.

## Environment
- App: `https://qe.ungerboeck.com/AutomatedUITesting/26_2/app85.cshtml` (QE) — overridable via `-e BASE_URL=...`
- Sales-ai API: `https://momentus-sales-ai-dev.ungerboeck.net` — overridable via `-e SALES_AI_URL=...`
- Defaults live in `source/config/env.config.ts` (`BASE_URL`, `SALES_AI_URL`, `TENANT_ID`, `APP_VERSION`)
- Requires VPN — if connections time out, ask the user to check VPN
- Credentials: `source/data/users.data.ts` (gitignored) holds the QE accounts — never committed. The `.gitignore` entry must be the full repo-relative path (`source/data/users.data.ts`); a bare `data/users.data.ts` is root-anchored and silently fails to match the nested file. Verify with `git check-ignore source/data/users.data.ts` before the first commit.
- Browser exploration: resize to 1920x1080 before interacting; Momentus Assistant features live in the left sidebar under **'Momentus Assistant'** (expand via 'Open Navigation'), URL pattern `#/momentusAssistant/<page>`

## Running tests
- **Always tell the user before running anything that sends traffic to an environment (`k6 run`, browser exploration). `k6 inspect` is the exception — it only parses the script locally.**
- `k6 run source/tests/<file>.spec.ts` — defaults to `PROFILE=smoke` (1 VU / 1 iteration)
- `k6 run -e PROFILE=load source/tests/<file>.spec.ts` — real load; `stress` also available (see `source/config/profiles.config.ts`)
- `k6 inspect source/tests/<file>.spec.ts` — validate syntax/imports/options with zero traffic; use after every script change
- `k6 inspect --execution-requirements -e PROFILE=load source/tests/<file>.spec.ts` — also zero traffic; resolves the `load` stage spread and computes its max VUs / total duration, so a broken stage config is caught without running load
- Pre-commit compilation gate: `npx tsc --noEmit` (k6 strips types at parse time, so `k6 inspect` never catches a type error — this is the only check that does); lint/format are handled by commit hooks

## Module imports
k6 uses browser-like module resolution — only relative/absolute paths with full filenames
(`'../config/env.config.ts'`) resolve. It ignores `package.json` `imports` and `tsconfig` `paths`, so
path aliases (`#alias/*`, `@/*`) fail at `k6 run` / `k6 inspect` even though `tsc` accepts them.
Use relative imports across `source/` and `source/tests/`. An alias scheme would require a bundler build
step, which the direct `k6 run source/tests/<file>.spec.ts` workflow intentionally avoids.
All barrels live in `source/utils/exports/` (one `<layer>.exp.ts` per layer); import a layer's members
through its barrel rather than the individual files (see `rules/exports.md`).
These constraints are why `tsconfig.json` sets `allowImportingTsExtensions` + `noEmit` (to permit the
explicit `.ts` import extensions k6 needs) and `moduleResolution: bundler` (mirroring the esbuild
transpiler k6 actually uses), with no `paths` aliases — those settings are deliberate, not boilerplate
to "fix" for another toolchain.

## Directory structure
- `source/config/` — environment values (`env.config.ts`), load profiles + common thresholds (`profiles.config.ts`)
- `source/apis/<feature>.api.ts` — endpoint wrappers; `source/flows/<flow>.flow.ts` — composed journeys
- `source/data/` — user pool, request-body builders, and `uploads/` fixtures
- `source/utils/` — supporting layers not central to a journey: `utils/helpers/` (cross-cutting modules `auth.helper.ts`, `headers.helper.ts`, `version.helper.ts`, `users.helper.ts`), `utils/types/<feature>.type.ts` (per-feature type modules), and `utils/exports/` (one `<layer>.exp.ts` barrel per layer; all cross-folder imports go through these)
- `source/tests/` — thin journey scripts (`<feature-area>-<flow>.spec.ts`) composing `source/`
- `source/seeds/` — bulk prerequisite-data scripts (`<feature>.seed.ts`) run once after a snapshot reset, reusing `source/apis/` wrappers
- `temp/captures/raw/` — scratch space for oversized payloads during exploration (gitignored); no capture document is produced

## Workflow: generating a new test
`/generate-test <flow description>` — one continuous pass: drive the app with `playwright-cli`, build an in-context correlation picture (no capture file), script straight into `source/` wrappers + a `source/tests/` journey, then verify with a 3-step progressive run:
1. `k6 run -e PROFILE=smoke` (1 VU / 1 iter) — does it run and correlate
2. `k6 run --vus 2 --iterations 2 -e USER_MODE=single` — concurrency under one shared login
3. `k6 run --vus 2 --iterations 2 -e USER_MODE=pool` — different logins, per-user correlation

Fix any failing step and re-run (from step 1 if the fix touched correlation/shared state) until all three pass; then a final refactor check against the rules. Approval for the run sequence is taken once, upfront.

## Tooling
- `@playwright/cli` is installed globally (`npm i -g @playwright/cli`) — always invoke the bare `playwright-cli` binary, never `npx playwright-cli` (a second npx-resolved version corrupts browser sessions with "incompatible please re-open")
- The `.claude/skills/playwright-cli/` skill is the official one shipped with the CLI — after upgrading the global package, refresh it with `playwright-cli install --skills=claude` (never hand-edit it)

## Conventions
Detailed conventions are in `.claude/rules/` — auto-loaded by file path scope:
- `rules/exports.md` — source/**: barrels in `source/utils/exports/`; import via the barrel, never your own layer's
- `rules/scripting.md` — request-making layer (source/apis, source/flows, source/utils/helpers): tagging, headers, correlation, checks, return contract, polling
- `rules/apis.md` — source/apis/: one module per endpoint surface, thin wrappers
- `rules/flows.md` — source/flows/: composed journeys, login owns groups 1–2, session return
- `rules/helpers.md` — source/utils/helpers/: cross-cutting auth/headers/version/users modules
- `rules/types.md` — source/utils/types/: per-feature type modules, no cycles, unique export names, layer barrel
- `rules/config.md` — source/config/: env values, profiles + common thresholds
- `rules/data.md` — source/data/: module layout, builders vs upload fixtures, user pool
- `rules/tests.md` — source/tests/: profiles, thresholds, groups, guards, data loading, snapshot-based cleanup
- `rules/seeds.md` — source/seeds/: bulk prerequisite-data scripts that reuse api wrappers, seed-marker discovery

## Git conventions
- Branch: `<change-type>-<jira-id>-<change-description>` (kebab-case); change types: `test` | `deps` | `ref` | `docs` | `feat` | `build` | `config` | `review`
- Commit / PR title: `<change-type>(perf): <change-description> (<jira-id>)` — description lowercase; name files with their extension (`README.md`, not `README`)
- Change-type picks that bite: `build` is for CI/CD pipeline (yaml) changes only — project scaffolding is not `build`. Dependency manifests (`package.json`, `package-lock.json`) → `deps`; tooling/config files (`tsconfig.json`, `.gitignore`) → `config`.
- Jira base URL: `https://ungerboeck.atlassian.net/browse/` — hyperlink Jira IDs in PR bodies
