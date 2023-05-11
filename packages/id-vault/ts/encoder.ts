import { createHash } from 'crypto'

export function encodeSHA256(data: string) {
	return createHash('sha256').update(data).digest('hex')
}
