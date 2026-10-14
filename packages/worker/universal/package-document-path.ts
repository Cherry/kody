/** Parse package document identities for cache and resource lookup, not routing. */
export function parsePackageDocumentPath(pathname: string) {
	let parts: string[]
	try {
		parts = new URL(pathname, 'https://kody.local').pathname
			.replace(/\/$/, '')
			.split('/')
			.slice(1)
	} catch {
		return null
	}
	const decode = (value: string) => decodeURIComponent(value)
	try {
		if (
			parts[0] === 'account' &&
			parts[1] === 'packages' &&
			parts[2] &&
			parts[3] === 'files'
		) {
			return {
				kind: 'account-files' as const,
				packageId: decode(parts[2]),
				relativePath: parts.slice(4).join('/'),
			}
		}
		if (parts[0] === 'community' && parts[1]) {
			if (parts.length === 2)
				return { kind: 'listing' as const, listingId: decode(parts[1]) }
			if (parts[2] === 'files')
				return {
					kind: 'listing-files' as const,
					listingId: decode(parts[1]),
					relativePath: parts.slice(3).join('/'),
				}
			return null
		}
		if (!parts[0]?.startsWith('@') || parts[0].length < 2 || !parts[1])
			return null
		const identity = {
			username: decode(parts[0].slice(1)),
			kodyId: decode(parts[1]),
		}
		if (parts.length === 2) return { kind: 'package' as const, ...identity }
		if (parts[2] === 'files')
			return {
				kind: 'package-files' as const,
				...identity,
				relativePath: parts.slice(3).join('/'),
			}
		if (parts[2] === 'tree' && parts[3])
			return {
				kind: 'package-tree' as const,
				...identity,
				ref: decode(parts[3]),
				relativePath: parts.slice(4).join('/'),
			}
		if (
			parts.length === 3 &&
			[
				'settings',
				'credentials',
				'mappings',
				'triggers',
				'collaborators',
			].includes(parts[2]!)
		)
			return { kind: 'package-tab' as const, ...identity, tab: parts[2]! }
		return null
	} catch {
		return null
	}
}
