import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, readdir, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build, type Rolldown } from 'vite'

/**
 * Checks the package as consumers get it: `pnpm pack` the built output, install the
 * tarball into a scratch project, and resolve `id-vault` from there.
 *
 * Node and browsers must run the same code: `@noble/hashes`, with no `node:crypto`.
 * A browser bundle that pulls in `node:crypto` fails at load.
 *
 * Needs `pnpm build` first. turbo's `test` and `coverage` tasks depend on `build`,
 * and the package `verify` script builds before it runs the tests.
 */

const packageDir = fileURLToPath(new URL('..', import.meta.url))
const seed = 'seed-0123456789abcdef'
const expectedID = 'name:645c034666dd18bb1dcda647cf8f26b6adba38ef864f0a3f62c9794d81acaa04'
let dir: string
let tarball: string
let installed: string

beforeAll(async () => {
	dir = await realpath(await mkdtemp(join(tmpdir(), 'id-vault-package-')))
	execFileSync('pnpm', ['pack', '--pack-destination', dir], { cwd: packageDir, stdio: 'ignore' })
	tarball = join(dir, (await readdir(dir)).find((f) => f.endsWith('.tgz'))!)
	installed = join(dir, 'node_modules', 'id-vault')
	await mkdir(installed, { recursive: true })
	execFileSync('tar', ['-xzf', tarball, '-C', installed, '--strip-components=1'])
	// The tarball's one dependency, taken from this workspace instead of the registry.
	await mkdir(join(dir, 'node_modules', '@noble'))
	await symlink(
		await realpath(join(packageDir, 'node_modules', '@noble', 'hashes')),
		join(dir, 'node_modules', '@noble', 'hashes')
	)
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
	const chunks = result.flatMap((r) => r.output).filter((chunk) => chunk.type === 'chunk')
	return {
		code: chunks.map((chunk) => chunk.code).join('\n'),
		// The path inside the last `node_modules`: the dependency is a symlink into the workspace store.
		modules: chunks.flatMap((chunk) => chunk.moduleIds).map((id) => id.replace(/^.*\/node_modules\//, ''))
	}
}

function expectNoNodeCrypto(code: string) {
	// Match the module specifier and the call, not prose: doc comments may mention `node:crypto`.
	expect(code).not.toMatch(/["'](node:)?crypto["']|\bcreateHash\(|__vite-browser-external/)
}

it('ships LICENSE and the build, and no spec files', () => {
	const files = execFileSync('tar', ['-tzf', tarball], { encoding: 'utf8' })
		.split('\n')
		.filter(Boolean)
		.map((f) => f.replace(/^package\//, ''))
	expect(files).toEqual(
		expect.arrayContaining(['LICENSE', 'README.md', 'package.json', 'cjs/index.js', 'esm/index.js'])
	)
	expect(files.filter((f) => /\.spec\./.test(f))).toEqual([])
	expect(files.filter((f) => /encoder/.test(f))).toEqual([])
})

it('depends on @noble/hashes and not on crypto-js', async () => {
	const pkg = JSON.parse(await readFile(join(installed, 'package.json'), 'utf8'))
	expect(Object.keys(pkg.dependencies)).toEqual(['@noble/hashes'])
	expect(JSON.stringify(pkg)).not.toMatch(/crypto-js|"browser"/)
})

it('a browser bundle importing the package has no node:crypto, and makes the same ID as node', async () => {
	const { code, modules } = await bundleForBrowser(
		'main.js',
		`import { createIDVault, createKeyVault } from 'id-vault'
export const vault = createIDVault(${JSON.stringify(seed)})
export const keys = createKeyVault()`
	)
	expectNoNodeCrypto(code)
	// The browser bundle holds the same ESM files that node imports, and the same hash code.
	expect(modules).toEqual(
		expect.arrayContaining([
			'id-vault/esm/id_vault.js',
			'id-vault/esm/token.js',
			'id-vault/esm/key_vault.js',
			'@noble/hashes/hmac.js',
			'@noble/hashes/sha2.js'
		])
	)
	const { vault, keys } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
	const id = vault.createID('name')
	expect(id).toBe(expectedID)
	vault.assertID(id)
	keys.assertKey(keys.createKey('store'))
})

it('a browser bundle requiring the package has no node:crypto', async () => {
	const { code, modules } = await bundleForBrowser(
		'main.cjs',
		`const { createIDVault } = require('id-vault')
module.exports = createIDVault`
	)
	expectNoNodeCrypto(code)
	expect(modules).toEqual(expect.arrayContaining(['id-vault/cjs/token.js']))
})

it('node imports the ESM build', async () => {
	const esm = await import(pathToFileURL(join(installed, 'esm/index.js')).href)
	const id = esm.createIDVault(seed).createID('name')
	expect(id).toBe(expectedID)
	esm.createIDVault(seed).assertID(id)
})

it('node requires the built CJS entry, which makes and checks the same IDs', () => {
	const require = createRequire(join(dir, 'main.cjs'))
	expect(require.resolve('id-vault')).toBe(join(installed, 'cjs/index.js'))
	const cjs = require('id-vault')
	expect(Object.keys(cjs).sort()).toEqual(['MIN_SEED_BYTES', 'createIDVault', 'createKeyVault'])
	const vault = cjs.createIDVault(seed)
	expect(vault.createID('name')).toBe(expectedID)
	vault.assertID(expectedID)
	expect(() => vault.assertID('name:0000')).toThrow('Detected invalid id: name:0000')
	const keys = cjs.createKeyVault()
	keys.assertKey(keys.createKey('store'))
	expect(() => keys.assertKey({ name: 'store' })).toThrow('Detected invalid key')
})
