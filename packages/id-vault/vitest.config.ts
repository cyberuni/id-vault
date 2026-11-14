import { defineConfig } from 'vitest/config'

/**
 * One project on node. Node and browsers run the same token code (`@noble/hashes`),
 * and `ts/package.spec.ts` checks the browser side on a real browser bundle of the packed tarball.
 */
export default defineConfig({
	test: {
		globals: true,
		environment: 'node',
		include: ['ts/**/*.spec.ts'],
		coverage: {
			provider: 'v8',
			include: ['ts/**/*.ts'],
			// `index.ts` is a re-export barrel with no branches — it says nothing about
			// the library.
			exclude: ['ts/**/*.spec.ts', 'ts/index.ts'],
			reporter: ['text', 'lcov'],
			// Set to what the suite already achieves, so a regression fails the build
			// instead of quietly reporting a lower number.
			thresholds: { statements: 100, branches: 100, functions: 100, lines: 100 }
		}
	}
})
