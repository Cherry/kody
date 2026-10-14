import {
	buildAccountSecretId,
	type AccountSecretRouteIdInput,
} from '@kody-internal/shared/account-secret-route.ts'
export function secretsInput(
	orgSlug: string,
	search: string,
	selection?: AccountSecretRouteIdInput,
	create = false,
) {
	const params = new URLSearchParams(search)
	const scope = params.get('scope')?.trim()
	return {
		orgSlug,
		create,
		setupName: params.get('name') ?? undefined,
		provider: params.get('provider') ?? undefined,
		selectedSecretId: selection
			? buildAccountSecretId(selection)
			: params.get('selected')?.trim() || null,
		approval: {
			hosts: [
				...params.getAll('hosts'),
				...params.getAll('host'),
				...params.getAll('allowed-host'),
				...params.getAll('allowedHosts'),
			],
			names: [...params.getAll('names'), ...params.getAll('name')],
			packageId: params.get('package_id') ?? undefined,
			scope:
				scope === 'session'
					? ('session' as const)
					: scope === 'package'
						? ('package' as const)
						: ('user' as const),
			storagePackageId: params.get('packageId') ?? undefined,
			sessionId: params.get('sessionId') ?? undefined,
		},
	}
}
