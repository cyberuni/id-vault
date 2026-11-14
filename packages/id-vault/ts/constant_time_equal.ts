/**
 * Compare two strings in time that depends only on the length of `expected`.
 *
 * Works the same on node and in browsers, so it needs no `node:crypto`.
 * `expected` is the token the vault computed: its length is not secret.
 */
export function constantTimeEqual(expected: string, actual: string): boolean {
	let diff = expected.length ^ actual.length
	for (let i = 0; i < expected.length; i++) {
		// Past the end of `actual`, `charCodeAt` returns NaN, which `^` treats as 0.
		// The length check above already marks that case as different.
		diff |= expected.charCodeAt(i) ^ actual.charCodeAt(i)
	}
	return diff === 0
}
