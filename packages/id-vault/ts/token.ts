import { hmac } from '@noble/hashes/hmac.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { bytesToHex, concatBytes, utf8ToBytes } from '@noble/hashes/utils.js'

/**
 * Compute the token of an ID: `HMAC-SHA-256(key, field(scope) ‖ field(name))` as 64 lowercase hex characters.
 *
 * Each field is its UTF-8 bytes preceded by their length as a 4-byte big-endian integer,
 * so no two `(scope, name)` pairs encode to the same input, whatever characters they contain.
 * A vault without a scope encodes `scope` as `''`, which no scoped vault can have.
 *
 * `@noble/hashes` is pure JavaScript and synchronous, so node and browsers run this same code.
 */
export function computeToken(key: Uint8Array, scope: string, name: string): string {
	return bytesToHex(hmac(sha256, key, concatBytes(field(scope), field(name))))
}

function field(value: string) {
	const bytes = utf8ToBytes(value)
	const length = new Uint8Array(4)
	new DataView(length.buffer).setUint32(0, bytes.length)
	return concatBytes(length, bytes)
}
