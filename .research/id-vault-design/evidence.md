# Evidence: id-vault design and alternatives

Each entry is one claim with its source. Entries are in ascending order by ID.
Confidence is how reliable the fact is.
Weight follows the research-evidence contract: an experiment we ran, or source code, outranks documentation, and documentation outranks secondary write-ups.
"Accessed" dates are the date we fetched the page.

Local experiments ran on Node v24.21.0 against the built `packages/id-vault/esm/index.js` at `6974d98`.
The scripts are reproduced under E02 and E06.

## E01: id-vault hashes `seed:name` with plain SHA-256 and leaves the scope out of the hash

- date: 2026-11-14
- status: verified
- confidence: high
- source.label: `packages/id-vault/ts/id_vault.ts` and `ts/encoder.ts` at `6974d98`
- source.url: https://github.com/cyberuni/id-vault/blob/6974d98/packages/id-vault/ts/id_vault.ts
- source.type: code
- notes: The token is `enc(`${seed}:${name}`)`. `enc` defaults to `createHash('sha256')` on Node and to `crypto-js` SHA-256 in `encoder.browser.ts`. The scope is prepended to the ID but is not hashed (PR #38 F8). The comparison is `!==` (F10). The first mismatch sets `intrudedId`, after which `createID` and `assertID` throw (F6). Everything is synchronous.

## E02: Code that loads before the vault can steal the seed through a shared built-in prototype

- date: 2026-11-14
- status: verified (experiment)
- confidence: high
- source.label: local experiment `attack.mjs`, case A
- source.url: n/a (script below)
- source.type: experiment
- notes: Patching `crypto.Hash.prototype.update` records every input, including `seed:name`. The script recovered a 256-bit random seed and forged an ID that `assertID` accepted. The browser path has the same exposure through `crypto-js` objects and `String.prototype` methods. The secret is safe only if no untrusted code runs before the vault and no shared intrinsic it uses is mutable.

```js
import crypto from 'node:crypto'
const { createIDVault } = await import(process.argv[2])
const seen = []
const origUpdate = crypto.Hash.prototype.update
crypto.Hash.prototype.update = function (d, ...r) { seen.push(String(d)); return origUpdate.call(this, d, ...r) }
const seed = crypto.randomBytes(32).toString('hex')
const provider = createIDVault(seed)
createIDVault(seed).createID('store')
const stolen = seen[0].slice(0, seen[0].lastIndexOf(':'))
provider.assertID(createIDVault(stolen).createID('admin')) // accepted
```

## E03: Code that patches `String.prototype.split` can make `assertID` skip any ID

- date: 2026-11-14
- status: verified (experiment)
- confidence: high
- source.label: local experiment `attack.mjs`, case B
- source.url: n/a
- source.type: experiment
- notes: A patched `split` that returns three parts makes the unscoped `assertID` return for `'evil'`. This works at any time, not only before the vault loads, because `assertID` calls `split` on every check. Fixing F1 removes this exact path, but any checker that calls a mutable built-in at check time has the same weakness.

## E04: One invalid call disables a shared vault for every caller

- date: 2026-11-14
- status: verified (experiment)
- confidence: high
- source.label: local experiment `attack.mjs`, case C
- source.url: n/a
- source.type: experiment
- notes: After `assertID('x:0')` throws, `createID('legit')` throws `vault disabled as invalid id was detected`. Any code that can reach `assertID` can do this, and reaching `assertID` is the point of the guard (F6).

## E05: A seed written as a literal is readable from the function's source text

- date: 2026-11-14
- status: verified (experiment)
- confidence: high
- source.label: local experiment `attack.mjs`, case D
- source.url: n/a
- source.type: experiment
- notes: `(() => createIDVault('literal-seed-123')).toString()` contains the seed. Any code that holds a reference to such a function can read it. See E16 and the bundler entries E18 and E19.

## E06: A private-field brand check rejects forgeries and survives patched built-ins

- date: 2026-11-14
- status: verified (experiment)
- confidence: high
- source.label: local experiment `cap.mjs`
- source.url: n/a
- source.type: experiment
- notes: `#brand in k` is syntax, so it calls no built-in that other code can replace. After patching `WeakSet.prototype.has`, `Object.prototype.hasOwnProperty`, and `Reflect.has`, the check returned true for a real instance and false for `Object.create(Key.prototype)` and for a `Proxy` of a real instance. A WeakSet or WeakMap check would not survive the same patching unless it captured the method before untrusted code ran.

```js
class Key { #brand; constructor(name) { this.name = name; Object.freeze(this) } static is(k) { return typeof k === 'object' && k !== null && #brand in k } }
```

## E07: stable-store, the named consumer, does not use id-vault and never runs its key assertion

- date: 2026-11-14
- status: verified (code)
- confidence: high
- source.label: stable-packages/store `packages/stable-store/ts/store.ts` at `3706d66`; npm `stable-store@1.0.0-beta.2`
- source.url: https://github.com/stable-packages/store/blob/3706d66f45e0819e95211b1fe3fe89f6c3d104b0/packages/stable-store/ts/store.ts
- source.type: code
- notes: stable-store has no dependency on id-vault. It takes a generic `keyAssertion?: (key: string | undefined) => void` in `StoreConfig`. `createStore` stores `ctx.storeMap[id] = [store]` and drops `keyAssertion`, so the check in `getStore` never runs. `createStore` with an existing `id` also returns the existing store with no check. Any caller that knows a store's `id` gets the store today, whatever id-vault does. Weekly downloads (npm API, 2026-11-07 to 11-13): id-vault 31, stable-store 6.

## E08: ShadowRealm is at TC39 Stage 2.7

- date: accessed 2026-11-14
- status: Stage 2.7 (spec draft dated 2025-02-10)
- confidence: high
- source.label: tc39/proposal-shadowrealm README; tc39/proposals README
- source.url: https://github.com/tc39/proposal-shadowrealm
- source.type: standards proposal
- notes: The README says "Currently at Stage 2.7". It lists a December 2024 Stage 3 request without an outcome. The proposals index lists a 2023-09 demotion to Stage 2 after implementer feedback. A ShadowRealm has its own global object and intrinsics, and only primitives and callable wrappers cross its boundary.

## E09: No runtime we checked ships ShadowRealm without a flag

- date: 2026-11-14
- status: partly verified
- confidence: medium (Node, Deno); low (browsers)
- source.label: local runs on Node v26.13.0 and Deno 2.9.8; Chromium, Firefox, and WebKit tracking bugs
- source.url: https://bugzilla.mozilla.org/show_bug.cgi?id=1747059 ; https://bugs.webkit.org/show_bug.cgi?id=283289
- source.type: experiment, issue threads
- notes: `typeof ShadowRealm` is `"undefined"` by default on both runtimes, and `"function"` on Node with `--experimental-shadow-realm`. We found no evidence of unflagged browser support, but we did not confirm its absence.

## E10: The Compartments proposal is at Stage 1

- date: accessed 2026-11-14
- status: Stage 1
- confidence: high
- source.label: tc39/proposal-compartments
- source.url: https://github.com/tc39/proposal-compartments
- source.type: standards proposal
- notes: A compartment has its own global object and evaluators, and shares the realm's intrinsics. The proposal is far from shipping, so the practical form today is the `ses` shim (E11).

## E11: SES `lockdown()` freezes the shared intrinsics, `harden()` freezes an object graph, and a `Compartment` gives code its own global

- date: accessed 2026-11-14
- status: current documentation
- confidence: high
- source.label: Endo, `packages/ses/README.md`
- source.url: https://github.com/endojs/endo/blob/master/packages/ses/README.md
- source.type: official docs
- notes: `lockdown()` "tamper-proofs all of the JavaScript intrinsics, to prevent prototype pollution", but does not remove powerful globals. A compartment receives host APIs only if they are passed in. The README names the "override mistake" as a compatibility cost: some code breaks once intrinsics are frozen. This is the platform answer to E02 and E03.

## E12: Hardened JavaScript is available and used; a seed-derived ID library like id-vault was not found

- date: 2026-11-14
- status: registry data
- confidence: medium
- source.label: `npm view` and the npm downloads API
- source.url: https://www.npmjs.com/package/ses
- source.type: package registry
- notes: `ses` 2.3.0 (modified 2026-08-13), about 390,000 downloads in the week of 2026-11-07. `@endo/harden` 1.1.0 is a harden shim for libraries. `@endo/exo` 1.7.0 builds hardened objects with defended methods. `capability-token` 0.6.1 was last published in 2022 and has about 12 weekly downloads. A registry search found no package that derives IDs from a seed for an in-process check. That is "not found", not "does not exist".

## E13: Private class elements cannot be named outside the class body

- date: page modified 2025-07-08
- status: current documentation
- confidence: high
- source.label: MDN, Private elements
- source.url: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes/Private_elements
- source.type: official docs
- notes: "It is a syntax error to refer to `#` names from outside of the class." Chrome DevTools can read them, which is a debugger exception, not a language feature. `#x in obj` is a brand check.

## E14: WeakMap entries cannot be reached through reflection

- date: page modified 2026-10-26
- status: current documentation
- confidence: high
- source.label: MDN, WeakMap
- source.url: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap
- source.type: official docs
- notes: There is "no way for user code to retrieve the metadata through reflective methods". This holds only while the WeakMap itself stays private, and its methods live on a mutable shared prototype unless the realm is locked down.

## E15: `Symbol()` is unique; `Symbol.for()` is a global, guessable registry

- date: page modified 2026-10-26
- status: current documentation
- confidence: high
- source.label: MDN, Symbol
- source.url: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol
- source.type: official docs
- notes: `Symbol.for("key")` returns the same symbol everywhere, across realms, so it is not a secret. A unique `Symbol()` used as a property key is still listed by `Object.getOwnPropertySymbols()`, so a symbol key hides nothing from code that holds the object.

## E16: `Function.prototype.toString` returns the source text of user functions

- date: page modified 2025-07-10
- status: current documentation
- confidence: high
- source.label: MDN, Function.prototype.toString
- source.url: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/toString
- source.type: official docs
- notes: A literal in a function body is exposed. A value held only in a closure variable is not. Matches E05.

## E17: Same-realm code can add to or replace members of shared prototypes

- date: accessed 2026-11-14
- status: current documentation
- confidence: medium
- source.label: PortSwigger Web Security Academy, Prototype pollution; OWASP Prototype Pollution Prevention Cheat Sheet
- source.url: https://portswigger.net/web-security/prototype-pollution ; https://cheatsheetseries.owasp.org/cheatsheets/Prototype_Pollution_Prevention_Cheat_Sheet.html
- source.type: security guidance (secondary)
- notes: Both describe adding properties to global prototypes. OWASP recommends `Object.freeze()` on built-in prototypes and notes it is shallow and can break libraries. Neither shows replacing `String.prototype.split` or a hash method. E02 and E03 are the direct evidence for that.

## E18: Vite replaces `define` constants and `VITE_*` variables with literals in the client bundle

- date: accessed 2026-11-14
- status: current documentation
- confidence: high
- source.label: Vite, Shared options (`define`); Env variables and modes
- source.url: https://vite.dev/config/shared-options.html ; https://vite.dev/guide/env-and-mode.html
- source.type: official docs
- notes: `define` entries are "statically replaced during build". `VITE_*` variables "will be exposed in client-side source code", and the docs say they should not hold sensitive information. A seed shared "at build time" through either path is a literal in a file that any script on the page can fetch.

## E19: webpack DefinePlugin inlines values into the code

- date: accessed 2026-11-14
- status: current documentation
- confidence: high
- source.label: webpack, DefinePlugin
- source.url: https://webpack.js.org/plugins/define-plugin/
- source.type: official docs
- notes: The plugin "replaces variables in your code with other values or expressions at compile time", and "the values will be inlined into the code". Same consequence as E18.

## E20: Node's `vm` module is not a security mechanism

- date: accessed 2026-11-14
- status: current documentation
- confidence: high
- source.label: Node.js, vm
- source.url: https://nodejs.org/api/vm.html
- source.type: official docs
- notes: "The `node:vm` module is not a security mechanism. Do not use it to run untrusted code."

## E21: Node's permission model is stable but does not isolate code within a process

- date: accessed 2026-11-14
- status: Stability 2 (stable since v23.5.0 and v22.13.0)
- confidence: high
- source.label: Node.js, Permissions
- source.url: https://nodejs.org/api/permissions.html
- source.type: official docs
- notes: `--permission` limits file, child process, and similar access for the whole process. The docs call it a "seat belt" that "does not provide security guarantees in the presence of malicious code".

## E22: HMAC is the standard keyed construction, and keys shorter than the hash output are discouraged

- date: February 1997
- status: Informational (updated by RFC 6151)
- confidence: high
- source.label: RFC 2104, HMAC
- source.url: https://www.rfc-editor.org/rfc/rfc2104
- source.type: specification
- notes: HMAC nests two keyed hash calls around an unmodified hash. Keys shorter than the output length L (32 bytes for SHA-256) are "strongly discouraged". FIPS 198-1 (https://csrc.nist.gov/pubs/fips/198-1/final, July 2008) specifies the same construction; NIST has proposed moving it to SP 800-224 (draft, 2024-06-28).

## E23: Secret-prefix Merkle-Damgård hashes allow length extension; HMAC does not

- date: accessed 2026-11-14
- status: secondary summary
- confidence: medium (single secondary source)
- source.label: Wikipedia, Length extension attack
- source.url: https://en.wikipedia.org/wiki/Length_extension_attack
- source.type: secondary
- notes: Given `H(secret || m)` and the lengths, an attacker can compute `H(secret || m || pad || x)` for SHA-256. It forges a token for an extended input and does not recover the secret. It cites the 2009 Flickr API forgery. For id-vault, the extended input must be a JS string whose UTF-8 bytes contain the padding (`0x80` and zero bytes); UTF-8 cannot emit a lone `0x80`, so the default string path is not exploitable, as PR #38 F9 states. A custom `encode` that hashes other bytes could be. We did not fetch a primary paper.

## E24: NIST ties HMAC key strength to the strength required, with no fixed bit count

- date: August 2012
- status: Final, withdrawal decided 2022-12-20
- confidence: medium (read by text extraction)
- source.label: NIST SP 800-107 Rev. 1, sections 5.3.2 to 5.3.4
- source.url: https://csrc.nist.gov/pubs/sp/800/107/r1/final
- source.type: specification
- notes: The key "shall have a security strength that meets or exceeds" the strength required. Effective strength is the minimum of the key's strength and the hash's internal state. Truncated tags must be at least 32 bits. For 128-bit strength the key needs at least 128 bits of entropy. We could not find a fixed minimum in SP 800-131A Rev. 2 and did not read SP 800-57.

## E25: NIST defines TupleHash for hashing a tuple of strings without ambiguity

- date: December 2016
- status: Final (revision draft open until 2026-12-07)
- confidence: high
- source.label: NIST SP 800-185
- source.url: https://csrc.nist.gov/pubs/sp/800/185/final
- source.type: specification
- notes: TupleHash is "designed to hash tuples of input strings unambiguously", by encoding each string's length. Joining fields with `:` when a field may contain `:` is the ambiguity it avoids. The same length-prefix encoding works with HMAC-SHA-256.

## E26: Node has a constant-time compare and a one-shot sync hash

- date: accessed 2026-11-14
- status: current documentation
- confidence: high
- source.label: Node.js, crypto (`timingSafeEqual`, `hash`)
- source.url: https://nodejs.org/api/crypto.html
- source.type: official docs
- notes: `timingSafeEqual` (since v6.6.0) is "suitable for comparing HMAC digests" and throws when lengths differ, so check length first. `crypto.hash()` was added in v21.7.0 and v20.12.0 and is stable from v24.13.1 and v25.5.0.

## E27: Web Crypto has no synchronous API

- date: page modified 2025-12-28
- status: current documentation
- confidence: high
- source.label: MDN, SubtleCrypto.digest()
- source.url: https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest
- source.type: official docs
- notes: `digest()` returns a Promise, and SubtleCrypto exists only in secure contexts. A synchronous browser hash needs a pure-JS implementation. Moving to Web Crypto would make `createID` and `assertID` async, which breaks every caller and every sync hook such as stable-store's `keyAssertion` (E07). We did not check the `sign` page; it is also Promise-based by the same interface.

## E28: `@noble/hashes` gives sync SHA-256 and HMAC in every runtime and was audited

- date: version 2.4.0 published 2026-08-27
- status: maintained
- confidence: high
- source.label: paulmillr/noble-hashes README; `npm view @noble/hashes`
- source.url: https://github.com/paulmillr/noble-hashes
- source.type: official docs, registry
- notes: Synchronous `sha256()` and `hmac(sha256, key, msg)`. Cure53 audited v1.0.0 in January 2022. v2 is ESM-only and needs Node 20.19 or later. One implementation for Node and browsers also removes the F3 routing problem.

## E29: crypto-js is discontinued

- date: notice undated; latest version 4.2.0 published 2023-10-24
- status: discontinued
- confidence: high (notice); none (notice date)
- source.label: brix/crypto-js README; npm `deprecated` field
- source.url: https://github.com/brix/crypto-js
- source.type: maintainer notice
- notes: "Active development of CryptoJS has been discontinued. This library is no longer maintained." It points users to the native `crypto` module.

## E30: Existing sync string-signing packages use HMAC and a constant-time compare

- date: cookie-signature 1.2.2 published 2024-10-29; keygrip 1.1.0 modified 2026-02-03
- status: maintained
- confidence: high (source read from tarballs)
- source.label: npm `cookie-signature`, npm `keygrip`
- source.url: https://www.npmjs.com/package/cookie-signature ; https://www.npmjs.com/package/keygrip
- source.type: code
- notes: cookie-signature signs `value.sig` with `createHmac('sha256', secret)` and compares with `timingSafeEqual` after a length check. keygrip uses HMAC (sha1 by default) with `tsscmp` and supports key rotation. Both are Node-only. They are the prior art for the "harden" path: id-vault's construction plus HMAC plus constant-time compare is what these already do.

## E31: JWT brings a header and algorithm negotiation that an in-process check does not need

- date: RFC 7519 May 2015; RFC 8725 February 2020
- status: Proposed Standard; BCP 225
- confidence: high
- source.label: RFC 7519, JSON Web Token; RFC 8725, JWT Best Current Practices
- source.url: https://datatracker.ietf.org/doc/html/rfc7519 ; https://datatracker.ietf.org/doc/html/rfc8725
- source.type: specification
- notes: HS256 is HMAC-SHA-256 over a JSON header and payload. RFC 8725 documents `alg: none` and RS256-as-HS256 confusion and requires callers to pin the algorithm. id-vault's fixed algorithm avoids that class of bug; JWT adds expiry and audience claims, which id-vault does not need.

## E32: PASETO removes algorithm agility but is not a standard

- date: accessed 2026-11-14
- status: IETF draft `draft-paragon-paseto-rfc-01` (2022-05-24) expired
- confidence: medium
- source.label: paseto.io; IETF datatracker
- source.url: https://paseto.io/
- source.type: specification (non-standard)
- notes: Versioned protocols v1 to v4 with one algorithm per version. Built for tokens that cross a network boundary.

## E33: Macaroons are chained-HMAC bearer tokens with caveats and delegation

- date: NDSS 2014
- status: peer-reviewed paper
- confidence: high
- source.label: Birgisson et al., "Macaroons: Cookies with Contextual Caveats for Decentralized Authorization in the Cloud"
- source.url: https://research.google/pubs/macaroons-cookies-with-contextual-caveats-for-decentralized-authorization-in-the-cloud/
- source.type: research paper
- notes: A holder can attenuate a token by adding caveats, and services verify by recomputing the HMAC chain. This solves delegation, which id-vault's use case does not have.
