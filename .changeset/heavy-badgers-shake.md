---
'id-vault': patch
---

Build the package with tsdown instead of `tsc`.

The published paths are unchanged. Two details of the emitted output differ: the
node encoder now imports `node:crypto` rather than a bare `crypto`, which is what
lets that module load under Deno; and `index.js` and `index.d.ts` no longer ship
source maps.
