/** @jsxImportSource @emotion/react */
import { useState } from 'react'
import {
	useMutation,
	useQueryClient,
	type QueryKey,
} from '@tanstack/react-query'
import { type OrgSettingsLoaderData } from '#universal/loader-data.ts'
import { routes } from '#universal/routes.ts'
import {
	AccountManagementPanel,
	accountFieldCss,
	accountFieldLabelCss,
	accountInputCss,
} from './account-management-components.tsx'
import {
	getGhostButtonCss,
	getPillButtonCss,
} from '#universal/styles/style-primitives.ts'
import { spacing } from '#universal/styles/tokens.ts'

type DomainWrite = {
	action: 'add' | 'sync' | 'delete'
	hostname?: string
	id?: string
	binding_kind?: 'app' | 'org'
	package_id?: string
	ssl_method?: 'http' | 'txt'
}

/** The organization settings query owns server state, including mutation replies. */
export function OrgSettingsCustomDomains({
	data,
	queryKey,
}: {
	data: OrgSettingsLoaderData
	queryKey: QueryKey
}) {
	const client = useQueryClient()
	const [hostname, setHostname] = useState('')
	const [bindingKind, setBindingKind] = useState<'org' | 'app'>('org')
	const [packageId, setPackageId] = useState('')
	const [sslMethod, setSslMethod] = useState<'http' | 'txt'>('txt')
	const mutation = useMutation({
		onMutate: () => client.cancelQueries({ queryKey, exact: true }),
		mutationFn: async (body: DomainWrite) => {
			const response = await fetch(
				routes.orgSettingsCustomHostnamesPost.href({ orgSlug: data.org.slug }),
				{
					method: 'POST',
					credentials: 'include',
					headers: {
						Accept: 'application/json',
						'Content-Type': 'application/json',
					},
					body: JSON.stringify(body),
				},
			)
			const payload = (await response.json()) as OrgSettingsLoaderData & {
				error?: string
			}
			if (!response.ok || !payload.ok)
				throw new Error(payload.error || 'Unable to update custom domains.')
			return payload
		},
		onSuccess: async (payload) => {
			// A pre-mutation settings read must not replace the authoritative write reply.
			await client.cancelQueries({ queryKey, exact: true })
			client.setQueryData<OrgSettingsLoaderData>(queryKey, (previous) =>
				previous ? payload : undefined,
			)
		},
	})
	const domains = data.customDomains
	if (!domains) return null
	return (
		<AccountManagementPanel title="Custom domains">
			<p>
				Point a CNAME at{' '}
				<code>{domains.dnsTarget ?? 'domains.<package-app host>'}</code>,
				publish the ownership and SSL validation records below, then sync until
				hostname and certificate are both active. TXT validation lets the
				certificate issue before traffic switches.
			</p>
			{mutation.error ? <p role="alert">{mutation.error.message}</p> : null}
			{mutation.isSuccess ? (
				<p role="status">
					{mutation.variables.action === 'add'
						? 'Custom domain registered. Publish the verification records below, then sync.'
						: mutation.variables.action === 'sync'
							? 'Custom domain status refreshed from Cloudflare.'
							: 'Custom domain removed.'}
				</p>
			) : null}
			{domains.hostnames.length ? (
				<ul
					data-testid="org-custom-hostnames"
					css={{
						display: 'grid',
						gap: spacing.lg,
						listStyle: 'none',
						padding: 0,
					}}
				>
					{domains.hostnames.map((row) => {
						const verified =
							row.hostnameStatus === 'active' && row.sslStatus === 'active'
						const records = [
							...(row.ownershipVerification ? [row.ownershipVerification] : []),
							...row.sslValidationRecords,
						]
						return (
							<li key={row.id}>
								<strong>{row.hostname}</strong>
								<p>
									{row.bindingKind === 'app' ? 'App' : 'Org'} · host{' '}
									{row.hostnameStatus} · ssl {row.sslStatus}
									{verified ? ' · verified' : ''}
								</p>
								{!verified && records.length ? (
									<ul
										data-testid={`org-custom-hostname-verification-${row.id}`}
									>
										{records.map((record) => (
											<li key={`${record.type}:${record.name}:${record.value}`}>
												<span>{record.type.toUpperCase()}</span>{' '}
												<code>{record.name}</code> <code>{record.value}</code>
											</li>
										))}
									</ul>
								) : null}
								{data.canManage ? (
									<div css={{ display: 'flex', gap: spacing.sm }}>
										<button
											type="button"
											css={getGhostButtonCss({ size: 'sm' })}
											disabled={mutation.isPending}
											onClick={() =>
												mutation.mutate({ action: 'sync', id: row.id })
											}
										>
											{mutation.isPending &&
											mutation.variables.action === 'sync' &&
											mutation.variables.id === row.id
												? 'Syncing…'
												: 'Sync'}
										</button>
										<button
											type="button"
											css={getGhostButtonCss({ size: 'sm' })}
											disabled={mutation.isPending}
											onClick={() =>
												mutation.mutate({ action: 'delete', id: row.id })
											}
										>
											{mutation.isPending &&
											mutation.variables.action === 'delete' &&
											mutation.variables.id === row.id
												? 'Removing…'
												: 'Remove'}
										</button>
									</div>
								) : null}
							</li>
						)
					})}
				</ul>
			) : (
				<p>No custom domains yet.</p>
			)}
			{data.canManage ? (
				<form
					css={{ display: 'grid', gap: spacing.md }}
					onSubmit={(event) => {
						event.preventDefault()
						if (mutation.isPending) return
						mutation.mutate(
							{
								action: 'add',
								hostname,
								binding_kind: bindingKind,
								package_id: bindingKind === 'app' ? packageId : undefined,
								ssl_method: sslMethod,
							},
							{
								onSuccess: () => {
									setHostname('')
									setPackageId('')
								},
							},
						)
					}}
				>
					<label css={accountFieldCss}>
						<span css={accountFieldLabelCss}>Hostname</span>
						<input
							css={accountInputCss}
							required
							value={hostname}
							placeholder="apps.example.com"
							onChange={(event) => setHostname(event.currentTarget.value)}
						/>
					</label>
					<label css={accountFieldCss}>
						<span css={accountFieldLabelCss}>Binding</span>
						<select
							css={accountInputCss}
							value={bindingKind}
							onChange={(event) =>
								setBindingKind(
									event.currentTarget.value === 'app' ? 'app' : 'org',
								)
							}
						>
							<option value="org">Org (private apps at /packages/…)</option>
							<option value="app">
								App (one public internet-visible app at /)
							</option>
						</select>
					</label>
					{bindingKind === 'app' ? (
						<label css={accountFieldCss}>
							<span css={accountFieldLabelCss}>Package id</span>
							<input
								css={accountInputCss}
								required
								value={packageId}
								onChange={(event) => setPackageId(event.currentTarget.value)}
							/>
						</label>
					) : null}
					<label css={accountFieldCss}>
						<span css={accountFieldLabelCss}>SSL method</span>
						<select
							css={accountInputCss}
							value={sslMethod}
							onChange={(event) =>
								setSslMethod(
									event.currentTarget.value === 'http' ? 'http' : 'txt',
								)
							}
						>
							<option value="txt">TXT (pre-validate)</option>
							<option value="http">HTTP</option>
						</select>
					</label>
					<button
						type="submit"
						css={getPillButtonCss({ size: 'sm' })}
						disabled={mutation.isPending}
					>
						{mutation.isPending && mutation.variables.action === 'add'
							? 'Adding…'
							: 'Add domain'}
					</button>
				</form>
			) : null}
		</AccountManagementPanel>
	)
}
