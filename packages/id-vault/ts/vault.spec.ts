import { expect, it } from '@jest/globals'
import { createVault } from './index.js'

it('creates an id', async () => {
	const vault = createVault('seed')
	const id = await vault.createID('name')
	expect(id).toBe('name:af0438752dee330e0a0706c287ebbc0ba15db3bb15e4cf619bdf755f73efdb30')
})
