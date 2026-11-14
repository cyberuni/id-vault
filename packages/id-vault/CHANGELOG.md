# id-vault

## 2.0.0

### Major Changes

- c1b2548: `assertID` now rejects every ID the vault cannot verify.
  
  Breaking changes:
  
  - A vault without a scope used to skip any ID with two or more `:`. It now checks the ID and throws if the token does not match. A scoped ID passed to it throws.
  - A scoped vault used to skip any ID that did not start with its scope. It now throws on those IDs.
  - `createIDVault(seed, { scope: '' })` throws a `TypeError`. It used to create an unscoped vault.
  - `assertID('')` is handled like every other invalid ID.
  
  If shared code checks IDs for several scoped vaults, pick the vault with the new `vault.isOwnID(id)` and reject an ID that no vault claims.
  
  Fixes:
  
  - A name that contains `:` now works in a scoped vault. It used to make the vault reject its own ID and disable itself.
  - A scope that contains `:` now works. It used to make `assertID` skip every ID.
  - Tokens are compared in constant time.
  - A listener that throws no longer replaces the `assertID` error or stops later listeners. Its error goes to `console.error`.
  
  Additions:
  
  - `vault.isOwnID(id)`.
  - `vault.onInvalidID(listener)` returns a function that removes the listener. `detectedInvalidID` is a deprecated alias and also returns it.
  - `IDVaultOptions` is exported.
- 1b6495e: Drop the CommonJS build.
  
  The package is ESM only. It ships `esm/` and no longer ships `cjs/`, and the `exports` map has no `require` condition. `main` is removed, and `types` points at `esm/index.d.ts`.
  
  Load it with `import`. `require('id-vault')` still works on node 20.19 to 20.x and on 22.12 and later, which load an ES module through `require()`. Node 21 and 22.0 to 22.11 need the `--experimental-require-module` flag for that.
  
  The node floor stays at 20.19, the floor that `@noble/hashes` 2.x sets in its `engines`.
- 959f198: Harden the ID vault token, and stop disabling the vault by default.
  
  Breaking changes:
  
  - Every token changes. The token is now `HMAC-SHA-256` keyed by the seed, over the length-prefixed UTF-8 of the scope and the name. A provider and a consumer must both upgrade: a 1.x ID fails `assertID` in 2.0, and a 2.0 ID fails in 1.x.
  - The token covers the scope. An ID taken from one scope no longer passes in another scope or in an unscoped vault with the same seed.
  - `createIDVault` throws a `TypeError` on a seed under 16 bytes of UTF-8, including `''`. Use 16 random bytes, for example from `crypto.getRandomValues`, encoded as hex.
  - The `encode` option is removed. Passing it throws a `TypeError`. A custom encoder saw only `seed + ':' + name`, so it could not bind the scope or keep the fields apart.
  - An invalid ID no longer disables the vault. `assertID` throws and notifies the listeners on every invalid ID, and the vault keeps working. Pass `disableOnInvalid: true` to keep the 1.x behavior.
  - `onInvalidID` listeners run on every invalid ID, not only the first.
  - `createID` and `createIDVault` throw a `TypeError` on a name or scope that contains a lone surrogate. `assertID` rejects such an ID.
  - The package needs node 20.19 or later, the floor that its hash dependency, `@noble/hashes` 2.x, sets.
  - `crypto-js` is no longer a dependency. Node and browsers run the same `@noble/hashes` code, so a browser bundle no longer pulls in `node:crypto`.
  
  Additions:
  
  - The `disableOnInvalid` option.
  - The `MIN_SEED_BYTES` constant (`16`).

### Minor Changes

- d59e5e6: Add `createKeyVault()`, a vault that hands out key objects instead of string IDs.
  
  `vault.createKey(name)` returns a frozen key. `vault.assertKey(key)` throws unless this vault created it, and `vault.isOwnKey(key)` returns the same answer as a boolean. The check uses a private class field, so it needs no seed, a copy or a `Proxy` of a key fails it, and replacing built-ins after the package loads does not change it.
  
  Use it when the code that gives access and the code that checks it run in the same realm. Use `createIDVault` when an ID must cross a realm or be serialized.

### Patch Changes

- 267f062: Build the package with tsdown instead of `tsc`.
  
  The published paths are unchanged. Two details of the emitted output differ: the
  node encoder now imports `node:crypto` rather than a bare `crypto`, which is what
  lets that module load under Deno; and `index.js` and `index.d.ts` no longer ship
  source maps.
- dae03d3: Rewrite the README.

## 1.0.0

### Major Changes

- fb28bc7: Initial release.
