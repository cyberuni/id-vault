import SHA256 from 'crypto-js/sha256.js'

export function encodeSHA256(data: string) {
	return SHA256(data).toString()
}
