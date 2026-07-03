---
paths: ["source/data/**"]
---

# Data & Fixture Conventions (`source/data/`)

## Layout
Data is split first by kind (`payloads/` request bodies, `uploads/` file fixtures, `creds/` user pool),
then within `payloads/`/`uploads/` by module (with a sub-module level when a module has several flows),
mirroring `source/apis/` and the app nav (`#/momentusAssistant/<page>`):

```
source/data/
  creds/users.data.ts                        # cross-cutting user pool (encrypted, committed)
  payloads/<module>/*.data.ts                # request-body data for that module's flows
  payloads/<module>/<sub>/*.data.ts          # add a sub-module level only when a module needs it
  payloads/<module>/helpers.ts               # optional module-local helper shared by that module's builders
  uploads/<module>/<sub>/                    # files fed to http.file()
```

Module (and sub-module) names match the corresponding `source/apis/<feature>.api.ts` wrapper and the
test file's feature area, so a reader can jump between wrapper, data, and test without guessing.

## Request-body data — `source/data/payloads/<module>/`
Request bodies are **TS object builders**, never `.json`/`.txt` templates loaded via `open()`:
- Export a function that takes the runtime-varying values as parameters (e.g. `runToken`, a
  correlated row) and returns the payload object/array — `manualEntryPayload(runToken)`,
  `copyFormPayload(encUserId, source)`, `searchPayload(searchValue)`.
- Per-iteration uniqueness is interpolated inside the builder (template literals), not by
  `{{runToken}}` string substitution on opened text.
- Builders may import types from the types barrel and shared transforms from the helpers barrel, and carry logic. They stay in `source/data/payloads/`, not elsewhere in `source/`.
- Logic shared across a single module's builders lives in a module-local `helpers.ts` (e.g. `source/data/payloads/events/helpers.ts` for `todayMidnightUtc`). Once a transform is shared across more than one data module, promote it to `source/utils/helpers/payload.helper.ts` (transport-envelope cell setters/readers, e.g. `setRowValue`) rather than duplicating it per module — see `rules/helpers.md`.
- Callers import and call the builder directly in the VU function — no init-context `open()`.

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
- Decrypted once at runtime in a test/seed `setup()` via `decryptUsers(userCredentials, config.cryptoKey)`
  (`source/utils/helpers/crypto.helper.ts`), returning `User[]`. The passphrase is `config.cryptoKey`, sourced from a
  gitignored `temp/secret.json` (`npm run secret -- --key '<passphrase>'`; in CI, injected from a masked pipeline
  secret), never committed; `setup()` throws if it is missing.
- Decryption is async (WebCrypto `crypto.subtle`), so it lives in `setup()` — never a `SharedArray`/init context. The
  decrypted `User[]` is returned in the `setup()` data and picked with `pickUser(data.users)` from
  `source/utils/helpers/users.helper.ts` (see `rules/tests.md`).
- **Rotate/add accounts** by re-minting the encrypted values and pasting them into `users.data.ts`. The snippet
  reads the passphrase from `temp/secret.json` (write it first with `npm run secret -- --key '<passphrase>'`),
  takes a `{ username: plaintext-password }` map as its argument, and prints the `{ username, password }` array to
  paste; its encrypt path mirrors `crypto.helper.ts` (same UTF-16 bytes, `SHA-256` key, 12-byte IV prepended):
  ```bash
  node -e "const c=require('crypto').webcrypto,fs=require('fs');(async()=>{const pass=JSON.parse(fs.readFileSync('temp/secret.json')).key;const users=JSON.parse(process.argv[1]);const u16=s=>Buffer.from(s,'utf16le');const key=await c.subtle.importKey('raw',await c.subtle.digest('SHA-256',u16(pass)),'AES-GCM',false,['encrypt']);const out=[];for(const[n,p]of Object.entries(users)){const iv=c.getRandomValues(new Uint8Array(12));const ct=Buffer.from(await c.subtle.encrypt({name:'AES-GCM',iv},key,u16(p)));out.push({username:n,password:Buffer.concat([Buffer.from(iv),ct]).toString('base64')});}console.log(JSON.stringify(out,null,2));})()" '{"username":"plaintext-password"}'
  ```

## Loading rules
- Request-body builders are imported as TS modules — no `open()`.
- The user pool ships as `userCredentials` (encrypted) in `users.data.ts` and is decrypted in `setup()` (see User pool), keyed by `config.cryptoKey`.
- `open()` is reserved for `source/data/uploads/**` fixtures and is init-context only — never inside
  the VU function (see `rules/tests.md`).
