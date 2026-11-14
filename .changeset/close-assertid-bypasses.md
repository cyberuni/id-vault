---
'id-vault': major
---

`assertID` now rejects every ID the vault cannot verify.

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
