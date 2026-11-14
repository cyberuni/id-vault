import { encodeSHA256 as encodeBrowser } from './encoder.browser.js'
import { encodeSHA256 as encodeNode } from './encoder.js'

// The two encoders are interchangeable: an ID made by a node vault must pass a browser
// vault with the same seed, and the other way round.
it.each(['', 'seed:name', 'ünïcödé:名前', 'x'.repeat(1000)])(
	'both encoders give the same SHA-256 hex for %j',
	(data) => {
		expect(encodeBrowser(data)).toBe(encodeNode(data))
	}
)

it('encodes SHA-256 as lowercase hex', () => {
	expect(encodeNode('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
})
