import { expect, it } from '@jest/globals'
import { a } from 'assertron'
import { createIDVault } from './index.js'
import crypto from 'crypto-js'

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
		set.add(vault.createID(`name`))
	}
	expect(set.size).toBe(100)
})

it('asserts an id is valid', () => {
	const vault = createIDVault('seed')
	const id = vault.createID('name')
	vault.assertID(id)
})

it('throws when it is an invalid id', () => {
	const vault = createIDVault('seed')
	const err = a.throws(() => vault.assertID('some-invalid-id'))
	expect(err.message).toBe(`Detected invalid id: some-invalid-id`)
})

it('throws when it is an invalid id (different seed)', () => {
	const vault = createIDVault('seed')
	const id = vault.createID('name')
	const vault2 = createIDVault('seed2')
	a.throws(() => vault2.assertID(id))
})

it('can specify algorithm', () => {
	const vault = createIDVault('some seed', {
		encode: id => crypto.SHA1(id).toString()
	})
	const id = vault.createID('name')
	expect(id).toBe('name:859df0c6508f53df229d359a6f7f0c3fa8bdcb6e')
})

it('can specify a scope', () => {
	const vault = createIDVault('some seed', {
		scope: 'pre'
	})
	const id = vault.createID('name')
	expect(id).toBe('pre:name:9035075142833381c6d10133cf7b9ed89c39539142e475f024e6eb540b79e3fb')
	vault.assertID(id)
})

it('no scope vault ignores id with scope', () => {
	const id = createIDVault('some seed', {
		scope: 'pre'
	}).createID('name')

	createIDVault('some seed').assertID(id)
})

it('ignore id with different scope', () => {
	const id = createIDVault('some seed', {
		scope: 'pre'
	}).createID('name')

	createIDVault('some seed', { scope: '2' }).assertID(id)
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
	vault.detectedInvalidID(id => expect(id).toBe('invalid'))
	a.throws(() => vault.assertID('invalid'))
})

it('can be listened multiple times', () => {
	expect.assertions(2)
	const vault = createIDVault('seed')
	vault.detectedInvalidID(id => expect(id).toBe('invalid'))
	vault.detectedInvalidID(id => expect(id).toBe('invalid'))
	a.throws(() => vault.assertID('invalid'))
})
