# id-vault

## 1.0.1

### Patch Changes

- 267f062: Build the package with tsdown instead of `tsc`.
  
  The published paths are unchanged. Three details of the emitted output differ: the
  node encoder now imports `node:crypto` rather than a bare `crypto`, which is what
  lets that module load under Deno; `index.js` and `index.d.ts` no longer ship source
  maps; and the CommonJS output carries a small `cjs/_virtual/_rolldown/runtime.js`
  helper chunk.

## 1.0.0

### Major Changes

- fb28bc7: Initial release.
