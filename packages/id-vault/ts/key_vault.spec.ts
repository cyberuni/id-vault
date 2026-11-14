import { a } from 'assertron'
import { createKeyVault, type KeyVault, type VaultKey } from './index.js'

it('creates a key that its vault accepts', () => {
	const vault: KeyVault = createKeyVault()
	const key = vault.createKey('store')
	expect(key.name).toBe('store')
	expect(() => vault.assertKey(key)).not.toThrow()
	expect(vault.isOwnKey(key)).toBe(true)
})

it('creates a new valid key on every call', () => {
	const vault = createKeyVault()
	const k1 = vault.createKey('store')
	const k2 = vault.createKey('store')
	expect(k1).not.toBe(k2)
	expect(vault.isOwnKey(k1) && vault.isOwnKey(k2)).toBe(true)
})

it('rejects a key of another vault', () => {
	const key = createKeyVault().createKey('store')
	const vault = createKeyVault()
	const err = a.throws(() => vault.assertKey(key))
	expect(err.message).toBe('Detected invalid key')
	expect(vault.isOwnKey(key)).toBe(false)
})

it('rejects values that only look like a key', () => {
	const vault = createKeyVault()
	const key = vault.createKey('store')
	for (const value of [
		{ name: 'store' },
		{ ...key },
		structuredClone(key),
		Object.create(key),
		undefined,
		null,
		'store',
		1,
		() => {}
	]) {
		expect(vault.isOwnKey(value)).toBe(false)
		a.throws(() => vault.assertKey(value))
	}
})

it('rejects a Proxy of a key without running its traps', () => {
	const vault = createKeyVault()
	const trap = vi.fn(() => {
		throw new Error('trap ran')
	})
	const proxy = new Proxy(vault.createKey('store'), { get: trap, has: trap, getPrototypeOf: trap, ownKeys: trap })
	const err = a.throws(() => vault.assertKey(proxy))
	expect(err.message).toBe('Detected invalid key')
	expect(trap).not.toHaveBeenCalled()
})

it('freezes the key and the vault', () => {
	const vault = createKeyVault()
	const key = vault.createKey('store')
	expect(Object.isFrozen(key)).toBe(true)
	expect(Object.isFrozen(vault)).toBe(true)
	a.throws(() => {
		;(key as { name: string }).name = 'other'
	}, TypeError)
})

it('keeps the key name read-only when Object.freeze is replaced after load', () => {
	const vault = createKeyVault()
	const freeze = Object.freeze
	Object.freeze = <T>(o: T) => o
	try {
		expect(Object.isFrozen(vault.createKey('store'))).toBe(true)
	} finally {
		Object.freeze = freeze
	}
})

it('does not let code construct a key through the class', () => {
	const key = createKeyVault().createKey('store')
	const Key = Object.getPrototypeOf(key).constructor
	const err = a.throws(() => new Key({}, {}, 'store') as unknown, TypeError)
	expect(err.message).toBe('use createKeyVault().createKey() to create a key')
	class Forged extends Key {
		constructor() {
			super({}, {}, 'store')
		}
	}
	a.throws(() => new Forged(), TypeError)
})

it('exposes no static method on the key class that code could replace', () => {
	const key = createKeyVault().createKey('store')
	const Key = Object.getPrototypeOf(key).constructor
	expect(Object.getOwnPropertyNames(Key).sort()).toEqual(['length', 'name', 'prototype'])
})

it('checks keys without the built-ins that other code can replace', () => {
	const vault = createKeyVault()
	const key = vault.createKey('store')
	const other = createKeyVault().createKey('store')
	const saved = { has: Reflect.has, getPrototypeOf: Object.getPrototypeOf, wmHas: WeakMap.prototype.has }
	Reflect.has = () => true
	Object.getPrototypeOf = () => null
	WeakMap.prototype.has = () => true
	try {
		expect(vault.isOwnKey(key)).toBe(true)
		expect(vault.isOwnKey(other)).toBe(false)
	} finally {
		Reflect.has = saved.has
		Object.getPrototypeOf = saved.getPrototypeOf
		WeakMap.prototype.has = saved.wmHas
	}
})

it('rejects a name that is not a string', () => {
	const err = a.throws(() => createKeyVault().createKey(1 as unknown as string), TypeError)
	expect(err.message).toBe('name must be a string')
})

it('narrows the type with assertKey', () => {
	const vault: KeyVault = createKeyVault()
	const value: unknown = vault.createKey('store')
	vault.assertKey(value)
	const key: VaultKey = value
	expect(key.name).toBe('store')
})
