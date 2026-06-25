---
paths: ["source/config/**"]
---

# Config Conventions (`source/config/`)

- `source/config/env.config.ts` — environment values (the file's own lines are the authoritative list); there are no `__ENV` overrides here. `temp/setup.json` and `temp/secret.json` are read once in the init context with `open()` + `JSON.parse()` (k6 has no JSON module import — see `rules/scripting.md`/CLAUDE.md). Both are **required prerequisites**, not optional layers: write them with `npm run setup -- --site … --env …` (`.config/yargs/setup.ts`) and `npm run secret -- --key '<passphrase>'` before the run (in CI, a pre-run step; the key injected from a masked pipeline secret) — a missing file fails the run. `env.config.ts` derives `baseUrl` by resolving `setup.site`/`setup.env` into a URL prefix + path, and exposes `cryptoKey` (`secret.key`) for the user-pool decryption in `setup()`. Values the running system reports — the app `version` (`fetchServerVersion()`) and the sales-ai `tenantId` (`tenantIdFromJwt()`) — are **not** stored here: they are correlated at runtime, and a failed fetch/decode throws rather than degrading to a stale constant. Wrappers build URLs and headers from these values — hosts, tenants, and versions are never hardcoded elsewhere
- `source/config/profiles.config.ts` — load profiles (selected with `-e PROFILE=`, defaulting to the smoke profile) and `commonThresholds`. Load scenarios spread `loadProfile()` and `commonThresholds` rather than hardcoding `vus`/`stages` (see `rules/scenarios.md`)
