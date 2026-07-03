# Momentus k6 Performance Tests — Claude Guide

## What this repo is
k6 performance test scripts for Momentus, produced via an AI-assisted workflow: explore the app with `playwright-cli`, capture the API traffic behind each user action, then script it as k6 journeys with proper correlation and parameterization.

## Environment
- App: `https://performance.ungerboeck.net/main/app85.cshtml` (PERF) — `baseUrl` is derived from the `--site`/`--env` selectors `npm run setup` writes to `temp/setup.json`; other sites resolve to their own host (e.g. `https://qe.ungerboeck.com/AutomatedUITesting/26_2/app85.cshtml` for AT)
- Sales-ai API: derived per-site in `env.config.ts` alongside `baseUrl` (PERF → `https://momentus-agents-us.ungerboeck.net`; QE/AT/RC → `https://momentus-sales-ai-dev.ungerboeck.net`)
- Defaults live in `source/config/env.config.ts` — `site`/`env` come from `temp/setup.json` and the decryption key from `temp/secret.json`, both read via `open()` + `JSON.parse()` (k6 has no JSON module import) and both **required prerequisites**: write them with `npm run setup`/`npm run secret` before any `k6 run` (in CI, a pre-run step) — a missing file fails the run. There are no `-e`/`__ENV` overrides in this file. `salesAiUrl` is derived per-site (the same `site` switch as `baseUrl`); values the running system reports (app `version`, sales-ai `tenantId`) are not stored here — they're correlated at runtime (`fetchServerVersion()` / `tenantIdFromJwt()`) and a failed fetch/decode throws rather than falling back to a stale constant. The file's own lines are the authoritative list. `npm run setup` writes `setup.json` from `--site`/`--env` selectors and `env.config.ts` derives `baseUrl` from them, so a CI run can pick the target without a code change
- Requires VPN — if connections time out, ask the user to check VPN
- Credentials: `source/data/creds/users.data.ts` exports `userCredentials` — an array of `{ username, password }` pairs with each **password AES-GCM-encrypted** (key = `SHA-256` of the passphrase, no salt/KDF; deliberately lightweight for low-value QE accounts) and the username plaintext. It is **committed** — the ciphertext is safe to track; security rests on the passphrase. Rotate/add accounts with the mint snippet in `rules/data.md` (reads the passphrase from `temp/secret.json`). At runtime a test/seed `setup()` decrypts the pool via `decryptUsers(...)` using `config.cryptoKey`, sourced from a gitignored `temp/secret.json` written by `npm run secret -- --key '<passphrase>'` (in CI, injected from a masked pipeline secret); `setup()` throws if no key is present. See `rules/data.md`.
- Browser exploration: resize to 1920x1080 before interacting; Momentus Assistant features live in the left sidebar under **'Momentus Assistant'** (expand via 'Open Navigation'), URL pattern `#/momentusAssistant/<page>`

## Running tests
- **Always tell the user before running anything that sends traffic to an environment (`k6 run`, browser exploration). `k6 inspect` is the exception — it only parses the script locally.**
- **Every `k6 run` needs the decryption passphrase** — in a `temp/secret.json` written by `npm run secret -- --key '<passphrase>'` (omitted from the command examples below for brevity); `k6 inspect` does not (it never runs `setup()`). See Credentials.
- `k6 run source/tests/smoke.spec.ts` — the smoke aggregate: every journey once (one iteration per k6 scenario) as a correctness/drift gate. New journeys must be registered here (see `rules/tests.md`); used by the `validate-payload-drift` skill
- `k6 run -e SCENARIO=<journey> source/tests/smoke.spec.ts` — run a single journey (scale the dev run with `-e VUS=`/`-e ITERS=`); the scripting-time verification entry point
- Load profiles (`load`, `stress`) are scaffolded in `source/config/profiles.config.ts` (`loadProfile()`) but **not yet wired to a spec** — no test currently reads `-e PROFILE=`, so it has no effect today. Real load will run through a dedicated load spec that spreads `loadProfile()` + `commonThresholds` (pending; see `rules/tests.md`)
- `npm run smoke:local` / `npm run smoke:cloud` — run `source/tests/smoke.spec.ts` (local OSS `k6 run`, or `k6 cloud run --local-execution` streaming to Grafana Cloud). Both set `K6_WEB_DASHBOARD*` env vars (via `cross-env` for Windows) so k6's built-in web dashboard is always exported to a static `temp/report.html` (gitignored, overwritten each run). The dashboard file is skipped on very short runs (it needs a duration greater than 3× the aggregation period) — use a longer run or a load profile. Forward extra k6 args after a `--`, e.g. `npm run smoke:local -- -e VUS=2 -e ITERS=2`. Sends traffic — the pre-run passphrase/secret prerequisites apply
- `k6 inspect source/tests/<file>.spec.ts` — validate syntax/imports/options with zero traffic; use after every script change
- `k6 inspect --execution-requirements source/tests/<name>.spec.ts` — also zero traffic; once a load spec consumes `loadProfile()`, this resolves the stage spread and computes its max VUs / total duration, so a broken stage config is caught without running load
- Pre-commit compilation gate: `npx tsc --noEmit` (k6 strips types at parse time, so `k6 inspect` never catches a type error — this is the only check that does); lint/format are handled by commit hooks
- When filtering `k6 run` output, pass `--quiet` and redirect to a file before grepping — the live progress bar floods the pipe, and piping straight to `| head` can SIGPIPE-kill the run mid-flight

## Module imports
k6 uses browser-like module resolution — only relative/absolute paths with full filenames
(`'../config/env.config.ts'`) resolve. It ignores `package.json` `imports` and `tsconfig` `paths`, so
path aliases (`#alias/*`, `@/*`) fail at `k6 run` / `k6 inspect` even though `tsc` accepts them.
k6 also has no JSON module import — load data files (e.g. `temp/setup.json`) with `open()` + `JSON.parse()`,
never `import x from './f.json'`.
Use relative imports across `source/` and its entry-point folders. An alias scheme would require a bundler build
step, which the direct `k6 run source/tests/<file>.spec.ts` workflow intentionally avoids.
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
`/neoload-to-k6 <path to NeoLoad VU>` — port an existing NeoLoad virtual-user script to a k6 journey. Static-first: the NeoLoad tree (its request XMLs and `<variable-extractor>` correlation) is the source of truth, so there's no browser exploration — parse the tree, distill the transaction spine (drop asset/telemetry/UI-chrome, keep writes and the reads that feed them), translate NeoLoad's solved correlation into k6, reuse existing `source/` wrappers, then verify with the same 3-step progressive run. Live `playwright-cli` is a targeted fallback only when a verify step fails on drift, never a full re-record.

## Tooling
- `@playwright/cli` is installed globally (`npm i -g @playwright/cli`) — always invoke the bare `playwright-cli` binary, never `npx playwright-cli` (a second npx-resolved version corrupts browser sessions with "incompatible please re-open")
- The `.claude/skills/playwright-cli/` skill is the official one shipped with the CLI — after upgrading the global package, refresh it with `playwright-cli install --skills=claude` (never hand-edit it)

## CI (Azure Pipelines)
- Two pipelines live in `.azure/workflows/`, serving different jobs:
  - `k6-tests-ci-dev.yml` — **PR validation** (`pr:` includes `main`; runs on PR open and on each new push to it). Ubuntu agent, uses `templates/build-steps.yml`, builds only — it does **not** run k6.
  - `k6-tests-ci.yml` — **manually queued run** (`trigger: none` / `pr: none`). On a self-hosted agent pool (`Momentus-Cloud-AutomatedTesting`) it actually executes k6: installs Node + freshly downloads the k6 binary, writes `setup.json`/`secret.json`, runs `k6 run --quiet source/tests/load.spec.ts` (the `load` profile — 5m ramp / 10m sustain / 2m ramp-down at 100 VUs; web dashboard enabled via `K6_WEB_DASHBOARD*`, `K6_WEB_DASHBOARD_PERIOD=10s`; k6's REST API + profiling endpoint enabled via `--address` + `--profiling-enabled` so its Go runtime/GC metrics are scrapeable), samples agent CPU/RAM/network **and** k6's own Go runtime/GC metrics (from the k6 `/metrics` endpoint — this measures the load generator, not the system under test) via `.azure/scripts/`, publishes a `k6-results` artifact (`report.html`, `k6-console.log`, `resource-usage.csv/html`, `gc-usage.csv/html`), then deletes the plaintext `secret.json` + binary. The real decryption passphrase is injected from a masked secret pipeline variable `K6_DECRYPT_KEY` (set in the pipeline UI, never committed). There is no SonarQube step.
- `build-steps.yml` (used only by the dev pipeline) caches npm, installs Node 20.x, runs `npm ci`, then `npm run secret -- --key` (blank value → writes a placeholder `temp/secret.json`; the dev pipeline never runs k6, so no real passphrase is needed to build) and `npm run setup -- --site <QE|AT|RC|PERF> --env <release>` (writes `temp/setup.json`, the env.config middle layer) before the `tsc --noEmit` gate and artifact publish (`MomentusK6PerformanceTests`).
- The encrypted pool needs no CI step: `source/data/creds/users.data.ts` is committed (encrypted), so it's already present for `tsc`. The decryption passphrase is only needed when k6 actually *runs* (the manual pipeline, injected from `K6_DECRYPT_KEY`) — not when the dev pipeline builds the artifact (its `secret` step writes only a blank placeholder). Regenerate/rotate the pool locally with the mint snippet in `rules/data.md` (see Credentials).
- The yargs scripts live in `.config/yargs/` and are part of the root `tsconfig.json` (its `include` covers them, so `npx tsc --noEmit` checks them too). ts-node runs them through the tsconfig's `"ts-node"` override (`node16` resolution + `transpileOnly`); the k6 `compilerOptions` keep `module: ESNext` / `moduleResolution: bundler`. `azure.ts` from the Playwright repo is intentionally not ported (graph-explorer creds, not relevant to perf).

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
- `rules/tests.md` — source/tests/: entry-point test specs, smoke gate + single-journey runs, profiles, thresholds, data loading, snapshot-based cleanup
- `rules/seeds.md` — source/seeds/: bulk prerequisite-data scripts that reuse api wrappers, seed-marker discovery

## Git conventions
- Branch: `<change-type>-<jira-id>-<change-description>` (kebab-case); change types: `test` | `deps` | `ref` | `docs` | `feat` | `build` | `config` | `review`
- Commit / PR title: `<change-type>(perf): <change-description> (<jira-id>)` — description lowercase; name files with their extension (`README.md`, not `README`)
- Change-type picks that bite: `build` is for CI/CD pipeline (yaml) changes only — project scaffolding is not `build`. Dependency manifests (`package.json`, `package-lock.json`) → `deps`; tooling/config files (`tsconfig.json`, `.gitignore`) → `config`.
- Jira base URL: `https://ungerboeck.atlassian.net/browse/` — hyperlink Jira IDs in PR bodies
