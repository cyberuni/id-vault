import { utf8ToBytes } from '@noble/hashes/utils.js'
import { constantTimeEqual } from './constant_time_equal.js'
import { computeToken } from './token.js'

/**
 * The fewest UTF-8 bytes a seed may have: 16 bytes, which is 128 bits.
 */
export const MIN_SEED_BYTES = 16

export type IDVaultOptions = {
	/**
	 * Optional scope, a non-empty string that prefixes every ID the vault creates.
	 * The token covers the scope, so an ID of one scope is invalid in every other scope.
	 *
	 * Use `isOwnID()` to tell IDs of this scope apart from other IDs,
	 * for example when shared code checks IDs on behalf of several vaults.
	 */
	scope?: string
	/**
	 * Disable the vault on the first invalid ID.
	 * After that, `createID()` and `assertID()` throw until you create a new vault.
	 *
	 * Defaults to `false`: `assertID()` throws on every invalid ID and the vault keeps working.
	 * Any code that can call `assertID()` can disable a vault that sets this option.
	 */
	disableOnInvalid?: boolean
}

/**
 * Create a vault that creates IDs from a shared seed and checks them.
 *
 * Code that shares the seed can create IDs that the vault accepts.
 * Code without the seed cannot compute a valid ID for a name it chooses.
 *
 * This is a guardrail against careless code in the same JavaScript realm,
 * not a boundary against hostile code: code that runs in the same realm can read the seed
 * or replace the built-ins the vault calls.
 * Within one realm, `createKeyVault()` is the stronger choice.
 * Use this vault when an ID must cross a realm or be serialized.
 *
 * @param seed At least 16 bytes of UTF-8 (128 bits).
 * Use a random value, for example 16 bytes from `crypto.getRandomValues()` encoded as hex.
 *
 * @example
 * ```ts
 * const vault = createIDVault(seed)
 * const id = vault.createID('name')
 * vault.assertID(id)
 * ```
 */
export function createIDVault(seed: string, options: IDVaultOptions = {}): IDVault {
	if (typeof seed !== 'string') throw new TypeError('seed must be a string')
	const key = utf8ToBytes(seed)
	if (key.length < MIN_SEED_BYTES) {
		throw new TypeError(`seed must be at least ${MIN_SEED_BYTES} bytes of UTF-8`)
	}
	if ('encode' in options) {
		throw new TypeError('the encode option was removed in id-vault 2: the token is always HMAC-SHA-256')
	}
	const { scope, disableOnInvalid = false } = options
	if (scope === '') throw new TypeError('scope must be a non-empty string')
	if (scope !== undefined && !isWellFormed(scope)) throw new TypeError('scope must be well-formed UTF-16')

	const prefix = scope === undefined ? '' : `${scope}:`
	const scopeField = scope ?? ''
	const listeners: Array<(id: string) => void> = []

	let disabled = false
	let intrudedId = ''

	function assertNotDisabled() {
		if (disabled) throw new Error(`vault disabled as invalid id was detected: ${intrudedId}`)
	}

	function reject(id: string): never {
		if (disableOnInvalid) {
			disabled = true
			intrudedId = id
		}
		for (const listener of listeners.slice()) {
			try {
				listener(id)
			} catch (e) {
				console.error(e)
			}
		}
		throw new Error(`Detected invalid id: ${id}`)
	}

	function isOwnID(id: string) {
		return id.startsWith(prefix)
	}

	function onInvalidID(listener: (invalidId: string) => void) {
		const entry = (id: string) => listener(id)
		listeners.push(entry)
		return () => {
			const i = listeners.indexOf(entry)
			if (i >= 0) listeners.splice(i, 1)
		}
	}

	return Object.freeze({
		createID(name: string) {
			assertNotDisabled()
			if (!isWellFormed(name)) throw new TypeError('name must be well-formed UTF-16')
			return `${prefix}${name}:${computeToken(key, scopeField, name)}`
		},
		assertID(id: string) {
			assertNotDisabled()
			if (!isOwnID(id)) reject(id)
			const rest = id.slice(prefix.length)
			// The token is hex and never contains `:`, so the last `:` ends the name.
			// The name itself may contain `:`.
			const i = rest.lastIndexOf(':')
			if (i < 0) reject(id)
			const name = rest.slice(0, i)
			// A lone surrogate encodes to the same UTF-8 bytes as U+FFFD, so two names would share a token.
			if (!isWellFormed(name)) reject(id)
			const digest = rest.slice(i + 1)
			if (!constantTimeEqual(computeToken(key, scopeField, name), digest)) reject(id)
		},
		isOwnID,
		onInvalidID,
		detectedInvalidID: onInvalidID
	})
}

/**
 * Whether the string has no lone surrogate. `String.prototype.isWellFormed` needs ES2024.
 */
function isWellFormed(value: string) {
	return !/\p{Surrogate}/u.test(value)
}

export type IDVault = {
	/**
	 * Create an ID derived from the name.
	 *
	 * The resulting ID is used to access various resources (e.g. stores),
	 * that uses the vault (or a vault with the same seed) to ensure the ID is valid.
	 *
	 * This is typically used by the consumer of some resources.
	 *
	 * Throws a `TypeError` if the name contains a lone surrogate,
	 * and throws if the vault is disabled.
	 *
	 * @example
	 * ```ts
	 * const vault = createIDVault(seed)
	 * const id = vault.createID('name')
	 *
	 * const store = getStore(id)
	 * ```
	 */
	createID(name: string): string
	/**
	 * Assert the ID is valid.
	 *
	 * Throws on every ID that this vault, or a vault with the same seed and scope, did not create.
	 * That includes IDs of another scope.
	 * Every invalid ID notifies the `onInvalidID()` listeners.
	 * With `disableOnInvalid: true`, the first invalid ID also disables the vault.
	 *
	 * This is typically used by the provider of some resources.
	 *
	 * @example
	 * ```ts
	 * const vault = createIDVault(seed)
	 * setIDAssertion(vault.assertID)
	 *
	 * // consumer code
	 * const store = getStore('invalid id') // throws
	 * ```
	 */
	assertID(id: string): void
	/**
	 * Tell whether the ID has this vault's scope, without checking its token.
	 *
	 * A vault without a scope returns `true` for every ID.
	 * Use this in shared code that routes IDs to several vaults,
	 * and reject an ID that no vault claims.
	 *
	 * @example
	 * ```ts
	 * const vault = vaults.find(v => v.isOwnID(id))
	 * if (!vault) throw new Error('unknown id')
	 * vault.assertID(id)
	 * ```
	 */
	isOwnID(id: string): boolean
	/**
	 * Listen to every invalid ID that `assertID()` detects.
	 *
	 * The listeners run before `assertID()` throws.
	 * With `disableOnInvalid: true`, they run only for the first invalid ID,
	 * because the disabled vault then throws before it checks an ID.
	 * A listener that throws does not stop the other listeners;
	 * its error goes to `console.error`.
	 *
	 * This is useful for some centralized code (e.g. monitoring) to detect such violation occurs,
	 * even if the consuming code ignores the error.
	 *
	 * @returns A function that removes the listener.
	 *
	 * @example
	 * ```ts
	 * const vault = createIDVault(seed)
	 * const off = vault.onInvalidID(invalidId => ...do something about it...)
	 * ```
	 */
	onInvalidID(listener: (invalidId: string) => void): () => void
	/**
	 * @deprecated Use `onInvalidID()`.
	 */
	detectedInvalidID(listener: (invalidId: string) => void): () => void
}
