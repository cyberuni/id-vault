import { createHash } from 'crypto'

export function encoder(algorithm: string) {
	return async (data: string) => createHash(algorithm).update(data).digest('hex')
}
