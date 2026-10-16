import { orgEnvVar, orgSlugFromFlag } from './org-slug.js'

export { orgEnvVar, orgSlugFromFlag } from './org-slug.js'

/**
 * Precedence for which org a command acts as: `--org` flag, then `KODY_ORG`,
 * then the active org in the credential store.
 */
export function resolveOrgSlug(input: {
	flag?: string
	env?: NodeJS.ProcessEnv
	/** Active org from the credential store. Used when flag and env are absent. */
	activeOrg?: string | null
}): string | undefined {
	if (input.flag !== undefined) return orgSlugFromFlag(input.flag)
	const fromEnv = input.env?.[orgEnvVar] ?? process.env[orgEnvVar]
	if (typeof fromEnv === 'string' && fromEnv.trim()) {
		return orgSlugFromFlag(fromEnv)
	}
	if (typeof input.activeOrg === 'string' && input.activeOrg.trim()) {
		return orgSlugFromFlag(input.activeOrg)
	}
	return undefined
}
