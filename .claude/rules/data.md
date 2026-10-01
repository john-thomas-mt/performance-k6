---
paths: ["source/data/**"]
---

# Data & Fixture Conventions (`source/data/`)

## Layout
Data is split first by kind (`payloads/` request bodies, `pools/` value pools a journey selects from,
`uploads/` file fixtures, `creds/` user pool), then within `payloads/`/`uploads/` by module (with a
sub-module level when a module has several flows), mirroring `source/apis/` and the app nav
(`#/momentusAssistant/<page>`):

```
source/data/
  creds/users.data.ts                        # cross-cutting user pool (encrypted, committed)
  pools/<pool>.data.ts                       # generated value pool, one per NeoLoad data variable
  payloads/<module>/*.data.ts                # request-body data for that module's flows
  payloads/<module>/<sub>/*.data.ts          # add a sub-module level only when a module needs it
  payloads/<module>/helpers.ts               # optional module-local helper shared by that module's builders
  uploads/<module>/<sub>/                    # files fed to http.file()
```

The generated fidelity-tier kinds (`chrome/`, `static/`, `transport/`) are covered by `rules/fidelity.md`.

Module (and sub-module) names match the corresponding `source/apis/<feature>.api.ts` wrapper and the
test file's feature area, so a reader can jump between wrapper, data, and test without guessing.

## Request-body data — `source/data/payloads/<module>/`
Request bodies are **TS object builders**, never `.json`/`.txt` templates loaded via `open()`:
- Export a function that takes the runtime-varying values as parameters (e.g. `runToken`, a
  correlated row) and returns the payload object/array — `manualEntryPayload(runToken)`,
  `copyFormPayload(encUserId, source)`, `searchPayload(searchValue)`.
- Per-iteration uniqueness is interpolated inside the builder (template literals), not by
  `{{runToken}}` string substitution on opened text.
- Return the payload literal directly from the builder arrow (`export const x = (...) => [...]`) so each
  call yields a fresh object; don't wrap it in a pointless `const payload = [...]; return payload`, and
  never hoist a captured body to a shared module-level `const` mutated or copied per call. (A
  module-level table *builder function* is fine — it returns a fresh literal each call; see below.)
- Weave every varying value into the literal at its own cell — a run marker, a computed date, and
  per-record identity re-correlated from a runtime `source` row alike (see `rules/scripting.md`).
  Inside a columnar transport table the cell is the numeric `Values` key matching that column's
  `ColumnID` (`"41": Number(so.orderNbr)`), mapped once against the `TransportDataColumns` array;
  never a post-build mutation of the row by column name.
- Extract each nested transport table (`TransportDataColumns` + `TransportDataRows`) into its own
  module-level builder that takes the correlated values and returns a fresh `TransportTable` —
  `orderTable(so, orderDate)`, `itemsTable(so, quantity)` — so the payload arrow plugs the builders in
  and reads as a skeleton. Put the exported payload builder at the top of the module, directly under
  the imports, with the table builders and any module-local plumbing (constants, `helpers.ts` calls)
  below it, so a reader meets the payload shape first and the long column tables as supporting detail
  (the arrow references builders declared lower in the file, which is safe — they're only called at VU
  runtime, never at module load). Annotate each builder `: TransportTable` so a structurally malformed
  table is caught at the builder. Non-varying cells stay as captured constants; a captured constant that is
  load-bearing (the server rejects the save without it) gets a short why-comment at the cell (see
  `rules/comments.md`).
- Builders may import types from the types barrel and shared transforms from the helpers barrel, and carry logic. They stay in `source/data/payloads/`, not elsewhere in `source/`.
- Logic shared across a single module's builders lives in a module-local `helpers.ts`. Once a transform is shared across more than one data module, promote it to `source/utils/helpers/payload.helper.ts` (e.g. `today_midnight_utc`, shared by the event and service-order date windows) rather than duplicating it per module — see `rules/helpers.md`.
- Callers import and call the builder directly in the VU function — no init-context `open()`.

## Value pools — `source/data/pools/`
A pool is the set of *existing* records a journey picks its input from — the k6 home for a NeoLoad
`<variable-file>` / `<variable-list>` data variable (`${P_26_2_CopyEvents.eventName}`). One module per
NeoLoad variable, named for the variable (`copy-events.data.ts` ← `P_26_2_CopyEvents`), exporting a
`string[]` for a single column, or an array of row objects when a journey needs several columns of the
same row together.

- **Pools are generated, complete, and not hand-edited.** Write one with
  `node .claude/scripts/gen-pool.cjs <path in the NeoLoad project> <P_VarName> <column> source/data/pools/<name>.data.ts`,
  which resolves the variable's definition and emits every row behind a do-not-hand-edit header (the same
  generate-don't-transcribe rule the captured-payload builders follow). `node .claude/scripts/neoload-vars.cjs "<VU tree>"`
  prints the ready-to-run command for every pool a VU references. Carrying only the first few rows
  narrows the data spread the run exercises — a run that touches 5 spaces instead of 824 is not the
  recorded workload, and it passes every check while doing it, so completeness is the pool's whole point.
- **Select with `pick_pool_value(pool)`** (helpers barrel) rather than indexing in the flow, so every
  journey spreads across the pool the same way and concurrent VUs land on different rows.
- **A pool holds pre-existing records the journey reads; rows a seed creates are discovered at runtime
  instead.** When a NeoLoad data file's rows share a long generated prefix (`Performance BookingEvent
  <epoch>`), that file is its paired data-script VU's output: the k6 port finds those rows through the
  seed marker (`rules/seeds.md`), and no pool module is generated. `neoload-vars.cjs` flags the prefix.
- **A value the recording varies stays varied here.** A NeoLoad variable with two or more rows is a pool
  even when it is short (a 2-value scope flag) — collapsing it to one literal in the flow drops a
  branch the recording exercised. A single-row `<variable-list>` (the env/version matrix) is a lookup,
  not a pool: it belongs in `source/config/`.

## Upload fixtures — `source/data/uploads/<module>/<sub>/`
Anything passed to `http.file()` goes here, never in the request-body folders:
- Opened by literal path in the init context: `open('../data/uploads/<module>/<sub>/<file>')`
- Binary fixtures (pdf, images, xlsx) must use binary mode: `open(path, 'b')`
- Name fixtures for their content, not the consuming test (e.g. `sample-opportunity.txt`)

## User pool — `source/data/creds/users.data.ts`
- A TS module exporting `userCredentials: User[]` — **committed**, an array of `{ username, password }` pairs
  where the `password` is AES-GCM-encrypted (base64 of `iv | ciphertext`) and the username stays plaintext. The
  AES key is `SHA-256(passphrase)` with no salt or KDF stretching: these are low-value QE accounts and the only
  goal is keeping passwords out of the repo — don't reuse this scheme for anything sensitive.
- Decrypted once at runtime in a test/seed `setup()` via `decrypt_users(userCredentials, config.cryptoKey)`
  (`source/utils/helpers/crypto.helper.ts`), returning `User[]`. The passphrase is `config.cryptoKey`, sourced from a
  gitignored `temp/secret.json` (`npm run secret -- --key '<passphrase>'`; in CI, injected from a masked pipeline
  secret), never committed; `setup()` throws if it is missing.
- Decryption is async (WebCrypto `crypto.subtle`), so it lives in `setup()` — never a `SharedArray`/init context. The
  decrypted `User[]` is returned in the `setup()` data and picked with `pick_user(data.users)` from
  `source/utils/helpers/users.helper.ts` (see `rules/tests.md`).
- **Rotate/add accounts** by re-minting the encrypted values and pasting them into `users.data.ts`. The snippet
  reads the passphrase from `temp/secret.json` (write it first with `npm run secret -- --key '<passphrase>'`),
  takes a `{ username: plaintext-password }` map as its argument, and prints the `{ username, password }` array to
  paste; its encrypt path mirrors `crypto.helper.ts` (same UTF-16 bytes, `SHA-256` key, 12-byte IV prepended):
  ```bash
  node -e "const c=require('crypto').webcrypto,fs=require('fs');(async()=>{const pass=JSON.parse(fs.readFileSync('temp/secret.json')).key;const users=JSON.parse(process.argv[1]);const u16=s=>Buffer.from(s,'utf16le');const key=await c.subtle.importKey('raw',await c.subtle.digest('SHA-256',u16(pass)),'AES-GCM',false,['encrypt']);const out=[];for(const[n,p]of Object.entries(users)){const iv=c.getRandomValues(new Uint8Array(12));const ct=Buffer.from(await c.subtle.encrypt({name:'AES-GCM',iv},key,u16(p)));out.push({username:n,password:Buffer.concat([Buffer.from(iv),ct]).toString('base64')});}console.log(JSON.stringify(out,null,2));})()" '{"username":"plaintext-password"}'
  ```

## Public-API credentials — `source/data/creds/api.data.ts`
- `publicApiCredentials: ApiCredentials` (`{ userId, key, secret }`) for journeys that call the Momentus public REST API (`/api/v1/…`) instead of signing in: `userId` plaintext, `key` and `secret` encrypted with the same scheme and `temp/secret.json` passphrase as the user pool. They come from the NeoLoad `P_API_UserId` / `P_API_Key` / `P_API_Secret` password variables, whose values the user supplies (NeoLoad-encrypted, not readable from the project).
- `setup()` decrypts them with `decrypt_api_credentials(publicApiCredentials, config.cryptoKey)`, gated to the scenarios that need them. The flow mints a fresh HS256 JWT per iteration with `mint_api_jwt(data.apiCredentials)` and sends it via `public_api_headers(jwt)`.
- Mint the ciphertexts with the user-pool snippet above (one entry per value) and paste only the encrypted strings.

## Loading rules
- Request-body builders and pools are imported as TS modules — no `open()`.
- The user pool ships as `userCredentials` (encrypted) in `users.data.ts` and is decrypted in `setup()` (see User pool), keyed by `config.cryptoKey`.
- `open()` is reserved for `source/data/uploads/**` fixtures and is init-context only — never inside
  the VU function (see `rules/tests.md`).
