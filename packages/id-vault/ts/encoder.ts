import { createHash } from 'crypto'

export function encoder(algorithm: string) {
	const hasher = createHash(algorithm)
	return async (data: string) => hasher.update(data).digest('hex')
}
