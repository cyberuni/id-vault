import { writeFile } from 'node:fs/promises'
import { defineConfig } from 'tsdown'

/**
 * Two outputs, matching what the package has always published:
 *
 * - `cjs/*.js` + `cjs/*.d.ts` — one file per source module, plus the
 *   `cjs/package.json` `{"type":"commonjs"}` marker the `"type": "module"` root
 *   would otherwise override.
 * - `esm/*.js` + `esm/*.d.ts` — the same per-module shape.
 *
 * `unbundle` keeps the shape `tsc` used to emit, so no published path moves.
 */
const entry = ['ts/**/*.ts', '!ts/**/*.spec.ts']

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
	}
])
