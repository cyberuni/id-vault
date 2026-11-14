import { constantTimeEqual } from './constant_time_equal.js'
import { encodeSHA256 } from './encoder.js'

export type IDVaultOptions = {
	/**
	 * Alternate encoder function.
	 * Defaults to encode with SHA256.
	 *
	 * The output must not contain `:`.
	 */
	encode?: (id: string) => string
	/**
	 * Optional scope, a non-empty string that prefixes every ID the vault creates.
	 *
	 * Use `isOwnID()` to tell IDs of this scope apart from other IDs,
	 * for example when shared code checks IDs on behalf of several vaults.
	 */
	scope?: string
}

/**
 * Create a vault for ID.
 *
 * This can be used as a foundation to share secret between two isolated code.
 * The seed can be shared between the code during build time or load time.
 *
 * As long as other code does not have access to the seed,
 * they will not be able to create a valid ID.
 *
 * @example
 * ```ts
 * const vault = createIDVault('some seed')
 * const id = vault.createID('name')
 * vault.assertID(id)
 * ```
 */
export function createIDVault(seed: string, { encode, scope }: IDVaultOptions = {}): IDVault {
	if (scope === '') throw new TypeError('scope must be a non-empty string')

	const enc = encode ?? encodeSHA256
	const prefix = scope === undefined ? '' : `${scope}:`
	const listeners: Array<(id: string) => void> = []

	let disabled = false
	let intrudedId = ''

	function assertNotDisabled() {
		if (disabled) throw new Error(`vault disabled as invalid id was detected: ${intrudedId}`)
	}

	function reject(id: string): never {
		disabled = true
		intrudedId = id
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
			const token = enc(`${seed}:${name}`)
			if (token.includes(':')) throw new Error('encode() returned a token that contains ":"')
			return `${prefix}${name}:${token}`
		},
		assertID(id: string) {
			assertNotDisabled()
			if (!isOwnID(id)) reject(id)
			const rest = id.slice(prefix.length)
			// The token never contains `:`, so the last `:` ends the name.
			// The name itself may contain `:`.
			const i = rest.lastIndexOf(':')
			if (i < 0) reject(id)
			const name = rest.slice(0, i)
			const digest = rest.slice(i + 1)
			if (!constantTimeEqual(enc(`${seed}:${name}`), digest)) reject(id)
		},
		isOwnID,
		onInvalidID,
		detectedInvalidID: onInvalidID
	})
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
	 * @example
	 * ```ts
	 * const vault = createIDVault('some seed')
	 * const id = vault.createID('name')
	 *
	 * const store = getStore(id)
	 * ```
	 */
	createID(name: string): string
	/**
	 * Assert the ID is valid.
	 *
	 * Throws on every ID this vault did not create, including IDs of another scope.
	 * The first invalid ID disables the vault.
	 *
	 * This is typically used by the provider of some resources.
	 *
	 * @example
	 * ```ts
	 * const vault = createIDVault('some seed')
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
	 * Listen to the first invalid ID being detected.
	 *
	 * This event will only be fired once,
	 * as the vault will be disabled after the first invalid ID is detected.
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
	 * const vault = createIDVault('some seed')
	 * const off = vault.onInvalidID(invalidId => ...do something about it...)
	 * ```
	 */
	onInvalidID(listener: (invalidId: string) => void): () => void
	/**
	 * @deprecated Use `onInvalidID()`.
	 */
	detectedInvalidID(listener: (invalidId: string) => void): () => void
}
