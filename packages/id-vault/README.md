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

The `scope` option is meant for shared code that checks IDs on behalf of others, such as [stable-store].

## API

### `createIDVault(seed, options?)`

Returns a frozen vault object with three methods.
Every vault that creates or checks the same IDs needs the same `seed`, `encode`, and `scope`.

Options:

- `encode: (input: string) => string`: the function that turns the seed and the name into a token.
  It defaults to SHA-256, returned as 64 lowercase hex characters.
- `scope: string`: a prefix for the IDs this vault creates and checks.
  An empty string means no scope.

### `vault.createID(name)`

Returns `name:token`, or `scope:name:token` when the vault has a scope.
The token is `encode(seed + ':' + name)`.

It throws if the vault is disabled.

### `vault.assertID(id)`

Returns if the ID is valid, or if the vault does not check it.
Throws `Error('Detected invalid id: <id>')` if the token does not match.

A vault without a scope checks IDs that have at most one `:`.
It returns without checking any ID with two or more `:` characters.

A vault with a scope checks only IDs that start with `scope:`.
It returns without checking any other ID.

So `assertID` does not reject everything that was not created by the vault.
Check the ID format yourself before you rely on it.

It throws if the vault is disabled.

### `vault.detectedInvalidID(listener)`

Registers `listener(invalidId)`.
The listeners run in order when `assertID` first finds an invalid ID, before `assertID` throws.

If a listener throws, that error replaces the `assertID` error and the remaining listeners do not run.
There is no way to remove a listener.

## Disabling

The first invalid ID disables the vault.
After that, `createID` and `assertID` throw `Error('vault disabled as invalid id was detected: <id>')`.
Create a new vault to recover.

Any code that can reach `assertID` can disable the vault for everyone who shares it.

An empty string is the exception.
`assertID('')` throws and runs the listeners, but it does not disable the vault.

## Limits

- A name that contains `:` does not work with a scoped vault.
  `createID('a:b')` returns an ID that the same vault rejects, and the rejection disables the vault.
- A scope that contains `:` makes `assertID` skip every ID.
- Without a scope, a name that contains `:` gives an ID that `assertID` skips.
- The token does not include the scope.
  The same seed and name give the same token in every scope.
- The default token is `SHA-256(seed + ':' + name)`, not an HMAC.
- `assertID` compares tokens with `!==`, not in constant time.

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
