import { defineConfig } from 'tsdown'

/**
 * One output: `esm/*.js` + `esm/*.d.ts`, one file per source module.
 *
 * `unbundle` keeps the shape `tsc` used to emit, so no published path moves.
 */
export default defineConfig({
	entry: ['ts/**/*.ts', '!ts/**/*.spec.ts'],
	format: 'esm',
	outDir: 'esm',
	platform: 'node',
	unbundle: true,
	// `tsc` published `.d.ts.map` and `.js.map` alongside the output; the maps
	// resolve against the `ts/` sources the package already ships.
	dts: { sourcemap: true },
	sourcemap: true,
	outExtensions: () => ({ js: '.js', dts: '.d.ts' }),
	clean: ['esm']
})
