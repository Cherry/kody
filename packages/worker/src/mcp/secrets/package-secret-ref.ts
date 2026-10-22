import {
	base64UrlToBytes,
	bytesToBase64Url,
} from '@kody-internal/shared/base64.ts'

const textEncoder = new TextEncoder()

/** Mint a per-run key for HMAC-binding package-scoped secret placeholders. */
export function createPackageSecretRefKey() {
	return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)))
}

function refPayload(packageId: string, alias: string) {
	return `package:${packageId.trim()}:${alias.trim()}`
}

async function hmacKey(refKey: string) {
	return crypto.subtle.importKey(
		'raw',
		base64UrlToBytes(refKey),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign', 'verify'],
	)
}

/** Issue a ref that binds a package-scoped mount alias to one package in one run. */
export async function issuePackageSecretRef(input: {
	refKey: string
	packageId: string
	alias: string
}) {
	const key = await hmacKey(input.refKey)
	const mac = await crypto.subtle.sign(
		'HMAC',
		key,
		textEncoder.encode(refPayload(input.packageId, input.alias)),
	)
	return bytesToBase64Url(new Uint8Array(mac))
}

export async function verifyPackageSecretRef(input: {
	refKey: string
	packageId: string
	alias: string
	ref: string
}) {
	const expected = await issuePackageSecretRef({
		refKey: input.refKey,
		packageId: input.packageId,
		alias: input.alias,
	})
	// Constant-time-ish compare of equal-length base64url strings.
	if (expected.length !== input.ref.length) return false
	let diff = 0
	for (let i = 0; i < expected.length; i += 1) {
		diff |= expected.charCodeAt(i) ^ input.ref.charCodeAt(i)
	}
	return diff === 0
}
