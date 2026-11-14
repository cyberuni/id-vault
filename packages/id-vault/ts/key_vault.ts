/**
 * A key that a key vault created.
 *
 * Only `createKeyVault().createKey()` makes one, and only the vault that made it accepts it.
 * It carries no secret: it is the object reference itself that grants access.
 */
export type VaultKey = {
	/**
	 * The name passed to `createKey()`.
	 * It is a label, not a secret, and other code can read it.
	 */
	readonly name: string
}

export type KeyVault = {
	/**
	 * Create a key with a name.
	 *
	 * Hand the key object to the code that may access the resource.
	 * Each call returns a new frozen object, and every key the vault creates is valid.
	 *
	 * @example
	 * ```ts
	 * const vault = createKeyVault()
	 * const key = vault.createKey('my-module.store')
	 * ```
	 */
	createKey(name: string): VaultKey
	/**
	 * Assert that this vault created the key.
	 *
	 * Throws `Error('Detected invalid key')` on any other value,
	 * including a key of another vault, a copy of a key, and a `Proxy` of a key.
	 * The error message does not include the value, because turning a `Proxy` into a string runs its code.
	 *
	 * @example
	 * ```ts
	 * function getStore(key: VaultKey) {
	 *   vault.assertKey(key)
	 *   return stores.get(key.name)
	 * }
	 * ```
	 */
	assertKey(key: unknown): asserts key is VaultKey
	/**
	 * Tell whether this vault created the key, without throwing.
	 *
	 * Unlike `IDVault.isOwnID()`, this is the full check:
	 * it returns `true` exactly when `assertKey()` would return.
	 */
	isOwnKey(key: unknown): key is VaultKey
}

/**
 * Captured when this module loads, so code that replaces `Object.freeze` later cannot leave a key's name writable.
 */
const freeze = Object.freeze

/**
 * Lets only this module call the `Key` constructor.
 * `Object.getPrototypeOf(key).constructor` reaches the class, but not this object.
 */
const constructing = {}

/**
 * Whether `issuer` created `value`.
 *
 * It is assigned in `Key`'s static block, the only place that can name `#issuer`.
 * It is not a static method: code that reaches the class through a key could replace a method.
 */
let issuedBy: (value: unknown, issuer: object) => boolean

class Key implements VaultKey {
	/**
	 * The vault that created the key. Code outside this class cannot read or set it.
	 */
	readonly #issuer: object
	readonly name: string

	constructor(token: object, issuer: object, name: string) {
		if (token !== constructing) throw new TypeError('use createKeyVault().createKey() to create a key')
		this.#issuer = issuer
		this.name = name
	}

	static {
		// `#issuer in value` and `value.#issuer` are syntax, not method calls,
		// so code that replaces built-ins cannot change the result.
		// A `Proxy` has no private fields of its own, so the check is `false` for one.
		issuedBy = (value, issuer) =>
			typeof value === 'object' && value !== null && #issuer in value && value.#issuer === issuer
	}
}

/**
 * Create a vault that hands out unforgeable key objects and checks them.
 *
 * Use it when the code that creates keys and the code that checks them run in the same JavaScript realm.
 * It needs no seed, and code that sees a key cannot make another one.
 * It cannot cross a realm (an iframe, a worker, `postMessage`) or be serialized:
 * use `createIDVault()` there.
 *
 * It is a guardrail, not a sandbox.
 * Code that gets a key object can use it, and code that runs before this module loads can replace it.
 *
 * @example
 * ```ts
 * const vault = createKeyVault()
 * const key = vault.createKey('my-module.store')
 *
 * vault.assertKey(key) // returns
 * vault.assertKey({ name: 'my-module.store' }) // throws
 * ```
 */
export function createKeyVault(): KeyVault {
	// A fresh object that never leaves this closure: no other vault and no other code holds it.
	const issuer = {}

	function isOwnKey(key: unknown): key is VaultKey {
		return issuedBy(key, issuer)
	}

	return freeze({
		createKey(name: string): VaultKey {
			if (typeof name !== 'string') throw new TypeError('name must be a string')
			return freeze(new Key(constructing, issuer, name))
		},
		assertKey(key: unknown): asserts key is VaultKey {
			if (!isOwnKey(key)) throw new Error('Detected invalid key')
		},
		isOwnKey
	})
}
