---
paths: ["source/data/chrome/**", "source/data/static/**", "source/data/transport/**", "source/utils/helpers/chrome.helper.ts", "source/utils/helpers/fidelity.helper.ts", "source/utils/helpers/think-time.helper.ts"]
---

# Fidelity-Tier Conventions (chrome/static replay behind `-e FIDELITY`)

A journey runs at one of three fidelity levels chosen by `-e FIDELITY` (`fidelity_level()` in
`fidelity.helper.ts`, default `lean`):

- **lean** — the correlated **spine** only (the `source/apis` wrappers): the functional server calls. This
  is the correctness gate and the lean-vs-full / NeoLoad-parity baseline.
- **ui** — spine plus the **UI-chrome** tier: the application/API calls a browser fires to paint the UI
  (nav, dashboards, grid-view and window reads) that the spine deliberately drops.
- **full** — ui plus the **static** tier (css/js/html/font/image assets) and the **transport** tier —
  requests that are neither an `/api/` call nor a static asset (the SignalR real-time handshake, the
  `app85.cshtml` bootstrap), so a full run reproduces every request the recording made.

`include_ui(level)` gates the UI-chrome tier; `include_static(level)` gates the static **and** transport
tiers. A flow fires each step's slice of all three (via `fire_ui_chrome` / `fire_static_assets` /
`fire_transport`) alongside the spine call for that step, keeping the extra load in flight around the spine
writes.

## Generated request lists — regenerate, never hand-edit
The chrome/static/transport lists (`source/data/{chrome,static,transport}/*.ts`) are emitted from the
NeoLoad recording by `scripts/gen-fidelity-lists.js` and carry a do-not-hand-edit banner: change the
generator and regenerate, don't edit the data. The generator normalises the recording so the replay is
faithful on the current app, and each of these is load-bearing (skipping one produces spurious
`http_req_failed`, not real UI behaviour):

- **recover the query string** from the recording's `<parameter>` elements onto the path — a bare path
  404s when the endpoint keys off query args.
- **decode `Encoded(Base64):` bodies** to the real JSON (NeoLoad stores large bodies Base64-encoded); an
  undecoded body is non-JSON and 5xxs.
- **keep the `${…}` correlation tokens** in path and body for runtime substitution (below) — a stripped
  token leaves malformed JSON or a blank value, so the server rejects it.
- **sort each request into a tier** — an `/api/` call is chrome, a static asset is static, and everything
  else (the SignalR handshake, the bootstrap page) is transport.
- **exclude endpoints scripted as correlated wrappers** — the spine, plus reads promoted to gated wrappers
  (the app-shell bootstrap → `fetch_bundle_versions`, SignalR `negotiate` → `signalr_negotiate`) so they are
  not double-fired. The generator's own exclusion lists are the authoritative set.
- **version-gate an endpoint a later release drops** rather than deleting it — emit it with a `removedIn`
  marker and let fire time skip it once the runtime server version reaches that release (`version_at_least`),
  so it still replays on the older releases that serve it. Reserve an outright drop for a read the lean spine
  can't reproduce (a body echoing a full selected grid row).

These normalizations are what let a single recording's replay hold across the whole live version matrix, not
just the version it was recorded on: query-string recovery and Base64 decode make each request well-formed
everywhere, runtime token substitution re-correlates per-run values, and version-gating fires each
release-specific endpoint only where it exists. `verify-envs` at `-e FIDELITY=full` is the cross-version
check — a tier that drifts on an older release surfaces there as `http_req_failed` > 0 or an unresolved-token
skip.

**Never `Read` these files into an agent's context** — the replay bodies are multi-KB and opaque (tokens are
substituted at fire time, so nothing here is hand-edited). To wire a flow's subs map, run
`node scripts/fidelity-tokens.js <chrome-file> [static-file]` for the tokens-per-step and the full token-key
contract the subs map must satisfy; `grep` a path if you need one specific request.

## Runtime correlation — substitute, never fire a blanked body
Chrome and transport requests carry `${token}` placeholders; `fire_ui_chrome` / `fire_transport` take a
**subs map** and substitute every `${token}` in path and body at fire time. A request left with an
**unresolved** `${…}` is **skipped and logged**, never fired — a fire-and-forget tier must not send a garbage
body that inflates `http_req_failed`.

- The flow builds the subs map **progressively from the same correlation the spine already extracts** —
  server version, `encUserId`, the event id / row key a save returns, form-table cells read by **name**
  via `get_cell` (never a captured positional index; layouts drift) — and threads the up-to-date map into
  each step's chrome call.
- A chrome or transport request needing a **response-derived** value that is not already a spine output gets
  its own **gated wrapper** (a thin query, fired only when its tier is on) that produces the value into the
  subs map before the batch that consumes it — the same correlate-from-a-prior-response contract the spine
  follows (`rules/scripting.md`). The transport tier's tokens come from wrappers fired when `include_static`:
  the app-shell bundle-version cache-bust tokens (`fetch_bundle_versions`), the SignalR connection token
  (`signalr_negotiate`), and the SSO token extracted by `sign_in_session`.

## Tolerant and coarsely tagged
The extra tiers are supporting load, not assertions: fire them with `http.batch`, tag them coarsely
(`UIChrome` / `StaticAsset` / `Transport`) so per-endpoint spine thresholds (`http_req_duration{name:…}`) stay clean, and
check only that each responded (`status > 0`) rather than asserting status or shape. Correctness is proven
by the spine at `lean`; the tiers add realistic concurrent load around it.

## Think time
`think()` (`think-time.helper.ts`) paces a journey between steps: it sleeps a uniform-random 2–3s — matching
the NeoLoad `P_thinkTime` recording variable (`variable-random-number` 2000–3000 ms, applied uniformly at
every step) — so the request rate matches a real user session instead of firing back-to-back. Each pause is
recorded into a custom `think_time` Trend metric (`isTime`), so think time reports as its own figure
(avg/p95) alongside the endpoint timers, the analog of NeoLoad's separate think-time reporting. Call `think()`
**between** the `group()` blocks (never inside one) so the pause stays out of `http_req_duration` and
`group_duration` and lands only in `iteration_duration` — response-time metrics stay clean.
