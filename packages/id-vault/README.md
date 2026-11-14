# id-vault

[![NPM version][npm-image]][npm-url]
[![NPM downloads][downloads-image]][npm-url]

Create IDs from a shared seed, and check that an ID was made with that seed.

Two pieces of code that share a seed can recognize each other's IDs.
Code without the seed cannot compute a matching ID.
A store, a registry, or a message bus can use this to accept requests only from code that was given the seed.

## Install

```sh
npm install id-vault
```

## Usage

```ts
import { createIDVault } from 'id-vault'

// Code that owns a resource checks IDs.
const provider = createIDVault(seed)

// Code that uses the resource creates IDs with the same seed.
const consumer = createIDVault(seed)
const id = consumer.createID('my-module.v1.store-key')
// 'my-module.v1.store-key:<64 hex characters>'

provider.assertID(id) // returns
provider.assertID('my-module.v1.store-key:0000') // throws, and disables `provider`
```

Share the seed out of band, for example at build time or at load time.
The vault does not generate the seed.
Use a long random value, and keep it away from code you do not trust.

The `scope` option lets one check site serve several vaults.
For example, one function passed as the [stable-store] `keyAssertion` of stores that different vaults guard.
See [Checking IDs for several vaults](#checking-ids-for-several-vaults).

## API

### `createIDVault(seed, options?)`

Returns a frozen vault object.
Every vault that creates or checks the same IDs needs the same `seed`, `encode`, and `scope`.

Options (type `IDVaultOptions`):

- `encode: (input: string) => string`: the function that turns the seed and the name into a token.
  It defaults to SHA-256, returned as 64 lowercase hex characters.
  The token must not contain `:`.
- `scope: string`: a prefix for the IDs this vault creates and checks.
  It throws a `TypeError` if `scope` is an empty string.
  A scope may contain `:`.

### `vault.createID(name)`

Returns `name:token`, or `scope:name:token` when the vault has a scope.
The token is `encode(seed + ':' + name)`.
A name may contain `:`.

It throws if the vault is disabled, or if `encode` returns a token that contains `:`.

### `vault.assertID(id)`

Returns if this vault created the ID, or a vault with the same seed, `encode`, and `scope`.
Otherwise it throws `Error('Detected invalid id: <id>')` and disables the vault.

That includes every ID of another scope, and every scoped ID passed to a vault without a scope.
The last `:` in the ID separates the token from the rest.
Tokens are compared in constant time.

It throws if the vault is disabled.

### `vault.isOwnID(id)`

Returns `true` if the ID starts with `scope:`.
A vault without a scope returns `true` for every ID.
It does not check the token, and it never disables the vault.

### `vault.onInvalidID(listener)`

Registers `listener(invalidId)` and returns a function that removes it.
The listeners run in order when `assertID` first finds an invalid ID, before `assertID` throws.

A listener that throws does not stop the others, and does not replace the `assertID` error.
Its error goes to `console.error`.

`vault.detectedInvalidID(listener)` is a deprecated alias.

## Checking IDs for several vaults

A shared check site that serves several vaults picks the vault with `isOwnID`, then calls its `assertID`.
Reject an ID that no vault claims.

```ts
const vaults = [createIDVault(seedA, { scope: 'a' }), createIDVault(seedB, { scope: 'b' })]

function checkID(id: string) {
	const vault = vaults.find((v) => v.isOwnID(id))
	if (!vault) throw new Error(`unknown id: ${id}`)
	vault.assertID(id)
}
```

Before version 2, `assertID` returned without checking an ID of another scope.
A check site that ran every vault's `assertID` on every ID accepted any ID that no vault claimed.

## Disabling

The first invalid ID disables the vault, including `''`.
After that, `createID` and `assertID` throw `Error('vault disabled as invalid id was detected: <id>')`.
Create a new vault to recover.

Any code that can reach `assertID` can disable the vault for everyone who shares it.

## Limits

- The token does not include the scope.
  The same seed and name give the same token in every scope.
- The default token is `SHA-256(seed + ':' + name)`, not an HMAC.

## Platforms

The package ships ESM (`esm/`) and CommonJS (`cjs/`) builds with type declarations.

The default encoder imports `node:crypto`.
The package has no `browser` export condition, so a browser bundle resolves that same encoder.
The import happens even when you pass your own `encode` function.
A browser bundle needs a resolution or a stub for `node:crypto`.
The package also ships a `crypto-js` encoder (`encoder.browser.js`), but the entry point does not use it.

[downloads-image]: https://img.shields.io/npm/dm/id-vault.svg?style=flat
[npm-image]: https://img.shields.io/npm/v/id-vault.svg?style=flat
[npm-url]: https://npmjs.org/package/id-vault
[stable-store]: https://npmjs.org/package/stable-store
