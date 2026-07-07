# Momentus k6 Performance Tests — Claude Guide

## What this repo is
k6 performance test scripts for Momentus, produced via an AI-assisted workflow: explore the app with `playwright-cli`, capture the API traffic behind each user action, then script it as k6 journeys with proper correlation and parameterization.

## Environment
- App: `https://performance.ungerboeck.net/main/app85.cshtml` (PERF) — `baseUrl` is derived from the `--site`/`--env` selectors `npm run setup` writes to `temp/setup.json`; other sites resolve to their own host (e.g. `https://qe.ungerboeck.com/AutomatedUITesting/26_2/app85.cshtml` for AT). `--site` defaults to `PERF` (the only site perf tests run on; QE/AT/RC are debug-only) and `--env` to `main` (the env authoring targets), so `npm run setup` with no args writes the perf target; the interface types are `Site`/`ReleaseVersion` in `source/utils/types/config.type.ts`, and `ReleaseVersion` is the single source of truth for the live version matrix, advanced one line per branch cut
- Sales-ai API: derived per-site in `env.config.ts` alongside `baseUrl` (PERF → `https://momentus-agents-us.ungerboeck.net`; QE/AT/RC → `https://momentus-sales-ai-dev.ungerboeck.net`)
- Defaults live in `source/config/env.config.ts` — it reads `temp/setup.json` (`--site`/`--env`) and `temp/secret.json` (decryption key) via `open()` + `JSON.parse()` (k6 has no JSON import). Both are **required prerequisites**: write them with `npm run setup` / `npm run secret` before any `k6 run` (a missing file fails the run); there are no `-e`/`__ENV` overrides here. Values the running system reports — app `version`, sales-ai `tenantId` — are **not** stored: they're correlated at runtime (`fetchServerVersion()` / `tenantIdFromJwt()`) and throw on failure rather than falling back to a stale constant. Full derivation in `rules/config.md`
- Requires VPN — if connections time out, ask the user to check VPN
- Credentials: `source/data/creds/users.data.ts` is **committed** with usernames plaintext and passwords AES-GCM-encrypted (safe to track — security rests on the passphrase). At runtime `setup()` decrypts the pool with `config.cryptoKey` from a gitignored `temp/secret.json` (`npm run secret -- --key '<passphrase>'`; in CI, a masked secret) and throws if it's missing. Crypto scheme and the rotate/add snippet live in `rules/data.md`.
- Browser exploration: resize to 1920x1080 before interacting; Momentus Assistant features live in the left sidebar under **'Momentus Assistant'** (expand via 'Open Navigation'), URL pattern `#/momentusAssistant/<page>`

## Running tests
- **Always tell the user before running anything that sends traffic to an environment (`k6 run`, browser exploration). `k6 inspect` is the exception — it only parses the script locally.**
- **Every `k6 run` needs the decryption passphrase** — in a `temp/secret.json` written by `npm run secret -- --key '<passphrase>'` (omitted from the command examples below for brevity); `k6 inspect` does not (it never runs `setup()`). See Credentials.
- `k6 run source/tests/smoke.spec.ts` — the smoke aggregate: every journey once (one iteration per k6 scenario) as a correctness/drift gate. New journeys must be registered here (see `rules/tests.md`); used by the `payload-drift` skill
- `k6 run -e SCENARIO=<journey> source/tests/smoke.spec.ts` — run a single journey (scale the dev run with `-e VUS=`/`-e ITERS=`); the scripting-time verification entry point
- Load profiles (`load`, `stress`) are scaffolded in `source/config/profiles.config.ts` (`loadProfile()`) but **not yet wired to a spec** — no test currently reads `-e PROFILE=`, so it has no effect today. Real load will run through a dedicated load spec that spreads `loadProfile()` + `commonThresholds` (pending; see `rules/tests.md`)
- `npm run smoke:local` / `npm run smoke:cloud` — run `source/tests/smoke.spec.ts` (local OSS `k6 run`, or `k6 cloud run --local-execution` streaming to Grafana Cloud). Both set `K6_WEB_DASHBOARD*` env vars (via `cross-env` for Windows) so k6's built-in web dashboard is always exported to a static `temp/report.html` (gitignored, overwritten each run). The dashboard file is skipped on very short runs (it needs a duration greater than 3× the aggregation period) — use a longer run or a load profile. Forward extra k6 args after a `--`, e.g. `npm run smoke:local -- -e VUS=2 -e ITERS=2`. Sends traffic — the pre-run passphrase/secret prerequisites apply
- `k6 inspect source/tests/<file>.spec.ts` — validate syntax/imports/options with zero traffic; use after every script change
- `k6 inspect --execution-requirements source/tests/<name>.spec.ts` — also zero traffic; once a load spec consumes `loadProfile()`, this resolves the stage spread and computes its max VUs / total duration, so a broken stage config is caught without running load
- Pre-commit compilation gate: `npx tsc --noEmit` (k6 strips types at parse time, so `k6 inspect` never catches a type error — this is the only check that does); lint/format are handled by commit hooks
- When filtering `k6 run` output, pass `--quiet` and redirect to a file before grepping — the live progress bar floods the pipe, and piping straight to `| head` can SIGPIPE-kill the run mid-flight
- A run whose `setup()` fails or times out still prints every threshold as `✓` against zero samples (`rate=0.00%`, `p(95)=0s`) yet exits non-zero — before trusting a green summary, confirm `iterations` / `checks_total` are greater than 0 (a `setup() execution timed out` line usually points at a VPN/connectivity stall)

## Module imports
k6 uses browser-like module resolution: only relative/absolute paths with the full `.ts` filename resolve
(`'../config/env.config.ts'`). It ignores `package.json` `imports` and `tsconfig` `paths`, so `#alias`/`@/*`
fail at `k6 run` / `k6 inspect` even though `tsc` accepts them. k6 also has no JSON module import — load data
files with `open()` + `JSON.parse()`, never `import x from './f.json'`. Import each layer's members through
its barrel in `source/utils/exports/` (see `rules/exports.md`).

`tsconfig.json` sets `allowImportingTsExtensions` + `noEmit` (to allow the explicit `.ts` extensions),
`moduleResolution: bundler` (mirroring k6's esbuild), and no `paths` — these serve k6, not another toolchain.
Change them freely as long as `k6 run` / `k6 inspect` still resolve `source/` and `tsc --noEmit` still passes;
a Node-only helper needing different resolution goes in the tsconfig `"ts-node"` override, not by bending these
k6 defaults.

## Directory structure
- `source/config/` — environment values (`env.config.ts`), load profiles + common thresholds (`profiles.config.ts`)
- `source/apis/<feature>.api.ts` — endpoint wrappers; `source/flows/<flow>.flow.ts` — composed journeys
- `source/data/` — split by kind: `payloads/` request-body builders (feature-grouped), `uploads/` file fixtures, `creds/` user pool
- `source/utils/` — supporting layers not central to a journey: `utils/helpers/` (cross-cutting modules that fit none of the other layers), `utils/types/<feature>.type.ts` (per-feature type modules), and `utils/exports/` (one `<layer>.exp.ts` barrel per layer; all cross-folder imports go through these)
- `source/tests/` — entry-point test specs (`<name>.spec.ts`) that drive one or more journeys in a run via k6 `scenarios`, each `exec` a thin wrapper calling a `source/flows/` journey (e.g. `smoke.spec.ts`)
- `source/seeds/` — bulk prerequisite-data scripts (`<feature>.seed.ts`) run once after a snapshot reset, reusing `source/apis/` wrappers
- `temp/captures/raw/` — scratch space for oversized payloads during exploration (gitignored); no capture document is produced
- `docs/` — standalone reference/decision docs backing architecture, capacity, and tooling choices (the folder is the authoritative list)

## Workflow: generating a new test
`/generate-test <flow description>` — one continuous pass: drive the app with `playwright-cli`, build an in-context correlation picture (no capture file), script straight into `source/` wrappers + a `source/flows/` journey wired into `source/tests/smoke.spec.ts`, then verify with a 3-step progressive run:
1. `k6 run -e SCENARIO=<journey> source/tests/smoke.spec.ts` (1 VU / 1 iter) — does it run and correlate
2. `k6 run -e SCENARIO=<journey> -e VUS=2 -e ITERS=2 -e USER_MODE=single source/tests/smoke.spec.ts` — concurrency under one shared login
3. `k6 run -e SCENARIO=<journey> -e VUS=2 -e ITERS=2 -e USER_MODE=pool source/tests/smoke.spec.ts` — different logins, per-user correlation

Fix any failing step and re-run (from step 1 if the fix touched correlation/shared state) until all three pass; then a final refactor check against the rules. Approval for the run sequence is taken once, upfront.

## Workflow: converting a NeoLoad script
`/neoload-to-k6 <path to NeoLoad VU>` — port an existing NeoLoad virtual-user script to a k6 journey. Static-first: the NeoLoad tree (its request XMLs and `<variable-extractor>` correlation) is the source of truth, so there's no browser exploration — parse the tree, distill the transaction spine (drop asset/telemetry/UI-chrome, keep writes and the reads that feed them), translate NeoLoad's solved correlation into k6, reuse existing `source/` wrappers (porting any paired `@u*` data-script VU — identified via its `@population_@test@data_@t*` mapping — into a `source/seeds/` seed pass rather than folding it into the journey), then verify with the same 3-step progressive run. Live `playwright-cli` is a targeted fallback only when a verify step fails on drift, never a full re-record.

## Workflow: verifying across the version matrix
`/verify-envs <journey>` (per-journey) or `/verify-envs --suite` (whole smoke suite) — run a journey, or every journey, once against each live env in the `ReleaseVersion` matrix (`main` + the released segments in `source/utils/types/config.type.ts`), `main` first, and triage each failure as payload drift vs correlation vs env-provisioning gap. Authoring targets `main`; this proves the trickle-down to released envs, and is the fleet-wide re-check after a branch cut. A branch cut is a one-line edit to the `ReleaseVersion` union (drop the retired oldest segment, prepend the newly-released one that `main` used to resolve to) followed by a suite run. Sends traffic — the pre-run passphrase/secret prerequisites apply.

## Tooling
- `@playwright/cli` is installed globally (`npm i -g @playwright/cli`) — always invoke the bare `playwright-cli` binary, never `npx playwright-cli` (a second npx-resolved version corrupts browser sessions with "incompatible please re-open")
- The `.claude/skills/playwright-cli/` skill is the official one shipped with the CLI — after upgrading the global package, refresh it with `playwright-cli install --skills=claude` (never hand-edit it)

## CI (Azure Pipelines)
Two pipelines in `.azure/workflows/` (the `.yml` files are the authoritative detail):
- `k6-tests-ci-dev.yml` — **PR validation** against `main` (on open + each push). Ubuntu agent, `templates/build-steps.yml`; **builds only, never runs k6** — `npm ci`, writes a placeholder `secret.json` + a real `setup.json`, then gates on `tsc --noEmit` and publishes the artifact.
- `k6-tests-ci.yml` — **manually queued** (`trigger: none`), self-hosted pool. Actually runs `k6 run` on the `load` profile, samples agent + k6-runtime resource usage via `.azure/scripts/`, publishes the `k6-results` artifact, then deletes the plaintext secret. The decryption passphrase comes from the masked `K6_DECRYPT_KEY` pipeline variable (never committed).
- The committed encrypted pool needs no CI step for `tsc`; the passphrase is only needed when k6 actually runs. The yargs setup/secret scripts run through the tsconfig `"ts-node"` override (see Module imports).

## Conventions
Detailed conventions are in `.claude/rules/` — auto-loaded by file path scope:
- `rules/exports.md` — source/**: barrels in `source/utils/exports/`; import via the barrel, never your own layer's
- `rules/comments.md` — source/**: self-documenting code, no explanatory comments or JSDoc
- `rules/typescript.md` — source/**: type-authoring style (`type` over `interface`, named index signatures over `Record`)
- `rules/scripting.md` — request-making layer (source/apis, source/flows, source/utils/helpers): tagging, headers, correlation, checks, return contract, polling
- `rules/apis.md` — source/apis/: one module per endpoint surface, thin wrappers
- `rules/flows.md` — source/flows/: composed journeys, login owns groups 1–2, session return
- `rules/helpers.md` — source/utils/helpers/: cross-cutting auth/headers/version/users modules
- `rules/types.md` — source/utils/types/: per-feature type modules, no cycles, unique export names, layer barrel
- `rules/config.md` — source/config/: env values, profiles + common thresholds
- `rules/data.md` — source/data/: module layout, builders vs upload fixtures, user pool
- `rules/tests.md` — source/tests/: entry-point test specs, smoke gate + single-journey runs, profiles, thresholds, data loading, snapshot-based cleanup
- `rules/seeds.md` — source/seeds/: bulk prerequisite-data scripts that reuse api wrappers, seed-marker discovery

## Git conventions
- Branch: `<change-type>-<jira-id>-<change-description>` (kebab-case); change types: `test` | `deps` | `ref` | `docs` | `feat` | `build` | `config` | `review`
- Commit / PR title: `<change-type>(perf): <change-description> (<jira-id>)` — description lowercase; name files with their extension (`README.md`, not `README`)
- Change-type picks that bite: `build` is for CI/CD pipeline (yaml) changes only — project scaffolding is not `build`. Dependency manifests (`package.json`, `package-lock.json`) → `deps`; tooling/config files (`tsconfig.json`, `.gitignore`) → `config`.
- Jira base URL: `https://ungerboeck.atlassian.net/browse/` — hyperlink Jira IDs in PR bodies
