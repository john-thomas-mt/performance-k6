# Momentus k6 Performance Tests — Claude Guide

## What this repo is
k6 performance test scripts for Momentus, produced via an AI-assisted workflow: explore the app with `playwright-cli`, capture the API traffic behind each user action, then script it as k6 journeys with proper correlation and parameterization.

## Environment
- App: `https://qe.ungerboeck.com/AutomatedUITesting/26_2/app85.cshtml` (QE) — overridable via `-e BASE_URL=...`
- Sales-ai API: `https://momentus-sales-ai-dev.ungerboeck.net` — overridable via `-e SALES_AI_URL=...`
- Defaults live in `source/config/env.config.ts` — `-e` env vars always win, then the optional `temp/setup.json` middle layer (gitignored), then hardcoded defaults; the file's own lines are the authoritative list. `npm run setup` writes `setup.json` from `--site`/`--env` selectors and `env.config.ts` derives `baseUrl` from them, so a CI run can pick the target without a code change
- Requires VPN — if connections time out, ask the user to check VPN
- Credentials: `source/data/users.data.ts` exports `userCredentials` — an array of `{ username, password }` pairs with each **password AES-GCM-encrypted** (key = `SHA-256` of the passphrase, no salt/KDF; deliberately lightweight for low-value QE accounts) and the username plaintext. It is **committed** — the ciphertext is safe to track; security rests on the passphrase. Rotate/add accounts with the mint snippet in `rules/data.md` (reads the passphrase from `temp/secret.json`). At runtime a scenario/seed `setup()` decrypts the pool via `decryptUsers(...)` using `config.cryptoKey`, resolved as `-e CRYPTO_KEY=<passphrase>` (override) **or** a gitignored `temp/secret.json` written by `npm run secret -- --key '<passphrase>'`; `setup()` throws if neither supplies a key. See `rules/data.md`.
- Browser exploration: resize to 1920x1080 before interacting; Momentus Assistant features live in the left sidebar under **'Momentus Assistant'** (expand via 'Open Navigation'), URL pattern `#/momentusAssistant/<page>`

## Running tests
- **Always tell the user before running anything that sends traffic to an environment (`k6 run`, browser exploration). `k6 inspect` is the exception — it only parses the script locally.**
- **Every `k6 run` needs the decryption passphrase** — via `-e CRYPTO_KEY=<passphrase>` or a `temp/secret.json` written by `npm run secret -- --key '<passphrase>'` (omitted from the command examples below for brevity); `k6 inspect` does not (it never runs `setup()`). See Credentials.
- `k6 run source/scenarios/smoke.scn.ts` — the smoke aggregate: every journey once (one iteration per scenario) as a correctness/drift gate. New journeys must be registered here (see `rules/scenarios.md`); used by the `validate-payload-drift` skill
- `k6 run -e SCENARIO=<journey> source/scenarios/smoke.scn.ts` — run a single journey (scale the dev run with `-e VUS=`/`-e ITERS=`); the scripting-time verification entry point
- `k6 run -e PROFILE=load source/scenarios/<name>.scn.ts` — real load via a load scenario; `stress` also available (see `source/config/profiles.config.ts`)
- `k6 inspect source/scenarios/<file>.scn.ts` — validate syntax/imports/options with zero traffic; use after every script change
- `k6 inspect --execution-requirements -e PROFILE=load source/scenarios/<name>.scn.ts` — also zero traffic; resolves the `load` stage spread and computes its max VUs / total duration, so a broken stage config is caught without running load
- Pre-commit compilation gate: `npx tsc --noEmit` (k6 strips types at parse time, so `k6 inspect` never catches a type error — this is the only check that does); lint/format are handled by commit hooks
- When filtering `k6 run` output, pass `--quiet` and redirect to a file before grepping — the live progress bar floods the pipe, and piping straight to `| head` can SIGPIPE-kill the run mid-flight

## Module imports
k6 uses browser-like module resolution — only relative/absolute paths with full filenames
(`'../config/env.config.ts'`) resolve. It ignores `package.json` `imports` and `tsconfig` `paths`, so
path aliases (`#alias/*`, `@/*`) fail at `k6 run` / `k6 inspect` even though `tsc` accepts them.
Use relative imports across `source/` and its entry-point folders. An alias scheme would require a bundler build
step, which the direct `k6 run source/scenarios/<file>.scn.ts` workflow intentionally avoids.
All barrels live in `source/utils/exports/` (one `<layer>.exp.ts` per layer); import a layer's members
through its barrel rather than the individual files (see `rules/exports.md`).
These constraints are why `tsconfig.json` sets `allowImportingTsExtensions` + `noEmit` (to permit the
explicit `.ts` import extensions k6 needs) and `moduleResolution: bundler` (mirroring the esbuild
transpiler k6 actually uses), with no `paths` aliases — these settings serve k6, not another toolchain,
so understand that before touching them. They are not frozen: change them freely as long as k6 still
works — the guardrail is that `k6 run` / `k6 inspect` must still resolve `source/` and `tsc --noEmit`
must still pass. A Node-only helper that needs different resolution (e.g. CommonJS for ts-node) belongs
in a ts-node-scoped override (the `"ts-node"` `compilerOptions` key) that leaves these k6 defaults intact,
rather than a change that bends the k6 semantics above.

## Directory structure
- `source/config/` — environment values (`env.config.ts`), load profiles + common thresholds (`profiles.config.ts`)
- `source/apis/<feature>.api.ts` — endpoint wrappers; `source/flows/<flow>.flow.ts` — composed journeys
- `source/data/` — user pool, request-body builders, and `uploads/` fixtures
- `source/utils/` — supporting layers not central to a journey: `utils/helpers/` (cross-cutting modules that fit none of the other layers), `utils/types/<feature>.type.ts` (per-feature type modules), and `utils/exports/` (one `<layer>.exp.ts` barrel per layer; all cross-folder imports go through these)
- `source/scenarios/` — entry-point scenario scripts (`<name>.scn.ts`) that drive one or more journeys in a run via k6 `scenarios`, each `exec` a thin wrapper calling a `source/flows/` journey (e.g. `smoke.scn.ts`)
- `source/seeds/` — bulk prerequisite-data scripts (`<feature>.seed.ts`) run once after a snapshot reset, reusing `source/apis/` wrappers
- `temp/captures/raw/` — scratch space for oversized payloads during exploration (gitignored); no capture document is produced

## Workflow: generating a new test
`/generate-test <flow description>` — one continuous pass: drive the app with `playwright-cli`, build an in-context correlation picture (no capture file), script straight into `source/` wrappers + a `source/flows/` journey wired into `source/scenarios/smoke.scn.ts`, then verify with a 3-step progressive run:
1. `k6 run -e SCENARIO=<journey> source/scenarios/smoke.scn.ts` (1 VU / 1 iter) — does it run and correlate
2. `k6 run -e SCENARIO=<journey> -e VUS=2 -e ITERS=2 -e USER_MODE=single source/scenarios/smoke.scn.ts` — concurrency under one shared login
3. `k6 run -e SCENARIO=<journey> -e VUS=2 -e ITERS=2 -e USER_MODE=pool source/scenarios/smoke.scn.ts` — different logins, per-user correlation

Fix any failing step and re-run (from step 1 if the fix touched correlation/shared state) until all three pass; then a final refactor check against the rules. Approval for the run sequence is taken once, upfront.

## Tooling
- `@playwright/cli` is installed globally (`npm i -g @playwright/cli`) — always invoke the bare `playwright-cli` binary, never `npx playwright-cli` (a second npx-resolved version corrupts browser sessions with "incompatible please re-open")
- The `.claude/skills/playwright-cli/` skill is the official one shipped with the CLI — after upgrading the global package, refresh it with `playwright-cli install --skills=claude` (never hand-edit it)

## CI (Azure Pipelines)
- Pipelines live in `.azure/`: `workflows/k6-tests-ci-dev.yml` validates PRs targeting `main`; `workflows/k6-tests-ci.yml` runs on merge to `main` and adds SonarQube (project key `performance-k6`). Both share `templates/build-steps.yml`.
- The build template caches npm, installs Node 20.x, runs `npm ci`, then `npm run secret -- --key` (writes a blank `temp/secret.json` placeholder — CI never runs k6, so the real passphrase is supplied wherever the artifact runs) and `npm run setup -- --site <QE|AT|RC> --env <release>` (writes `temp/setup.json`, the env.config middle layer) before the `tsc --noEmit` gate and artifact publish (`MomentusK6PerformanceTests`).
- The encrypted pool needs no CI step: `source/data/users.data.ts` is committed (encrypted), so it's already present for `tsc`. The decryption passphrase is only needed when the artifact is *run*, not built (the CI `secret` step writes only a blank placeholder) — regenerate/rotate the pool locally with the mint snippet in `rules/data.md` (see Credentials).
- The pipeline builds and publishes the scripts as an artifact — it does not run k6. Executing the artifact needs k6 installed and `-e CRYPTO_KEY=` supplied wherever it runs.
- These yargs scripts live in `.config/yargs/` and are part of the root `tsconfig.json` (its `include` covers them, so `npm run typecheck` checks them too). ts-node runs them through the tsconfig's `"ts-node"` override (`node16` resolution + `transpileOnly`); the k6 `compilerOptions` keep `module: ESNext` / `moduleResolution: bundler`. `azure.ts` from the Playwright repo is intentionally not ported (graph-explorer creds, not relevant to perf).

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
- `rules/scenarios.md` — source/scenarios/: entry-point scenario scripts, smoke gate + single-journey runs, profiles, thresholds, data loading, snapshot-based cleanup
- `rules/seeds.md` — source/seeds/: bulk prerequisite-data scripts that reuse api wrappers, seed-marker discovery

## Git conventions
- Branch: `<change-type>-<jira-id>-<change-description>` (kebab-case); change types: `test` | `deps` | `ref` | `docs` | `feat` | `build` | `config` | `review`
- Commit / PR title: `<change-type>(perf): <change-description> (<jira-id>)` — description lowercase; name files with their extension (`README.md`, not `README`)
- Change-type picks that bite: `build` is for CI/CD pipeline (yaml) changes only — project scaffolding is not `build`. Dependency manifests (`package.json`, `package-lock.json`) → `deps`; tooling/config files (`tsconfig.json`, `.gitignore`) → `config`.
- Jira base URL: `https://ungerboeck.atlassian.net/browse/` — hyperlink Jira IDs in PR bodies
