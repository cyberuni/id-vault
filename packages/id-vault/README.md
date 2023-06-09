# id-vault

[![NPM version][npm-image]][npm-url]
[![NPM downloads][downloads-image]][npm-url]

[id-vault] provides a secure ID generation and validation mechanism.

## Usage

To use this vault,
the modules first share a some common secret out-of-band, the seed.

It can be a random string generated during build time, load time, or both.

Each module then creates a vault using the seed,
and use the vault to create or assert the id.

An example of using this vault is an MFE application using WebComponents.

Since it using WebComponents,
you can't use DOM attached states such as React Context to pass code from the host to the components.

At the same time, you also want to avoid relying on props as it is fragile.

But you still want to be able to share data and code so that each component can use the same data and code even if they are loaded from different bundles (or even different versions).

The solution is to provide a store by the host,
and each module can use the store to share data and code.

This vault can be used by the store to ensure only the modules with access to the seed can access the store.

The following is an example using [stable-store]:

```ts
// host
import { createVault } from 'id-vault'
import { registerIDAssertion } from 'stable-store'

const vault = createVault(seed)
registerIDAssertion(vault.assertID)

// module
import { createVault } from 'id-vault'
import { getStore } from 'stable-store'

const vault = createVault(seed)
const id = vault.createID('my-module.v1.store-key')

const store = getStore(id, { foo: 'bar' })

// bad guy
const store = getStore('some-other-id') // throws
```

The vault will be disabled if it ever encounter an invalid id to prevent any brute force attempts.

`createVault(seed, options)` takes an additional option.

- `options.encode`: specify an alternative encode function. By default, the vault uses `sha-256`.
- `options.scope`: specify a scope to validate.\
  The vault will validate ID with the same scope and ignores others.\
  This is useful when the vault is used in some shared code such as in [stable-store].

It goes without saying,
the vault which creates ID and the vault which asserts the ID must be created with the same seed, encode function, and scope.

Of course, you can also randomize them.

## Install

```sh
# npm
npm install id-vault

# yarn
yarn add id-vault

# pnpm
pnpm install id-vault

#rush
rush add -p id-vault
```

[downloads-image]: https://img.shields.io/npm/dm/id-vault.svg?style=flat
[npm-image]: https://img.shields.io/npm/v/id-vault.svg?style=flat
[npm-url]: https://npmjs.org/package/id-vault
[id-vault]: https://github.com/cyberuni/id-vault
