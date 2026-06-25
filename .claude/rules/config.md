---
paths: ["source/config/**"]
---

# Config Conventions (`source/config/`)

- `source/config/env.config.ts` — environment values, resolved as `__ENV.X || setup.json || hardcoded default` (the file's own lines are the authoritative list). `-e` env vars always win; the optional `temp/setup.json` middle layer is read once in the init context with a guarded `open()` (absent in normal local runs → falls through to defaults), written by `npm run setup` (`.config/yargs/setup.ts`) from `--site`/`--env` selectors — `env.config.ts` derives `baseUrl` from them via `baseUrlFor(site, env)`. It also reads a second guarded `temp/secret.json` and exposes `cryptoKey` (`__ENV.CRYPTO_KEY || secret.key`) for the user-pool decryption in `setup()`. Wrappers build URLs and headers from these values — hosts, tenants, and versions are never hardcoded elsewhere
- `source/config/profiles.config.ts` — load profiles (selected with `-e PROFILE=`, defaulting to the smoke profile) and `commonThresholds`. Load scenarios spread `loadProfile()` and `commonThresholds` rather than hardcoding `vus`/`stages` (see `rules/scenarios.md`)
