import { constantTimeEqual } from './constant_time_equal.js'

it('is true for equal strings', () => {
	expect(constantTimeEqual('abc', 'abc')).toBe(true)
	expect(constantTimeEqual('', '')).toBe(true)
})

it('is false when a character differs', () => {
	expect(constantTimeEqual('abc', 'abd')).toBe(false)
	expect(constantTimeEqual('abc', 'xbc')).toBe(false)
})

it('is false when the lengths differ', () => {
	expect(constantTimeEqual('abc', 'ab')).toBe(false)
	expect(constantTimeEqual('abc', 'abcd')).toBe(false)
	expect(constantTimeEqual('abc', '')).toBe(false)
	expect(constantTimeEqual('', 'a')).toBe(false)
})

it('is false when a NUL character pads the shorter string', () => {
	expect(constantTimeEqual('ab\0', 'ab')).toBe(false)
})
