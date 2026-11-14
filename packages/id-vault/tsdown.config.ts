import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { defineConfig, type UserConfig } from 'tsdown'

/**
 * Two outputs, matching what the package has always published:
 *
 * - `cjs/*.js` + `cjs/*.d.ts` — one file per source module, plus the
 *   `cjs/package.json` `{"type":"commonjs"}` marker the `"type": "module"` root
 *   would otherwise override.
 * - `esm/*.js` + `esm/*.d.ts` — the same per-module shape.
 *
 * `unbundle` keeps the shape `tsc` used to emit, so no published path moves.
 *
 * Plus a browser build of each format, `esm/browser/index.js` and
 * `cjs/browser/index.js`, that the `browser` condition in `package.json` `exports`
 * points at. It is one bundled file with `./encoder.js` swapped for
 * `ts/encoder.browser.ts`, so a browser bundle never sees `node:crypto`. `crypto-js`
 * stays external, as a dependency.
 *
 * tsdown cleans every config's `clean` paths once, before any config builds, so the
 * browser output inside `esm/` and `cjs/` is not wiped by the node builds.
 */
const entry = ['ts/**/*.ts', '!ts/**/*.spec.ts']

const browserEncoder = fileURLToPath(new URL('ts/encoder.browser.ts', import.meta.url))

function browser(format: 'cjs' | 'esm'): UserConfig {
	return {
		entry: { index: 'ts/index.ts' },
		format,
		outDir: `${format}/browser`,
		platform: 'browser',
		alias: { './encoder.js': browserEncoder },
		dts: { sourcemap: true },
		sourcemap: true,
		outExtensions: () => ({ js: '.js', dts: '.d.ts' })
	}
}

export default defineConfig([
	{
		entry,
		format: 'cjs',
		outDir: 'cjs',
		platform: 'node',
		unbundle: true,
		// `tsc` published `.d.ts.map` and `.js.map` alongside the output; the maps
		// resolve against the `ts/` sources the package already ships.
		dts: { sourcemap: true },
		sourcemap: true,
		outExtensions: () => ({ js: '.js', dts: '.d.ts' }),
		clean: ['cjs'],
		hooks: {
			// `copy`'s `to` is treated as a directory, so it cannot write a file named
			// `cjs/package.json`. Write it after the build instead.
			'build:done': async () => {
				await writeFile('cjs/package.json', `${JSON.stringify({ type: 'commonjs' }, null, 2)}\n`)
			}
		}
	},
	{
		entry,
		format: 'esm',
		outDir: 'esm',
		platform: 'node',
		unbundle: true,
		dts: { sourcemap: true },
		sourcemap: true,
		outExtensions: () => ({ js: '.js', dts: '.d.ts' }),
		clean: ['esm']
	},
	browser('cjs'),
	browser('esm')
])
