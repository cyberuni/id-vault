---
'id-vault': major
---

Harden the ID vault token, and stop disabling the vault by default.

Breaking changes:

- Every token changes. The token is now `HMAC-SHA-256` keyed by the seed, over the length-prefixed UTF-8 of the scope and the name. A provider and a consumer must both upgrade: a 1.x ID fails `assertID` in 2.0, and a 2.0 ID fails in 1.x.
- The token covers the scope. An ID taken from one scope no longer passes in another scope or in an unscoped vault with the same seed.
- `createIDVault` throws a `TypeError` on a seed under 16 bytes of UTF-8, including `''`. Use 16 random bytes, for example from `crypto.getRandomValues`, encoded as hex.
- The `encode` option is removed. Passing it throws a `TypeError`. A custom encoder saw only `seed + ':' + name`, so it could not bind the scope or keep the fields apart.
- An invalid ID no longer disables the vault. `assertID` throws and notifies the listeners on every invalid ID, and the vault keeps working. Pass `disableOnInvalid: true` to keep the 1.x behavior.
- `onInvalidID` listeners run on every invalid ID, not only the first.
- `createID` and `createIDVault` throw a `TypeError` on a name or scope that contains a lone surrogate. `assertID` rejects such an ID.
- The package needs node 20.19 or later, because its hash dependency, `@noble/hashes`, is ESM only.
- `crypto-js` is no longer a dependency. Node and browsers run the same `@noble/hashes` code, so a browser bundle no longer pulls in `node:crypto`.

Additions:

- The `disableOnInvalid` option.
- The `MIN_SEED_BYTES` constant (`16`).
