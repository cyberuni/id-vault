/** @type {import('jest').Config} */
export default {
	displayName: 'jsdom',
	preset: '@repobuddy/jest/presets/jsdom-ts',
	testEnvironment: '<rootDir>/.jest/jsdom.cjs',
	moduleNameMapper: {
		'./encoder.js': '<rootDir>/ts/encoder.browser.ts'
	}
}
