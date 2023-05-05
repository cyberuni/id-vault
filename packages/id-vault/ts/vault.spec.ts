import { expect, it } from '@jest/globals'
import { a } from 'assertron'
import { createVault } from './index.js'

it('creates an id', async () => {
	const vault = createVault('seed')
	const id = await vault.createID('name')
	expect(id).toBe('name:af0438752dee330e0a0706c287ebbc0ba15db3bb15e4cf619bdf755f73efdb30')
})

it('creates different ids for different names', async () => {
	const vault = createVault('seed')
	const set = new Set()
	for (let i = 0; i < 100; i++) {
		set.add(await vault.createID(`name${i}`))
	}
	expect(set.size).toBe(100)
})

it('creates different ids for different seeds', async () => {
	const set = new Set()
	for (let i = 0; i < 100; i++) {
		const vault = createVault(`seed${i}`)
		set.add(await vault.createID(`name`))
	}
	expect(set.size).toBe(100)
})

it('asserts an id is valid', async () => {
	const vault = createVault('seed')
	const id = await vault.createID('name')
	await vault.assertID(id)
})

it('asserts an id is invalid', async () => {
	const vault = createVault('seed')
	const id = await vault.createID('name')

	await a.throws(() => vault.assertID(id + 'x'))
})

it('can specify algorithm', async () => {
	const vault = createVault('some seed', 'SHA-1')
	const id = await vault.createID('name')
	expect(id).toBe('name:859df0c6508f53df229d359a6f7f0c3fa8bdcb6e')
})

it.todo("once intruded, only existing id will work (configurable)")
