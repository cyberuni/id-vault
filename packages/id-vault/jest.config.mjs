/** @type {import('jest').Config} */
export default {
	preset: '@repobuddy/jest/presets/watch',
	projects: [
		'<rootDir>/jest.config.nodejs.mjs',
		'<rootDir>/jest.config.jsdom.mjs'
	]
}
