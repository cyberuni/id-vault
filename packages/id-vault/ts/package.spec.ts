import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, readdir, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build, type Rolldown } from 'vite'

/**
 * Checks the package as consumers get it: `pnpm pack` the built output, install the
 * tarball into a scratch project, and resolve `id-vault` from there.
 *
 * A browser bundle must pick the `browser` condition in `exports`, which carries the
 * crypto-js encoder. If it picks the node build instead, `node:crypto` ends up in the
 * bundle and the page fails at load.
 *
 * Needs `pnpm build` first (turbo's `test` and `coverage` tasks depend on `build`).
 */

const packageDir = fileURLToPath(new URL('..', import.meta.url))
let dir: string

beforeAll(async () => {
	dir = await mkdtemp(join(tmpdir(), 'id-vault-package-'))
	execFileSync('pnpm', ['pack', '--pack-destination', dir], { cwd: packageDir, stdio: 'ignore' })
	const tarball = (await readdir(dir)).find((f) => f.endsWith('.tgz'))!
	const installed = join(dir, 'node_modules', 'id-vault')
	await mkdir(installed, { recursive: true })
	execFileSync('tar', ['-xzf', join(dir, tarball), '-C', installed, '--strip-components=1'])
	// The tarball's one dependency, taken from this workspace instead of the registry.
	await symlink(await realpath(join(packageDir, 'node_modules', 'crypto-js')), join(dir, 'node_modules', 'crypto-js'))
}, 60_000)

afterAll(async () => {
	if (dir) await rm(dir, { recursive: true, force: true })
})

async function bundleForBrowser(file: string, source: string) {
	await writeFile(join(dir, file), source)
	const result = (await build({
		root: dir,
		configFile: false,
		logLevel: 'silent',
		build: {
			write: false,
			minify: false,
			lib: { entry: join(dir, file), formats: ['es'], fileName: 'out' }
		}
	})) as Rolldown.RolldownOutput[]
	return result
		.flatMap((r) => r.output)
		.map((chunk) => (chunk.type === 'chunk' ? chunk.code : ''))
		.join('\n')
}

// crypto-js has a guarded `require('crypto')` of its own, which its `browser` field maps
// to an empty module (Vite emits `__vite-browser-external`). Check only for the node encoder.
function expectBrowserEncoder(code: string) {
	// Match the module specifier and the call, not prose: doc comments may mention `node:crypto`.
	expect(code).not.toMatch(/["']node:crypto["']|\bcreateHash\(/)
	expect(code).toContain('CryptoJS')
}

it('a browser bundle importing the package uses the crypto-js encoder', async () => {
	const code = await bundleForBrowser(
		'main.js',
		`import { createIDVault } from 'id-vault'
export const vault = createIDVault('seed')`
	)
	expectBrowserEncoder(code)
	// The bundle runs, and makes the same ID the node build makes.
	const { vault } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
	const id = vault.createID('name')
	expect(id).toBe('name:af0438752dee330e0a0706c287ebbc0ba15db3bb15e4cf619bdf755f73efdb30')
	vault.assertID(id)
})

it('a browser bundle requiring the package uses the crypto-js encoder', async () => {
	const code = await bundleForBrowser(
		'main.cjs',
		`const { createIDVault } = require('id-vault')
module.exports = createIDVault`
	)
	expectBrowserEncoder(code)
})

it('node resolves the node:crypto encoder for import and require', async () => {
	const require = createRequire(join(dir, 'main.js'))
	const cjs = require.resolve('id-vault')
	expect(cjs).toBe(join(await realpath(dir), 'node_modules/id-vault/cjs/index.js'))
	expect(require('id-vault').createIDVault('seed').createID('name')).toBe(
		'name:af0438752dee330e0a0706c287ebbc0ba15db3bb15e4cf619bdf755f73efdb30'
	)
	const esm = await import(join(dir, 'node_modules/id-vault/esm/index.js'))
	expect(esm.createIDVault('seed').createID('name')).toBe(
		'name:af0438752dee330e0a0706c287ebbc0ba15db3bb15e4cf619bdf755f73efdb30'
	)
})
