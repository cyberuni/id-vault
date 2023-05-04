'use strict'

const { TextEncoder, TextDecoder } = require('util')
const { default: $JSDOMEnvironment, TestEnvironment } = require('jest-environment-jsdom')
const crypto = require('crypto')

Object.defineProperty(exports, '__esModule', {
	value: true
})

class JSDOMEnvironment extends $JSDOMEnvironment {
	constructor(...args) {
		const { global } = super(...args)
		if (!global.TextEncoder) global.TextEncoder = TextEncoder
		if (!global.TextDecoder) global.TextDecoder = TextDecoder
		if (!global.crypto.subtle) global.crypto.subtle = crypto.webcrypto.subtle
	}
}

exports.default = JSDOMEnvironment
exports.TestEnvironment = TestEnvironment === $JSDOMEnvironment ? JSDOMEnvironment : TestEnvironment
