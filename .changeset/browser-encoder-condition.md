---
'id-vault': patch
---

Resolve the browser encoder in browser bundles.

`exports` now has a `browser` condition. It points at `esm/browser/index.js` and
`cjs/browser/index.js`, which use the `crypto-js` encoder. Before this change, a
browser bundle got the node build, which imports `node:crypto`, so the build failed
or the page threw at load. Passing your own `encode` did not help, because the import
was static. Node resolution is unchanged.
