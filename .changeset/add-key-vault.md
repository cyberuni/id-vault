---
'id-vault': minor
---

Add `createKeyVault()`, a vault that hands out key objects instead of string IDs.

`vault.createKey(name)` returns a frozen key. `vault.assertKey(key)` throws unless this vault created it, and `vault.isOwnKey(key)` returns the same answer as a boolean. The check uses a private class field, so it needs no seed, a copy or a `Proxy` of a key fails it, and replacing built-ins after the package loads does not change it.

Use it when the code that gives access and the code that checks it run in the same realm. Use `createIDVault` when an ID must cross a realm or be serialized.
