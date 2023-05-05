import { encoder } from './encoder.js'

export function createVault(seed: string, algorithm = 'SHA-256') {
	const encode = encoder(algorithm)
	let intruded = false

	return {
		async createID(name: string) {
			if (intruded) throw new Error('Intruded')
			return `${name}:${await encode(`${seed}:${name}`)}`
		},
		async assertID(id: string) {
			if (intruded) throw new Error('Intruded')
			const [name, digest] = id.split(':', 2)
			const d = await encode(`${seed}:${name}`)
			if (d !== digest) {
				intruded = true
				throw new Error('Invalid ID')
			}
		}
	}
}
