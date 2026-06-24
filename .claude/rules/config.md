---
paths: ["source/config/**"]
---

# Config Conventions (`source/config/`)

- `source/config/env.config.ts` — environment values, each overridable via `-e` (the file's own `__ENV.X || default` lines are the authoritative list). Wrappers build URLs and headers from these values — hosts, tenants, and versions are never hardcoded elsewhere
- `source/config/profiles.config.ts` — load profiles (selected with `-e PROFILE=`, defaulting to the smoke profile) and `commonThresholds`. Tests spread `loadProfile()` and `commonThresholds` rather than hardcoding `vus`/`stages` (see `rules/tests.md`)
