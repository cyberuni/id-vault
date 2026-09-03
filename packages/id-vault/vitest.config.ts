import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/**
 * The library ships two encoders behind the same `./encoder.js` specifier: the node one
 * uses `node:crypto`, the browser one uses `crypto-js`. Both must be exercised, so the
 * suite runs twice — once as-is, and once with the specifier redirected at the browser
 * file, which is what the jest setup did with `moduleNameMapper`.
 */
const browserEncoder = fileURLToPath(new URL('ts/encoder.browser.ts', import.meta.url))

export default defineConfig({
	test: {
		globals: true,
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
		},
		projects: [
			{
				test: {
					name: 'node',
					globals: true,
					environment: 'node',
					include: ['ts/**/*.spec.ts']
				}
			},
			{
				resolve: {
					alias: [{ find: /^\.\/encoder\.js$/, replacement: browserEncoder }]
				},
				test: {
					name: 'jsdom',
					globals: true,
					environment: 'jsdom',
					include: ['ts/**/*.spec.ts']
				}
			}
		]
	}
})
