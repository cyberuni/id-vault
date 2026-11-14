import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { vi } from 'vitest'

const compare = vi.hoisted(() => ({ calls: [] as Array<[string, string]> }))

vi.mock('./constant_time_equal.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./constant_time_equal.js')>()
	return {
		constantTimeEqual(expected: string, digest: string) {
			compare.calls.push([expected, digest])
			return actual.constantTimeEqual(expected, digest)
		}
	}
})

const { createIDVault } = await import('./index.js')

it('compares tokens with constantTimeEqual', () => {
	const vault = createIDVault('seed-0123456789abcdef')
	const id = vault.createID('name')
	vault.assertID(id)
	const token = id.slice('name:'.length)
	expect(compare.calls).toEqual([[token, token]])
})

it('uses createIDVault, the exported name, in its JSDoc examples', () => {
	const source = readFileSync(join(import.meta.dirname, 'id_vault.ts'), 'utf8')
	expect(source).not.toMatch(/\bcreateVault\(/)
})
