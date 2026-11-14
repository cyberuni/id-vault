import { a } from 'assertron'
import crypto from 'crypto-js'
import { createIDVault } from './index.js'

it('creates an id', () => {
	const vault = createIDVault('seed')
	const id = vault.createID('name')
	expect(id).toBe('name:af0438752dee330e0a0706c287ebbc0ba15db3bb15e4cf619bdf755f73efdb30')
})

it('creates different ids for different names', () => {
	const vault = createIDVault('seed')
	const set = new Set()
	for (let i = 0; i < 100; i++) {
		set.add(vault.createID(`name${i}`))
	}
	expect(set.size).toBe(100)
})

it('creates different ids for different seeds', () => {
	const set = new Set()
	for (let i = 0; i < 100; i++) {
		const vault = createIDVault(`seed${i}`)
		set.add(vault.createID('name'))
	}
	expect(set.size).toBe(100)
})

it('asserts an id is valid', () => {
	const vault = createIDVault('seed')
	const id = vault.createID('name')
	expect(() => vault.assertID(id)).not.toThrow()
})

it('rejects the same id with a tampered digest', () => {
	const vault = createIDVault('seed')
	const id = vault.createID('name')
	const tampered = `${id.slice(0, -1)}${id.endsWith('0') ? '1' : '0'}`
	const err = a.throws(() => vault.assertID(tampered))
	expect(err.message).toBe(`Detected invalid id: ${tampered}`)
})

it('throws when it is an invalid id', () => {
	const vault = createIDVault('seed')
	const err = a.throws(() => vault.assertID('some-invalid-id'))
	expect(err.message).toBe('Detected invalid id: some-invalid-id')
})

it('throws when it is an invalid id (different seed)', () => {
	const vault = createIDVault('seed')
	const id = vault.createID('name')
	const vault2 = createIDVault('seed2')
	a.throws(() => vault2.assertID(id))
})

it('can specify algorithm', () => {
	const vault = createIDVault('some seed', {
		encode: (id) => crypto.SHA1(id).toString()
	})
	const id = vault.createID('name')
	expect(id).toBe('name:859df0c6508f53df229d359a6f7f0c3fa8bdcb6e')
	expect(() => vault.assertID(id)).not.toThrow()
})

it('checks a custom encode round trip, rejecting a SHA-256 id', () => {
	const vault = createIDVault('some seed', {
		encode: (id) => crypto.SHA1(id).toString()
	})
	a.throws(() => vault.assertID(createIDVault('some seed').createID('name')))
})

it('rejects an encode that returns a token with ":"', () => {
	const vault = createIDVault('seed', { encode: () => 'a:b' })
	const err = a.throws(() => vault.createID('name'))
	expect(err.message).toBe('encode() returned a token that contains ":"')
})

it('can specify a scope', () => {
	const vault = createIDVault('some seed', {
		scope: 'pre'
	})
	const id = vault.createID('name')
	expect(id).toBe('pre:name:9035075142833381c6d10133cf7b9ed89c39539142e475f024e6eb540b79e3fb')
	vault.assertID(id)
})

it('rejects an id with two or more ":" in an unscoped vault', () => {
	const vault = createIDVault('seed')
	a.throws(() => vault.assertID('x:y:z'))
	a.throws(() => vault.assertID('y:z'))
})

it('rejects an id without ":" in an unscoped vault', () => {
	const vault = createIDVault('seed')
	a.throws(() => vault.assertID('name'))
})

it('rejects a scoped id in an unscoped vault with the same seed', () => {
	const id = createIDVault('some seed', { scope: 'pre' }).createID('name')
	const err = a.throws(() => createIDVault('some seed').assertID(id))
	expect(err.message).toBe(`Detected invalid id: ${id}`)
})

it('rejects an id with a different scope', () => {
	const id = createIDVault('some seed', { scope: 'pre' }).createID('name')
	a.throws(() => createIDVault('some seed', { scope: '2' }).assertID(id))
})

it('rejects an id without the scope in a scoped vault', () => {
	const vault = createIDVault('some seed', { scope: 'pre' })
	a.throws(() => vault.assertID('anything'))
	a.throws(() => createIDVault('some seed', { scope: 'pre' }).assertID('other:x:y'))
	a.throws(() => createIDVault('some seed', { scope: 'pre' }).assertID(createIDVault('some seed').createID('name')))
})

it('rejects a scoped id that has no digest', () => {
	const vault = createIDVault('seed', { scope: 'pre' })
	a.throws(() => vault.assertID('pre:name'))
})

it('accepts a name with ":" in a scoped vault', () => {
	const vault = createIDVault('seed', { scope: 'pre' })
	const id = vault.createID('a:b')
	expect(() => vault.assertID(id)).not.toThrow()
	expect(() => vault.createID('c')).not.toThrow()
})

it('accepts a name with ":" in an unscoped vault', () => {
	const vault = createIDVault('seed')
	const id = vault.createID('a:b')
	expect(() => vault.assertID(id)).not.toThrow()
	a.throws(() => vault.assertID(`a:b:${'0'.repeat(64)}`))
})

it('checks ids when the scope contains ":"', () => {
	const vault = createIDVault('seed', { scope: 'a:b' })
	const id = vault.createID('name')
	expect(id.startsWith('a:b:name:')).toBe(true)
	expect(() => vault.assertID(id)).not.toThrow()
	a.throws(() => vault.assertID('a:b:name:0000'))
})

it('rejects an empty scope', () => {
	const err = a.throws(() => createIDVault('seed', { scope: '' }), TypeError)
	expect(err.message).toBe('scope must be a non-empty string')
})

it('tells its own scoped ids apart from others', () => {
	const vault = createIDVault('seed', { scope: 'pre' })
	expect(vault.isOwnID(vault.createID('name'))).toBe(true)
	expect(vault.isOwnID('pre:anything')).toBe(true)
	expect(vault.isOwnID('prefix:name:x')).toBe(false)
	expect(vault.isOwnID('other:name:x')).toBe(false)
	expect(vault.isOwnID('name:x')).toBe(false)
})

it('claims every id in an unscoped vault', () => {
	const vault = createIDVault('seed')
	expect(vault.isOwnID('anything')).toBe(true)
})

it('lets shared code route ids to several scoped vaults', () => {
	const vaults = [createIDVault('seed1', { scope: 'one' }), createIDVault('seed2', { scope: 'two' })]
	function check(id: string) {
		const vault = vaults.find((v) => v.isOwnID(id))
		if (!vault) throw new Error(`unknown id: ${id}`)
		vault.assertID(id)
	}
	expect(() => check(createIDVault('seed1', { scope: 'one' }).createID('a'))).not.toThrow()
	expect(() => check(createIDVault('seed2', { scope: 'two' }).createID('b'))).not.toThrow()
	a.throws(() => check('three:c:x'))
})

it("will always throw after it's an invalid id was used", () => {
	const vault = createIDVault('seed')
	const id = vault.createID('name')
	a.throws(() => vault.assertID('invalid'))
	const err = a.throws(() => vault.assertID(id))
	expect(err.message).toBe('vault disabled as invalid id was detected: invalid')
})

it('can be listened for invalid id event', () => {
	expect.assertions(1)
	const vault = createIDVault('seed')
	vault.detectedInvalidID((id) => expect(id).toBe('invalid'))
	a.throws(() => vault.assertID('invalid'))
})

it('can be listened multiple times', () => {
	expect.assertions(2)
	const vault = createIDVault('seed')
	vault.detectedInvalidID((id) => expect(id).toBe('invalid'))
	vault.detectedInvalidID((id) => expect(id).toBe('invalid'))
	a.throws(() => vault.assertID('invalid'))
})

it('disables the vault after an empty id', () => {
	const vault = createIDVault('seed')
	a.throws(() => vault.assertID(''))
	const err = a.throws(() => vault.createID('name'))
	expect(err.message).toBe('vault disabled as invalid id was detected: ')
})

it('throws on createID after the vault is disabled', () => {
	const vault = createIDVault('seed')
	a.throws(() => vault.assertID('invalid'))
	const err = a.throws(() => vault.createID('name'))
	expect(err.message).toBe('vault disabled as invalid id was detected: invalid')
})

it('keeps the assertID error and runs later listeners when a listener throws', () => {
	const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
	try {
		const vault = createIDVault('seed')
		const later = vi.fn()
		const boom = new Error('listener failed')
		vault.onInvalidID(() => {
			throw boom
		})
		vault.onInvalidID(later)
		const err = a.throws(() => vault.assertID('invalid'))
		expect(err.message).toBe('Detected invalid id: invalid')
		expect(later).toHaveBeenCalledWith('invalid')
		expect(consoleError).toHaveBeenCalledWith(boom)
	} finally {
		consoleError.mockRestore()
	}
})

it('removes a listener with the function onInvalidID returns', () => {
	const vault = createIDVault('seed')
	const listener = vi.fn()
	const off = vault.onInvalidID(listener)
	off()
	off()
	a.throws(() => vault.assertID('invalid'))
	expect(listener).not.toHaveBeenCalled()
})

it('returns an unsubscribe function from the deprecated detectedInvalidID', () => {
	const vault = createIDVault('seed')
	const listener = vi.fn()
	vault.detectedInvalidID(listener)()
	a.throws(() => vault.assertID('invalid'))
	expect(listener).not.toHaveBeenCalled()
})
