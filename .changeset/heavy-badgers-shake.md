---
'id-vault': patch
---

Build the package with tsdown instead of `tsc`.

The published paths are unchanged. Three details of the emitted output differ: the
node encoder now imports `node:crypto` rather than a bare `crypto`, which is what
lets that module load under Deno; `index.js` and `index.d.ts` no longer ship source
maps; and the CommonJS output carries a small `cjs/_virtual/_rolldown/runtime.js`
helper chunk.
