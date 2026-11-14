import { createHmac } from 'node:crypto'
import { a } from 'assertron'
import { createIDVault } from './index.js'

const seed = 'seed-0123456789abcdef'
const seed2 = 'seed-fedcba9876543210'

/**
 * The token format, computed with `node:crypto` as an oracle independent of `@noble/hashes`:
 * HMAC-SHA-256 keyed by the seed, over each field's UTF-8 bytes preceded by a 4-byte big-endian length.
 */
function expectedToken(key: string, scope: string, name: string) {
	const field = (value: string) => {
		const bytes = Buffer.from(value, 'utf8')
		const length = Buffer.alloc(4)
		length.writeUInt32BE(bytes.length)
		return Buffer.concat([length, bytes])
	}
	return createHmac('sha256', key)
		.update(Buffer.concat([field(scope), field(name)]))
		.digest('hex')
}

function tokenOf(id: string) {
	return id.slice(id.lastIndexOf(':') + 1)
}

it('creates an id', () => {
	const vault = createIDVault(seed)
	const id = vault.createID('name')
	expect(id).toBe('name:645c034666dd18bb1dcda647cf8f26b6adba38ef864f0a3f62c9794d81acaa04')
})

it('computes the token as HMAC-SHA-256 over the length-prefixed scope and name', () => {
	expect(createIDVault(seed).createID('name')).toBe(`name:${expectedToken(seed, '', 'name')}`)
	expect(createIDVault(seed, { scope: 'pre' }).createID('name')).toBe(`pre:name:${expectedToken(seed, 'pre', 'name')}`)
	expect(createIDVault('ключ-0123456789').createID('名前:x')).toBe(
		`名前:x:${expectedToken('ключ-0123456789', '', '名前:x')}`
	)
})

it('creates a 64 character lowercase hex token', () => {
	expect(tokenOf(createIDVault(seed).createID('name'))).toMatch(/^[0-9a-f]{64}$/)
})

it('creates different ids for different names', () => {
	const vault = createIDVault(seed)
	const set = new Set()
	for (let i = 0; i < 100; i++) {
		set.add(vault.createID(`name${i}`))
	}
	expect(set.size).toBe(100)
})

it('creates different ids for different seeds', () => {
	const set = new Set()
	for (let i = 0; i < 100; i++) {
		const vault = createIDVault(`${seed}${i}`)
		set.add(vault.createID('name'))
	}
	expect(set.size).toBe(100)
})

it('asserts an id is valid', () => {
	const vault = createIDVault(seed)
	const id = vault.createID('name')
	expect(() => vault.assertID(id)).not.toThrow()
})

it('rejects the same id with a tampered digest', () => {
	const vault = createIDVault(seed)
	const id = vault.createID('name')
	const tampered = `${id.slice(0, -1)}${id.endsWith('0') ? '1' : '0'}`
	const err = a.throws(() => vault.assertID(tampered))
	expect(err.message).toBe(`Detected invalid id: ${tampered}`)
})

it('throws when it is an invalid id', () => {
	const vault = createIDVault(seed)
	const err = a.throws(() => vault.assertID('some-invalid-id'))
	expect(err.message).toBe('Detected invalid id: some-invalid-id')
})

it('throws when it is an invalid id (different seed)', () => {
	const id = createIDVault(seed).createID('name')
	a.throws(() => createIDVault(seed2).assertID(id))
})

describe('seed', () => {
	it('rejects a seed under 16 bytes of UTF-8, including an empty seed', () => {
		for (const short of ['', 'seed', '0123456789abcde', 'é'.repeat(7) + 'a']) {
			const err = a.throws(() => createIDVault(short), TypeError)
			expect(err.message).toBe('seed must be at least 16 bytes of UTF-8')
		}
	})

	it('accepts a seed of 16 bytes of UTF-8, counting bytes and not characters', () => {
		expect(() => createIDVault('0123456789abcdef')).not.toThrow()
		// 8 characters, 2 bytes each.
		expect(() => createIDVault('é'.repeat(8))).not.toThrow()
	})

	it('rejects a seed that is not a string', () => {
		const err = a.throws(() => createIDVault(123 as unknown as string), TypeError)
		expect(err.message).toBe('seed must be a string')
	})
})

it('rejects the removed encode option', () => {
	const options = { encode: (input: string) => input } as unknown as Parameters<typeof createIDVault>[1]
	const err = a.throws(() => createIDVault(seed, options), TypeError)
	expect(err.message).toBe('the encode option was removed in id-vault 2: the token is always HMAC-SHA-256')
})

it('does not let a seed and a name trade characters (unambiguous encoding)', () => {
	// 1.x hashed `seed + ':' + name`, so these two gave the same token.
	const t1 = tokenOf(createIDVault(`${seed}:x`).createID('y'))
	const t2 = tokenOf(createIDVault(seed).createID('x:y'))
	expect(t1).not.toBe(t2)
})

describe('scope', () => {
	it('can specify a scope', () => {
		const vault = createIDVault(seed, { scope: 'pre' })
		const id = vault.createID('name')
		expect(id).toBe(`pre:name:${expectedToken(seed, 'pre', 'name')}`)
		vault.assertID(id)
	})

	it('binds the token to the scope, so an id cannot move to another scope', () => {
		const token = tokenOf(createIDVault(seed, { scope: 'pre' }).createID('name'))
		a.throws(() => createIDVault(seed).assertID(`name:${token}`))
		a.throws(() => createIDVault(seed, { scope: 'other' }).assertID(`other:name:${token}`))
	})

	it('tells a scope with ":" apart from a name with ":" in the same id', () => {
		const id = createIDVault(seed, { scope: 'a:b' }).createID('c')
		const other = createIDVault(seed, { scope: 'a' })
		expect(other.isOwnID(id)).toBe(true)
		a.throws(() => other.assertID(id))
		expect(other.createID('b:c')).not.toBe(id)
	})

	it('rejects an id with two or more ":" in an unscoped vault', () => {
		const vault = createIDVault(seed)
		a.throws(() => vault.assertID('x:y:z'))
		a.throws(() => vault.assertID('y:z'))
	})

	it('rejects an id without ":" in an unscoped vault', () => {
		a.throws(() => createIDVault(seed).assertID('name'))
	})

	it('rejects a scoped id in an unscoped vault with the same seed', () => {
		const id = createIDVault(seed, { scope: 'pre' }).createID('name')
		const err = a.throws(() => createIDVault(seed).assertID(id))
		expect(err.message).toBe(`Detected invalid id: ${id}`)
	})

	it('rejects an id with a different scope', () => {
		const id = createIDVault(seed, { scope: 'pre' }).createID('name')
		a.throws(() => createIDVault(seed, { scope: '2' }).assertID(id))
	})

	it('rejects an id without the scope in a scoped vault', () => {
		const vault = createIDVault(seed, { scope: 'pre' })
		a.throws(() => vault.assertID('anything'))
		a.throws(() => vault.assertID('other:x:y'))
		a.throws(() => vault.assertID(createIDVault(seed).createID('name')))
	})

	it('rejects a scoped id that has no digest', () => {
		a.throws(() => createIDVault(seed, { scope: 'pre' }).assertID('pre:name'))
	})

	it('accepts a name with ":" in a scoped vault', () => {
		const vault = createIDVault(seed, { scope: 'pre' })
		const id = vault.createID('a:b')
		expect(() => vault.assertID(id)).not.toThrow()
		expect(() => vault.createID('c')).not.toThrow()
	})

	it('accepts a name with ":" in an unscoped vault', () => {
		const vault = createIDVault(seed)
		const id = vault.createID('a:b')
		expect(() => vault.assertID(id)).not.toThrow()
		a.throws(() => vault.assertID(`a:b:${'0'.repeat(64)}`))
	})

	it('checks ids when the scope contains ":"', () => {
		const vault = createIDVault(seed, { scope: 'a:b' })
		const id = vault.createID('name')
		expect(id.startsWith('a:b:name:')).toBe(true)
		expect(() => vault.assertID(id)).not.toThrow()
		a.throws(() => vault.assertID('a:b:name:0000'))
	})

	it('rejects an empty scope', () => {
		const err = a.throws(() => createIDVault(seed, { scope: '' }), TypeError)
		expect(err.message).toBe('scope must be a non-empty string')
	})

	it('tells its own scoped ids apart from others', () => {
		const vault = createIDVault(seed, { scope: 'pre' })
		expect(vault.isOwnID(vault.createID('name'))).toBe(true)
		expect(vault.isOwnID('pre:anything')).toBe(true)
		expect(vault.isOwnID('prefix:name:x')).toBe(false)
		expect(vault.isOwnID('other:name:x')).toBe(false)
		expect(vault.isOwnID('name:x')).toBe(false)
	})

	it('claims every id in an unscoped vault', () => {
		expect(createIDVault(seed).isOwnID('anything')).toBe(true)
	})

	it('lets shared code route ids to several scoped vaults', () => {
		const vaults = [createIDVault(seed, { scope: 'one' }), createIDVault(seed2, { scope: 'two' })]
		function check(id: string) {
			const vault = vaults.find((v) => v.isOwnID(id))
			if (!vault) throw new Error(`unknown id: ${id}`)
			vault.assertID(id)
		}
		expect(() => check(createIDVault(seed, { scope: 'one' }).createID('a'))).not.toThrow()
		expect(() => check(createIDVault(seed2, { scope: 'two' }).createID('b'))).not.toThrow()
		a.throws(() => check('three:c:x'))
	})
})

describe('lone surrogates', () => {
	it('rejects a name with a lone surrogate in createID', () => {
		const err = a.throws(() => createIDVault(seed).createID('\uD800'), TypeError)
		expect(err.message).toBe('name must be well-formed UTF-16')
	})

	it('rejects a scope with a lone surrogate', () => {
		const err = a.throws(() => createIDVault(seed, { scope: 'a\uDC00' }), TypeError)
		expect(err.message).toBe('scope must be well-formed UTF-16')
	})

	it('rejects an id whose name has a lone surrogate, which UTF-8 would turn into U+FFFD', () => {
		const vault = createIDVault(seed)
		const token = tokenOf(vault.createID('�'))
		const err = a.throws(() => vault.assertID(`\uD800:${token}`))
		expect(err.message).toBe(`Detected invalid id: \uD800:${token}`)
	})

	it('accepts a name with a surrogate pair', () => {
		const vault = createIDVault(seed)
		expect(() => vault.assertID(vault.createID('😀'))).not.toThrow()
	})
})

describe('invalid ids (default)', () => {
	it('keeps working after an invalid id', () => {
		const vault = createIDVault(seed)
		a.throws(() => vault.assertID('invalid'))
		a.throws(() => vault.assertID(''))
		const id = vault.createID('name')
		expect(() => vault.assertID(id)).not.toThrow()
	})

	it('notifies the listeners on every invalid id', () => {
		const vault = createIDVault(seed)
		const listener = vi.fn()
		vault.onInvalidID(listener)
		a.throws(() => vault.assertID('first'))
		a.throws(() => vault.assertID('second'))
		expect(listener.mock.calls).toEqual([['first'], ['second']])
	})

	it('can be listened for invalid id event', () => {
		expect.assertions(1)
		const vault = createIDVault(seed)
		vault.detectedInvalidID((id) => expect(id).toBe('invalid'))
		a.throws(() => vault.assertID('invalid'))
	})

	it('can be listened multiple times', () => {
		expect.assertions(2)
		const vault = createIDVault(seed)
		vault.detectedInvalidID((id) => expect(id).toBe('invalid'))
		vault.detectedInvalidID((id) => expect(id).toBe('invalid'))
		a.throws(() => vault.assertID('invalid'))
	})

	it('keeps the assertID error and runs later listeners when a listener throws', () => {
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
		try {
			const vault = createIDVault(seed)
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
		const vault = createIDVault(seed)
		const listener = vi.fn()
		const off = vault.onInvalidID(listener)
		off()
		off()
		a.throws(() => vault.assertID('invalid'))
		expect(listener).not.toHaveBeenCalled()
	})

	it('returns an unsubscribe function from the deprecated detectedInvalidID', () => {
		const vault = createIDVault(seed)
		const listener = vi.fn()
		vault.detectedInvalidID(listener)()
		a.throws(() => vault.assertID('invalid'))
		expect(listener).not.toHaveBeenCalled()
	})
})

describe('disableOnInvalid: true', () => {
	it('always throws after an invalid id was used', () => {
		const vault = createIDVault(seed, { disableOnInvalid: true })
		const id = vault.createID('name')
		a.throws(() => vault.assertID('invalid'))
		const err = a.throws(() => vault.assertID(id))
		expect(err.message).toBe('vault disabled as invalid id was detected: invalid')
	})

	it('disables the vault after an empty id', () => {
		const vault = createIDVault(seed, { disableOnInvalid: true })
		a.throws(() => vault.assertID(''))
		const err = a.throws(() => vault.createID('name'))
		expect(err.message).toBe('vault disabled as invalid id was detected: ')
	})

	it('throws on createID after the vault is disabled', () => {
		const vault = createIDVault(seed, { disableOnInvalid: true })
		a.throws(() => vault.assertID('invalid'))
		const err = a.throws(() => vault.createID('name'))
		expect(err.message).toBe('vault disabled as invalid id was detected: invalid')
	})

	it('notifies the listeners only for the first invalid id', () => {
		const vault = createIDVault(seed, { disableOnInvalid: true })
		const listener = vi.fn()
		vault.onInvalidID(listener)
		a.throws(() => vault.assertID('first'))
		a.throws(() => vault.assertID('second'))
		expect(listener.mock.calls).toEqual([['first']])
	})
})
