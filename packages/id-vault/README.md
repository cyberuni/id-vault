# id-vault

[![NPM version][npm-image]][npm-url]
[![NPM downloads][downloads-image]][npm-url]

[id-vault] provides a secure ID generation and validation mechanism.

It allows one module to generate an ID and another module to validate the ID is valid.

## Usage

```ts
import { createVault } from 'id-vault'

// the seed is a random string
const vault = createVault(seed)

// generate a new ID
const id = vault.createID('some-key')

// assert the ID is valid
vault.assertID(id)
```

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

[downloads-image]: https://img.shields.io/npm/dm/unional/id-vault.svg?style=flat
[npm-image]: https://img.shields.io/npm/v/unional/id-vault.svg?style=flat
[npm-url]: https://npmjs.org/package/unional/id-vault
