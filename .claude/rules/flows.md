---
paths: ["source/flows/**"]
---

# Flow Conventions (`source/flows/`)

- `source/flows/<flow>.flow.ts` — multi-request journeys composed from `source/apis/` wrappers and `source/helpers/auth.helper.ts`; flows never issue `http.*` directly
- `login.flow.ts` is the shared entry point: `loginToMomentusAssistant(user, version)` owns journey groups 1–2 and returns the session `{ bearerToken, salesAiJwt }`; `loginToEvents(user, version)` returns `{ bearerToken, encUserId }`
- A flow wraps each composed step in its own numbered `group('N. Step', ...)` and guards with an early return when a wrapper returns `null`, so a failed step doesn't cascade
- Correlated values and the return-guard contract follow `rules/scripting.md`
