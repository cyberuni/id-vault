# id-vault

[![NPM version][npm-image]][npm-url]
[![NPM downloads][downloads-image]][npm-url]

Hand out access to a resource, and check that a caller was given it.

The package has two vaults:

- `createKeyVault()` hands out key objects and checks them. Use it when the code that gives access and the code that checks it run in the same JavaScript realm.
- `createIDVault(seed)` creates string IDs from a shared seed and checks them. Use it when an ID must cross a realm (an iframe, a worker, `postMessage`) or be serialized.

## What it protects against

Both vaults are a guardrail against careless code in the same realm.
They stop a module from reaching a resource by guessing or copying a well-known name.

They are not a boundary against hostile code in the same realm.
No library can be one:

- Code that loads first can replace the built-ins the vault calls, and read the seed as the vault uses it.
- Code that loads first can replace this package before the provider imports it.
- A seed set at build time is a string in a bundle. Any script on the page can fetch that bundle and read it.
- Code that sees a valid ID once can copy it and use it again.

An app that needs a boundary must lock down the realm itself, for example with SES `lockdown()` from the [`ses`][ses] package, or run untrusted code in a separate realm.
The reasoning and the experiments behind this are in [`.research/id-vault-design`][research].

## Install

```sh
npm install id-vault
```

It needs node 20.19 or later.
It runs in browsers with no `node:crypto` and no polyfill.

## Key vault

```ts
import { createKeyVault, type VaultKey } from 'id-vault'

// Code that owns a resource creates the vault and the keys.
const vault = createKeyVault()
const key = vault.createKey('my-module.store')

// Give `key` to the code that may use the resource.
// The resource checks it on each call.
function getStore(key: VaultKey) {
	vault.assertKey(key)
	return stores.get(key.name)
}

getStore(key) // returns
getStore({ name: 'my-module.store' }) // throws
```

A key carries no secret.
The object reference itself grants access, so there is no seed to share, leak, or rotate.
Code that sees a key cannot create another one, and a copy of a key is not a key.

### `createKeyVault()`

Returns a frozen `KeyVault`.

### `vault.createKey(name)`

Returns a new frozen key, a `VaultKey` with a read-only `name`.
Every call returns a different object, and every key the vault creates is valid.
The name is a label, not a secret.

It throws a `TypeError` if `name` is not a string.

### `vault.assertKey(key)`

Returns if this vault created `key`.
Otherwise it throws `Error('Detected invalid key')`.

That includes a key of another vault, a plain object with the same `name`, a spread or `structuredClone` copy, an object whose prototype is a key, and a `Proxy` of a key.
The message does not include the value, because turning a `Proxy` into a string would run its code.
In TypeScript, it narrows `key` to `VaultKey`.

### `vault.isOwnKey(key)`

Returns `true` exactly when `assertKey(key)` would return.
Unlike `IDVault.isOwnID()`, it is the full check.

### How the check works

Each key holds its vault in a private class field.
The check is `#issuer in key && key.#issuer === issuer`, which is syntax and calls no method.
Code that replaces `Reflect`, `Object`, `WeakMap`, or any other built-in after this module loads cannot change the result.
A `Proxy` has no private fields, so it fails the check without running its traps.
The package captures `Object.freeze` when it loads, so a later replacement cannot make a key's `name` writable.

A key does not cross a realm.
A key from an iframe's copy of the package fails the check in the parent page, because each realm has its own class.

## ID vault

```ts
import { createIDVault } from 'id-vault'

// Code that owns a resource checks IDs.
const provider = createIDVault(seed)

// Code that uses the resource creates IDs with the same seed.
const consumer = createIDVault(seed)
const id = consumer.createID('my-module.store')
// 'my-module.store:<64 hex characters>'

provider.assertID(id) // returns
provider.assertID('my-module.store:0000') // throws
```

Share the seed out of band, for example at build time or at load time.
The vault does not generate the seed.

### Seed

The seed must be at least 16 bytes of UTF-8, which is 128 bits.
`createIDVault` throws a `TypeError` on a shorter seed, including `''`, and on a seed that is not a string.
The length is counted in bytes: `'é'.repeat(8)` is 16 bytes and passes.

Length is the only thing the vault can check.
The seed's randomness is the whole of its strength, so generate it:

```ts
const seed = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('')
```

The constant `MIN_SEED_BYTES` is `16`.

### Token

An ID is `name:token`, or `scope:name:token` when the vault has a scope.
The token is 64 lowercase hex characters:

```text
HMAC-SHA-256(key = UTF-8(seed), message = field(scope) ‖ field(name))
field(s) = 4-byte big-endian length of UTF-8(s) ‖ UTF-8(s)
```

A vault without a scope uses `''` as the scope.
No scoped vault can have `''`, so no unscoped ID matches a scoped one.

The length prefix makes the encoding unambiguous.
No other seed, scope, and name give the same input to the HMAC, whatever `:` characters they contain.
The scope is part of the input, so an ID cannot move from one scope to another.

The HMAC comes from [`@noble/hashes`][noble-hashes], which is pure JavaScript and synchronous.
Node and browsers run the same code.
`assertID` compares tokens in constant time.

Names and scopes must be well-formed UTF-16.
UTF-8 turns a lone surrogate into U+FFFD, so two names would otherwise share a token.

### `createIDVault(seed, options?)`

Returns a frozen `IDVault`.
Every vault that creates or checks the same IDs needs the same `seed` and `scope`.

Options (type `IDVaultOptions`):

- `scope: string`: a prefix for the IDs this vault creates and checks.
  It throws a `TypeError` if `scope` is `''` or contains a lone surrogate.
  A scope may contain `:`.
- `disableOnInvalid: boolean`: disable the vault on the first invalid ID. It defaults to `false`.
  See [Disabling](#disabling).

It throws a `TypeError` if you pass `encode`, which version 2 removed.
See [Why `encode` is gone](#why-encode-is-gone).

### `vault.createID(name)`

Returns `name:token`, or `scope:name:token`.
A name may contain `:`.

It throws a `TypeError` if `name` contains a lone surrogate.
It throws if the vault is disabled.

### `vault.assertID(id)`

Returns if this vault, or a vault with the same seed and scope, created the ID.
Otherwise it notifies the listeners, then throws `Error('Detected invalid id: <id>')`.

That includes every ID of another scope, and every scoped ID passed to a vault without a scope.
The last `:` in the ID separates the token from the rest.

It throws if the vault is disabled.

### `vault.isOwnID(id)`

Returns `true` if the ID starts with `scope:`.
A vault without a scope returns `true` for every ID.
It does not check the token, and it never notifies listeners.

### `vault.onInvalidID(listener)`

Registers `listener(invalidId)` and returns a function that removes it.
The listeners run in order on every invalid ID, before `assertID` throws.

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

## Disabling

By default an invalid ID does not disable the vault.
`assertID` throws and notifies the listeners each time, and the vault keeps working.

With `disableOnInvalid: true`, the first invalid ID disables the vault, including `''`.
After that, `createID` and `assertID` throw `Error('vault disabled as invalid id was detected: <id>')` without notifying listeners.
Create a new vault to recover.

Opt in only if you accept the cost.
Any code that can reach `assertID` can disable the vault for everyone who shares it, with one call.
The switch does not guard against guessing: a 256-bit HMAC tag cannot be guessed, and a new vault starts enabled.

## Why `encode` is gone

Version 1 let you replace the hash with `encode(seed + ':' + name)`.
Under that interface the encoder sees one joined string, so it cannot bind the scope or keep the fields apart.
Those two gaps let an ID move between scopes, and let a seed and a name trade characters.
The token is now always the HMAC above, and no option takes its place.
If you need another construction, build it on your side of the vault.

## Platforms

The package ships ESM (`esm/`) and CommonJS (`cjs/`) builds with type declarations.
Both depend on `@noble/hashes`, which is ESM only.
The CommonJS build loads it with `require()`, which node supports from 20.19.

The `exports` map has no `browser` condition, because node and browsers resolve the same files.

[downloads-image]: https://img.shields.io/npm/dm/id-vault.svg?style=flat
[noble-hashes]: https://github.com/paulmillr/noble-hashes
[npm-image]: https://img.shields.io/npm/v/id-vault.svg?style=flat
[npm-url]: https://npmjs.org/package/id-vault
[research]: https://github.com/cyberuni/id-vault/tree/main/.research/id-vault-design
[ses]: https://www.npmjs.com/package/ses
