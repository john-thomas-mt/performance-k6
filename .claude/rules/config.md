---
paths: ["source/config/**"]
---

# Config Conventions (`source/config/`)

- `source/config/env.config.ts` — environment values (`BASE_URL`, `SALES_AI_URL`, `TENANT_ID`, `APP_VERSION`); each overridable via `-e`. Wrappers build URLs and headers from these values — hosts, tenants, and versions are never hardcoded elsewhere
- `source/config/profiles.config.ts` — load profiles (`smoke`/`load`/`stress`) and `commonThresholds`. Tests spread `loadProfile()` and `commonThresholds` rather than hardcoding `vus`/`stages` (see `rules/tests.md`)
