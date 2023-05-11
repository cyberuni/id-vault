import { encodeSHA256 } from './encoder.js'

type IDVaultOptions = {
	/**
	 * Alternate encoder function.
	 * Defaults to encode with SHA256.
	 */
	encode?: (id: string) => string
	/**
	 * Optional scope.
	 *
	 * The vault will assert against IDs with the same scope.
	 * This is useful if the IDs are validated by some shared code,
	 * such as the use case in [stable-store](https://npmjs.org/package/stable-store).
	 */
	scope?: string
}

/**
 * Create a vault for ID.
 *
 * This can be used as a fundation to share secret between two isolated code.
 * The seed can be shared between the code during build time or load time.
 *
 * As long as other code does not have access to the seed,
 * they will not be able to create a valid ID.
 *
 * @example
 * ```ts
 * const vault = createVault('some seed')
 * const id = vault.createID('name')
 * vault.assertID(id)
 * ```
 */
export function createIDVault(seed: string, { encode, scope }: IDVaultOptions = {}): IDVault {
	const enc = encode ?? encodeSHA256
	const listeners: Array<(id: string) => void> = []

	let intrudedId: string

	function assertToken(id: string, name: string | undefined, digest: string | undefined) {
		if (enc(`${seed}:${name}`) !== digest) {
			intrudedId = id
			listeners.forEach(l => l(intrudedId))
			throw new Error(`Detected invalid id: ${id}`)
		}
	}

	return Object.freeze({
		createID(name: string) {
			assertNotIntruded(intrudedId)
			const token = enc(`${seed}:${name}`)
			return scope ? `${scope}:${name}:${token}` : `${name}:${token}`
		},
		assertID: scope
			? function (id: string) {
					assertNotIntruded(intrudedId)
					const [scopePart, name, digest] = id.split(':', 3)
					if (scopePart !== scope) return
					assertToken(id, name, digest)
			  }
			: function (id: string) {
					assertNotIntruded(intrudedId)
					const [name, digest, extra] = id.split(':', 3)
					if (extra) return
					assertToken(id, name, digest)
			  },
		detectedInvalidID(listener: (id: string) => void) {
			listeners.push(listener)
		}
	})
}

function assertNotIntruded(intrudedId: string) {
	if (intrudedId) throw new Error(`vault disabled as invalid id was detected: ${intrudedId}`)
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
	 * const vault = createVault('some seed')
	 * const id = vault.createID('name')
	 *
	 * const store = getStore(id)
	 * ```
	 */
	createID(name: string): string
	/**
	 * Assert the ID is valid.
	 *
	 * This is typically used by the provider of some resources.
	 *
	 * @example
	 * ```ts
	 * const vault = createVault('some seed')
	 * setIDAssertion(vault.assertID)
	 *
	 * // consumer code
	 * const store = getStore('invalid id') // throws
	 * ```
	 */
	assertID(id: string): void
	/**
	 * Listen to the first invalid ID being detected.
	 *
	 * This event will only be fired once,
	 * as the vault will be disabled after the first invalid ID is detected.
	 *
	 * This is useful for some centralized code (e.g. monitoring) to detect such violation occurs,
	 * even if the consuming code ignores the error.
	 *
	 * @example
	 * ```ts
	 * const vault = createVault('some seed')
	 * vault.detectedInvalidID(invalidId => ...do something about it...)
	 * ```
	 */
	detectedInvalidID(listener: (invalidId: string) => void): void
}
