/** @type {import('jest').Config} */
export default {
	preset: '@repobuddy/jest/presets/watch',
	projects: [
		'<rootDir>/jest.config.nodejs.js',
		'<rootDir>/jest.config.jsdom.js'
	]
}
