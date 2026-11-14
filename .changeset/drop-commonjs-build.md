---
'id-vault': major
---

Drop the CommonJS build.

The package is ESM only. It ships `esm/` and no longer ships `cjs/`, and the `exports` map has no `require` condition. `main` is removed, and `types` points at `esm/index.d.ts`.

Load it with `import`. `require('id-vault')` still works on node 20.19 to 20.x and on 22.12 and later, which load an ES module through `require()`. Node 21 and 22.0 to 22.11 need the `--experimental-require-module` flag for that.

The node floor stays at 20.19, the floor that `@noble/hashes` 2.x sets in its `engines`.
