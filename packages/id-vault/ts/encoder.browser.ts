export function encoder(algorithm: string) {
	const encoder = new TextEncoder()
	return async (data: string) => {
		const hashBuffer = await crypto.subtle.digest(algorithm, encoder.encode(data))
		const hashArray = Array.from(new Uint8Array(hashBuffer))
		const hashHex = hashArray.map(bytes => bytes.toString(16).padStart(2, '0')).join('')
		return hashHex
	}
}
