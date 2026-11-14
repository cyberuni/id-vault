# id-vault design and alternatives (November 2026)

## Last updated

November 2026. Checked against `cyberuni/id-vault` at `6974d98` and `stable-packages/store` at `3706d66`.
Evidence IDs (E01 to E33) refer to [evidence.md](./evidence.md). F-numbers refer to the findings in PR #38.

## Question

Is id-vault's design sound for its purpose, and what are the alternatives?

The purpose: two isolated pieces of code in one JS runtime share a seed at build or load time.
One creates IDs as `name:SHA256(seed:name)`, optionally prefixed by a scope.
The other checks them, so code without the seed cannot forge an ID to reach a resource.
The first invalid ID disables the vault and notifies listeners.

## Verdict

**Harden, and narrow the claim.** Do not replace it outright.

1. **Against hostile code in the same realm, the design gives no protection.** Neither does any other library-level design. Code that runs first can read the seed through a patched built-in (E02). Code that runs at any time can make the checker skip a check through a patched built-in (E03). A seed shared at build time is a literal in a bundle that any script on the page can fetch (E05, E18, E19). Only a locked-down realm (SES `lockdown()`, E11) or a separate realm stops this.
2. **Against honest but careless code, it works as a guardrail.** It stops a module from reaching a resource by guessing or copying a well-known name. That is a real use. The README should say that this is the guarantee.
3. **For that guardrail, a module-private capability is strictly better than a shared secret.** A private-field brand check (`#brand in key`) cannot be forged, needs no seed, and calls no built-in that other code can replace (E06, E13). A string ID can be logged, copied, and replayed by any code that sees it once. A seed has entropy, distribution, and rotation problems that an object reference does not.
4. **A string token earns its place only where no object can be shared**: across realms (iframe, worker, `postMessage`) or across a serialization boundary. There the right construction is HMAC-SHA-256 over an unambiguous encoding of scope and name, compared in constant time (E22, E25, E26, E30). That is what cookie-signature already does on Node (E30).
5. **The disable-on-first-invalid policy does more harm than good.** Any caller can trigger it with one call (E04). Brute force is not the threat it guards against, because a 256-bit HMAC tag cannot be guessed. Make it opt-in, and notify listeners on every invalid ID.
6. **The named consumer does not use id-vault.** stable-store takes a generic `keyAssertion` hook, and at HEAD it drops that hook and never calls it (E07). Downloads are small (31 a week for id-vault, 6 for stable-store). A breaking change costs almost nothing today, so make all breaking fixes in one major release now.

## Reference material

### What each threat defeats

| Threat | Shared seed (today) | Shared seed, HMAC (hardened) | Private-field capability | SES lockdown + capability |
| --- | --- | --- | --- | --- |
| A1. Code guesses or reuses a known name | Stops it | Stops it | Stops it | Stops it |
| A2. Code sees one valid ID and replays it | Does not stop it | Does not stop it | Stops it unless handed the object | Same |
| A3. Code moves an ID to another scope (F8) | Does not stop it | Stops it | n/a (no strings) | n/a |
| A4. Code loaded first patches a built-in to read the secret (E02) | Does not stop it | Does not stop it | Nothing to read | Stops it |
| A5. Code patches a built-in to skip the check (E03) | Does not stop it | Does not stop it if the check calls built-ins | Stops it (`#x in` is syntax) | Stops it |
| A6. Code reads a build-time seed from the bundle (E18, E19) | Does not stop it | Does not stop it | Nothing to read | Stops it only if the compartment has no `fetch` |
| A7. Code calls the checker with garbage to disable it (E04) | Does not stop it | Stops it if the kill switch is opt-in | Nothing to disable | Same |
| A8. Two realms or a serialized channel must agree | Works | Works | Does not work (references do not cross) | Does not work across realms |

### Alternatives

| Alternative | What it is | Status (E-ID) | Fit for id-vault's purpose | Cost to adopt |
| --- | --- | --- | --- | --- |
| Shared-seed SHA-256 (today) | `name:SHA256(seed:name)` | Shipping, 1.0.0 | Guardrail only; F8, F9 weaken it | None |
| Shared-seed HMAC-SHA-256 | `HMAC(seed, len(scope)‖scope‖len(name)‖name)`, constant-time compare | Standard (E22, E25); prior art cookie-signature, keygrip (E30) | Same guardrail, no scope transfer, no length extension; the right choice when IDs must be strings | One major release; tokens change |
| Private-field capability | A class with `#brand`; the provider hands key objects to consumers; `Key.is(k)` checks | Shipping in all engines (E13) | Best for the same-realm guardrail; unforgeable, no secret, resists patched built-ins (E06) | New API; consumers must pass an object, not a string; does not cross realms |
| WeakMap or WeakSet registry | The provider records issued objects in a private WeakSet | Shipping (E14) | Same as above, but `WeakSet.prototype.has` can be patched unless captured early | Same as above |
| `Symbol()` key | A unique symbol held by the provider | Shipping (E15) | Same as a capability object. `Symbol.for` is a global registry and is not secret | Same as above |
| ShadowRealm | A separate realm with its own intrinsics; only primitives and wrapped functions cross | Stage 2.7; unflagged in no runtime we checked (E08, E09) | Would isolate untrusted code properly; not usable today | Not available |
| SES / Hardened JavaScript | `lockdown()` freezes intrinsics, `harden()` freezes objects, `Compartment` gives code its own global | `ses` 2.3.0, about 390,000 downloads a week (E11, E12); Compartments proposal Stage 1 (E10) | The only option that defeats A4 to A6 in one realm; the host app must adopt it, a library cannot | High; the app must call `lockdown()` first and some libraries break (override mistake, E11) |
| JWT (HS256) | Signed JSON header and payload | RFC 7519, BCP 225 (E31) | Overkill; adds `alg` handling that RFC 8725 warns about | Larger token, a dependency, async in browsers if built on Web Crypto |
| PASETO | Versioned signed tokens, no algorithm agility | Draft expired 2022 (E32) | Overkill; meant for network tokens | Same as JWT |
| Macaroons | Chained-HMAC tokens with caveats | NDSS 2014 (E33) | Solves delegation, which id-vault does not need | High |
| Node `vm` | Separate context in one process | "Not a security mechanism" (E20) | Not a boundary | n/a |
| Node `--permission` | Process-wide resource limits | Stable (E21) | Does not isolate code inside a process | n/a |

No npm package was found that does what id-vault does (E12).
The nearest prior art is cookie-signature and keygrip for the token form, and `@endo/exo` for the capability form.

### Construction choices

| Choice | Today | Recommended | Source |
| --- | --- | --- | --- |
| Primitive | `SHA256(seed + ':' + name)` (secret prefix) | HMAC-SHA-256 keyed by the seed | E22, E23 |
| Input encoding | `:` joins fields that may contain `:` (F4, F7, F9) | Length-prefix each field, or reject `:` in scope and name | E25 |
| Scope binding | Scope not hashed (F8) | Scope is part of the MAC input | E01 |
| Comparison | `!==` (F10) | Constant time: XOR-accumulate over equal-length strings | E26, E30 |
| Seed | Any string, including `''` (F15) | At least 128 bits of entropy; reject shorter in the major release | E22, E24 |
| Implementation | `node:crypto` on Node, discontinued crypto-js in browsers, browser path unreachable (F3) | One sync implementation, `@noble/hashes` `hmac` + `sha256`, everywhere | E27, E28, E29 |
| Sync or async | Sync | Stay sync. Web Crypto is Promise-only and would break every caller and stable-store's sync hook | E27, E07 |
| Invalid ID policy | First invalid ID disables the vault for all callers (F6) | Throw and notify listeners on every invalid ID; disabling is opt-in | E04 |

### What this means for the held items

idv-fix-core is holding F6, F8, F9, and F15 for this research.

- **F6 (disable on first invalid): change the default.** `assertID` throws and notifies listeners on every invalid ID. Disabling becomes opt-in through an option such as `disableOnInvalid: true`. Keep listener isolation from F12. Breaking: callers that relied on the kill switch must opt in.
- **F8 and F9 (scope binding and construction): fix together.** Compute the token as HMAC-SHA-256 with the seed as key, over a length-prefixed encoding of `scope` and `name`. Use `@noble/hashes` so Node and browsers share one code path, which also resolves F3 for idv-fix-browser. Breaking: every token changes, so a provider and a consumer on different majors reject each other's IDs. Do not add a v1-compatible mode; it would keep the weaknesses.
- **F15 (seed): reject weak seeds in the major release.** Throw on a seed under 16 bytes of UTF-8, which rejects `''`. Document a seed of at least 128 bits from `crypto.getRandomValues`. Breaking for anyone using a short seed.
- **Ship all three in one major release (2.0.0)** with F1 and F2, which also reject IDs that 1.0.0 accepted. Five breaking changes in one major cost less than several majors. The only known consumer does not call id-vault (E07).
- **Update the README in the same change** to state the guarantee in the Verdict: a guardrail against careless code, not a boundary against hostile code in the same realm. Name SES `lockdown()` for apps that need the boundary.

Not decided by this research: whether to add a capability API (verdict point 3) to id-vault or leave it to consumers. It is a new feature, not a fix, and it belongs to the Council.

## Confidence

High that same-realm secrecy fails against code that runs first or patches built-ins: shown by experiment (E02, E03, E05) and by the reason SES exists (E11).
High on the construction fixes: they are standard and already shipped in cookie-signature (E22, E25, E26, E30).
Medium on the cost claim: download counts and one consumer's source are the only data on use (E07).

## Strongest supporting evidence

- E02: a 256-bit random seed recovered by patching `crypto.Hash.prototype.update`, then a forged ID accepted.
- E06: a private-field brand check rejects a forged object and a Proxy, after the built-ins it might use were patched.
- E07: stable-store drops its `keyAssertion` hook, so no consumer depends on the current token format.
- E22 and E30: HMAC with a constant-time compare is the standard construction and existing prior art.

## Strongest weakening evidence

- Code that loads first wins against any library design, including a capability: it can replace the provider's module before it loads. The capability's advantage holds only against code that loads after the provider (E06), and only SES removes the ordering problem (E11).
- A capability does not cross realms (A8). If a real consumer needs IDs across an iframe or worker boundary, the string token stays necessary. We found no such consumer, but we did not search private code.
- E23 rests on one secondary source, and the length-extension risk is not exploitable through the default string API.

## What is not supported

- That id-vault "secures" a resource against hostile code. The old README said so (PR #38). No evidence supports it.
- That disable-on-first-invalid prevents brute force across instances. A fresh vault resets it (F6), and a 256-bit tag needs no such guard.
- That stable-store enforces id-vault IDs today (E07).

## Where evidence is thin

- Browser ShadowRealm status: not confirmed absent (E09).
- A primary source for length extension and a NIST fixed minimum key length (E23, E24).
- Real-world use of id-vault beyond stable-store: only download counts.

## What to check again later

- ShadowRealm reaching Stage 3 or shipping unflagged (E08, E09). It would give a library-usable boundary.
- stable-store fixing its dropped `keyAssertion` (E07), which changes the consumer cost of a token format change.
- `@noble/hashes` releases and audits (E28).
