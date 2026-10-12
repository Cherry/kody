/** @jsxImportSource @emotion/react */
import { pageQueryOrg } from '../page-query-scope.ts'
import { relocateAccountHref } from '#universal/org-pages.ts'
import { orgAccountApiReferrer } from '#client/org-account-api.ts'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouteContext, useRouter } from '@tanstack/react-router'
import { orgPageFilters } from '../org-page-cache.ts'
import { useState } from 'react'
import { readJson } from '#client/routes/account-approval-shared.ts'
import {
	AccountManagementMessage,
	AccountManagementPanel,
	AccountManagementShell,
	AccountPageHeader,
	accountInputCss,
} from './account-management-components.tsx'
import { routes } from '#universal/routes.ts'
import { type AccountSecretProvidersLoaderData } from '#universal/loader-data.ts'
import { colors, spacing, typography } from '#universal/styles/tokens.ts'
import {
	fieldCss,
	fieldLabelCss,
	getAccentCalloutCss,
	getDangerPillCss,
	getPrimaryButtonCss,
	getSecondaryButtonCss,
	pageDescriptionCss,
} from '#universal/styles/style-primitives.ts'

const apiPath = routes.accountSecretProvidersApi.href()

export function AccountSecretProvidersPage({
	payload,
	currentHref,
}: {
	payload: AccountSecretProvidersLoaderData
	currentHref: string
}) {
	const queryClient = useQueryClient()
	const { actorKey } = useRouteContext({ from: '__root__' })
	const router = useRouter()
	const [revokeArmed, setRevokeArmed] = useState<string | null>(null)

	const [message, setMessage] = useState<string | null>(null)
	const [bindProvider, setBindProvider] = useState('1password')
	const [bindPackageId, setBindPackageId] = useState('')
	const [bindDoorSecret, setBindDoorSecret] = useState('')
	const [bindConfig, setBindConfig] = useState('')
	const dangerButtonCss = getDangerPillCss({ size: 'sm' })

	function grantKey(grant: {
		provider: string
		canonicalRef: string
		packageId: string
	}) {
		return `${grant.provider}:${grant.canonicalRef}:${grant.packageId}`
	}

	const mutation = useMutation({
		mutationKey: ['secretProviders', actorKey, pageQueryOrg(currentHref)],
		mutationFn: async ({
			body,
			href,
		}: {
			body: Record<string, unknown>
			href: string
		}) => {
			const response = await fetch(apiPath, {
				method: 'POST',
				referrer: orgAccountApiReferrer(href),
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify(body),
			})
			if (response.status === 401) throw new Error('Please sign in again.')
			const result = await readJson<{ ok?: boolean; error?: string }>(response)
			if (!response.ok || !result?.ok)
				throw new Error(result?.error ?? 'Unable to update secret providers.')
		},
		onSuccess: (_result, { href }) => {
			void Promise.all(
				mutationResources.map((resource) =>
					queryClient.invalidateQueries(
						orgPageFilters(actorKey, resource, href),
					),
				),
			)
		},
	})
	const status = mutation.isPending
		? 'saving'
		: mutation.isError
			? 'error'
			: 'idle'
	async function submit(body: Record<string, unknown>, successHref: string) {
		if (mutation.isPending) return
		setMessage(null)
		try {
			await mutation.mutateAsync({ body, href: currentHref })
			setRevokeArmed(null)
			if (router.state.location.href === currentHref)
				await router.navigate({ to: successHref })
		} catch (error) {
			setMessage(
				error instanceof Error
					? error.message
					: 'Unable to update secret providers.',
			)
		}
	}

	const disabled = status === 'saving'

	const approval = payload.approval
	return (
		<AccountManagementShell busy={status === 'saving'}>
			<AccountPageHeader
				title="Secret providers"
				description="Bind a saved package to a provider id such as 1password, and grant other packages use of canonical item refs. Values never appear here."
				currentHref={currentHref}
			/>
			{message ? (
				<AccountManagementMessage tone={status === 'error' ? 'error' : 'info'}>
					{message}
				</AccountManagementMessage>
			) : null}
			{approval ? (
				<section
					css={{
						...getAccentCalloutCss(),
						display: 'grid',
						gap: spacing.sm,
						padding: spacing.lg,
					}}
				>
					<h2
						css={{
							margin: 0,
							fontSize: typography.fontSize.lg,
							color: colors.text,
						}}
					>
						{approval.alreadyGranted
							? 'Package already granted'
							: 'Allow package access'}
					</h2>
					<p css={pageDescriptionCss}>
						Provider <strong>{approval.provider}</strong>, ref{' '}
						<code>{approval.canonicalRef}</code>, package{' '}
						<strong>{approval.kodyId}</strong>.
					</p>
					{approval.error ? (
						<p css={{ margin: 0, color: colors.error }}>{approval.error}</p>
					) : null}
					{approval.error ? null : approval.alreadyGranted ? (
						<button
							type="button"
							disabled={disabled}
							css={dangerButtonCss}
							onBlur={() => setRevokeArmed(null)}
							onClick={() => {
								if (revokeArmed !== grantKey(approval)) {
									setRevokeArmed(grantKey(approval))
									return
								}
								void submit(
									{
										action: 'revoke',
										provider: approval.provider,
										ref: approval.canonicalRef,
										packageId: approval.packageId,
									},
									relocateAccountHref('/account/secret-providers', currentHref),
								)
							}}
						>
							{revokeArmed === grantKey(approval) ? 'Revoke now' : 'Revoke'}
						</button>
					) : (
						<button
							type="button"
							disabled={disabled}
							onClick={() => {
								void submit(
									{
										action: 'grant',
										provider: approval.provider,
										ref: approval.canonicalRef,
										packageId: approval.packageId,
									},
									relocateAccountHref('/account/secret-providers', currentHref),
								)
							}}
							css={getPrimaryButtonCss()}
						>
							Allow
						</button>
					)}
				</section>
			) : null}
			<AccountManagementPanel title="Bindings">
				{payload.bindings.length === 0 ? (
					<p css={pageDescriptionCss}>No providers are bound yet.</p>
				) : (
					<ul
						css={{
							listStyle: 'none',
							margin: 0,
							padding: 0,
							display: 'grid',
							gap: spacing.md,
						}}
					>
						{payload.bindings.map((binding) => (
							<li
								key={binding.provider}
								css={{
									display: 'grid',
									gap: spacing.xs,
								}}
							>
								<strong css={{ color: colors.text }}>{binding.provider}</strong>
								<p css={pageDescriptionCss}>
									Package {binding.kodyId}. Door key {binding.doorSecretName}.
								</p>
								<button
									type="button"
									disabled={disabled}
									onClick={() => {
										void submit(
											{
												action: 'unbind',
												provider: binding.provider,
											},
											relocateAccountHref(
												'/account/secret-providers',
												currentHref,
											),
										)
									}}
									css={getSecondaryButtonCss()}
								>
									Unbind
								</button>
							</li>
						))}
					</ul>
				)}
			</AccountManagementPanel>
			<AccountManagementPanel title="Package grants">
				{payload.grants.length === 0 ? (
					<p css={pageDescriptionCss}>
						No package grants yet. Allow a package from an approval link.
					</p>
				) : (
					<ul
						css={{
							listStyle: 'none',
							margin: 0,
							padding: 0,
							display: 'grid',
							gap: spacing.md,
						}}
					>
						{payload.grants.map((grant) => (
							<li
								key={grantKey(grant)}
								css={{
									display: 'grid',
									gap: spacing.xs,
								}}
							>
								<strong css={{ color: colors.text }}>{grant.provider}</strong>
								<p css={pageDescriptionCss}>
									<code>{grant.canonicalRef}</code> · package {grant.kodyId}
								</p>
								<button
									type="button"
									disabled={disabled}
									css={dangerButtonCss}
									onBlur={() => setRevokeArmed(null)}
									onClick={() => {
										if (revokeArmed !== grantKey(grant)) {
											setRevokeArmed(grantKey(grant))
											return
										}
										void submit(
											{
												action: 'revoke',
												provider: grant.provider,
												ref: grant.canonicalRef,
												packageId: grant.packageId,
											},
											relocateAccountHref(
												'/account/secret-providers',
												currentHref,
											),
										)
									}}
								>
									{revokeArmed === grantKey(grant) ? 'Revoke now' : 'Revoke'}
								</button>
							</li>
						))}
					</ul>
				)}
			</AccountManagementPanel>
			<AccountManagementPanel title="Bind a provider">
				<label css={fieldCss}>
					<span css={fieldLabelCss}>Provider id</span>
					<input
						onInput={(event) => {
							setBindProvider(event.currentTarget.value)
						}}
						css={accountInputCss}
						value={bindProvider}
						disabled={disabled}
					/>
				</label>
				<label css={fieldCss}>
					<span css={fieldLabelCss}>Package</span>
					<select
						onChange={(event) => {
							setBindPackageId(event.currentTarget.value)
						}}
						css={accountInputCss}
						value={bindPackageId}
						disabled={disabled}
					>
						<option value="">Select a package</option>
						{payload.packages.map((savedPackage) => (
							<option key={savedPackage.id} value={savedPackage.id}>
								{savedPackage.kodyId}
							</option>
						))}
					</select>
				</label>
				<label css={fieldCss}>
					<span css={fieldLabelCss}>Door-key secret</span>
					<select
						onChange={(event) => {
							setBindDoorSecret(event.currentTarget.value)
						}}
						css={accountInputCss}
						value={bindDoorSecret}
						disabled={disabled}
					>
						<option value="">Select a user secret</option>
						{payload.doorSecrets.map((name) => (
							<option key={name} value={name}>
								{name}
							</option>
						))}
					</select>
				</label>
				<label css={fieldCss}>
					<span css={fieldLabelCss}>
						Optional config JSON (non-secret, for example a Connect base URL)
					</span>
					<input
						onInput={(event) => {
							setBindConfig(event.currentTarget.value)
						}}
						css={accountInputCss}
						value={bindConfig}
						disabled={disabled}
					/>
				</label>
				<button
					type="button"
					disabled={disabled}
					onClick={() => {
						let config: Record<string, string> = {}
						if (bindConfig.trim()) {
							try {
								const parsed: unknown = JSON.parse(bindConfig)
								if (
									!parsed ||
									typeof parsed !== 'object' ||
									Array.isArray(parsed)
								) {
									throw new Error('Config must be a JSON object.')
								}
								for (const [key, value] of Object.entries(parsed)) {
									if (typeof value === 'string') config[key] = value
								}
							} catch (error) {
								setMessage(
									error instanceof Error
										? error.message
										: 'Config must be a JSON object of strings.',
								)
								return
							}
						}
						void submit(
							{
								action: 'bind',
								provider: bindProvider,
								packageId: bindPackageId,
								doorSecretName: bindDoorSecret,
								config,
							},
							relocateAccountHref('/account/secret-providers', currentHref),
						)
					}}
					css={getPrimaryButtonCss()}
				>
					Bind provider
				</button>
			</AccountManagementPanel>
		</AccountManagementShell>
	)
}

const mutationResources = [
	'loadSecretProvidersPage',
	'loadSecretsPage',
] as const
