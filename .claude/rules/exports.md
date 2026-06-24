---
paths: ["source/**"]
---

# Barrel Export Conventions (`source/**`)

All barrels live in `source/utils/exports/` — one `<layer>.exp.ts` per layer, each re-exporting every module in its layer — so importing a layer's members costs one import line.

- Re-export with relative, full-filename paths: `export * from '../../apis/events.api.ts';`. k6 uses browser-like resolution and ignores tsconfig path aliases, so `@alias`-style barrels fail at `k6 run` / `k6 inspect`.
- Barrels exist for the layers other code imports: `source/utils/exports/{config,types,helpers,data,apis,flows}.exp.ts`. Entry-point folders (`tests/`, `seeds/`) have no barrel — nothing imports them; k6 runs their files directly.
- Adding a module to a layer means adding its `export *` line to that layer's barrel in `source/utils/exports/`, or its members stay unreachable through the barrel.
- Export names are unique across a layer. `export *` silently drops a name exported by two modules and any use of it through the barrel then errors — this is why `SaveResult` is split into `EventSaveResult` / `ServiceOrderSaveResult`.
- Consume lower layers through their barrels; never import your own layer's barrel. A module that needs a peer in the same folder imports it by its direct file path (`./helpers.ts`), keeping the barrel out of any same-layer cycle. Layering: `config`/`types` (leaves) → `helpers` → `data` → `apis` → `flows` → `tests`/`seeds`.
