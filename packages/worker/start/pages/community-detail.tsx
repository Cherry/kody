/** @jsxImportSource @emotion/react */
import { useSubmitterScope } from '../use-submitter-scope.ts'
import { usePageInvalidation } from '../page-invalidation.ts'
import { useEffect, useMemo, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import {
	type CommunityDetailApiPayload,
	type CommunityInstallApiPayload,
	type CommunityInstallOutcome,
} from '../community-types.ts'
import { routes } from '#universal/routes.ts'
import { getPackageTreeHref } from '#universal/package-files.ts'
import {
	type CommunityDetailContentProps,
	CommunityDetailContent,
} from '../components/community-detail-content.tsx'
import { PackageInstallContext } from '../components/package-title-actions.tsx'
import { renderMarkdownNodes } from '../components/markdown-view.tsx'
import {
	detailArticleCss,
	renderInstallStrip,
	renderReadmeSection,
	renderEmptyReadme,
	renderAdminFeatureSection as AdminFeatureSection,
	renderReportDisclosure as ReportDisclosure,
} from '../components/community-detail-sections.tsx'

export function CommunityDetailRoute({
	data,
	header,
}: {
	data: CommunityDetailApiPayload
	header: CommunityDetailContentProps
}) {
	const invalidatePages = usePageInvalidation(mutationResources, {
		refreshRoute: true,
	})
	const invalidateReports = usePageInvalidation(reportResources)
	const capture = useSubmitterScope()
	const [confirmed, setConfirmed] = useState(false)
	useEffect(() => {
		if (!confirmed) return
		const disarm = (event: MouseEvent) => {
			if (
				event.target instanceof Element &&
				!event.target.closest('[data-community-install]')
			)
				setConfirmed(false)
		}
		document.addEventListener('click', disarm)
		return () => document.removeEventListener('click', disarm)
	}, [confirmed])
	const [installMessage, setInstallMessage] = useState<string | null>(null)
	const [installOutcome, setInstallOutcome] =
		useState<CommunityInstallOutcome | null>(null)
	const [featureState, setFeatureState] = useState<
		'idle' | 'submitting' | 'error'
	>('idle')
	const [featureMessage, setFeatureMessage] = useState<string | null>(null)
	const [reportReason, setReportReason] = useState('')
	const [reportState, setReportState] = useState<
		'idle' | 'submitting' | 'success' | 'error'
	>('idle')
	const [reportMessage, setReportMessage] = useState<string | null>(null)
	const listing = data.listing
	const listingId = listing?.id
	const readme = useMemo(
		() =>
			renderMarkdownNodes(data.readmeContent ?? '', {
				headingOffset: 1,
				fences: data.readmeFences,
				imageBaseHref: data.imageBaseHref ?? undefined,
			}),
		[data.readmeContent, data.readmeFences, data.imageBaseHref],
	)
	const agentsDocsHref = data.hasAgentsDocs
		? getPackageTreeHref({
				username: data.username,
				kodyId: data.kodyId,
				listingId: listingId ?? undefined,
				relativePath: 'AGENTS.md',
			})
		: null
	async function post<T extends { ok: boolean; error?: string }>(
		href: string,
		payload: unknown,
	): Promise<T> {
		const isCurrent = capture()
		const response = await fetch(href, {
			method: 'POST',
			credentials: 'include',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(payload),
		})
		if (response.status === 401) {
			if (isCurrent()) window.location.assign('/login')
			throw new Error('Please log in.')
		}
		const result = (await response.json()) as T
		if (!response.ok || !result.ok)
			throw new Error(result.error ?? 'Unable to complete this action.')
		return result
	}
	// Capture reconciliation when submitted, so a later navigation cannot move
	// the write's cache work to another actor or organization. A lost response
	// still requires reconciliation because the server may have committed it.
	const lifecycle = {
		gcTime: 0,
		onMutate: () => ({ reconcile: invalidatePages }),
		onSettled: (
			_data: unknown,
			_error: Error | null,
			_variables: unknown,
			context: { reconcile: () => Promise<void> } | undefined,
		) => context?.reconcile(),
	}
	const installMutation = useMutation({
		...lifecycle,
		mutationFn: (id: string) =>
			post<CommunityInstallApiPayload>(
				routes.communityInstallApiPost.href({ listingId: id }),
				{ acknowledged: true },
			),
	})
	const featureMutation = useMutation({
		...lifecycle,
		mutationFn: (input: { id: string; featured: boolean }) =>
			post(routes.communityFeatureApiPost.href({ listingId: input.id }), {
				featured: input.featured,
			}),
	})
	const reportMutation = useMutation({
		...lifecycle,
		onMutate: () => ({ reconcile: invalidateReports }),
		mutationFn: (input: { id: string; reason: string }) =>
			post(routes.communityReportApiPost.href({ listingId: input.id }), {
				reason: input.reason,
			}),
	})
	async function install() {
		if (!listing || installMutation.isPending || installOutcome) return
		if (!confirmed) {
			setConfirmed(true)
			return
		}
		const isCurrent = capture()
		setConfirmed(false)
		setInstallMessage(null)
		try {
			const result = await installMutation.mutateAsync(listing.id)
			if (!isCurrent()) return
			if (!result.status || !result.targetName || !result.agentPrompt)
				throw new Error('Unable to install this public package.')
			setInstallOutcome({
				status: result.status,
				targetName: result.targetName,
				agentPrompt: result.agentPrompt,
				packageId:
					result.status === 'installed' ? (result.packageId ?? null) : null,
				failedChecks: result.failedChecks ?? [],
			})
		} catch (error) {
			if (isCurrent())
				setInstallMessage(
					error instanceof Error
						? error.message
						: 'Unable to install this public package.',
				)
		}
	}
	async function feature() {
		if (!listing || featureMutation.isPending) return
		const isCurrent = capture()
		setFeatureState('submitting')
		setFeatureMessage(null)
		try {
			await featureMutation.mutateAsync({
				id: listing.id,
				featured: !listing.featured,
			})
			if (isCurrent()) setFeatureState('idle')
		} catch (error) {
			if (isCurrent()) {
				setFeatureState('error')
				setFeatureMessage(
					error instanceof Error
						? error.message
						: 'Unable to update featured status.',
				)
			}
		}
	}
	async function report() {
		if (!listingId || reportMutation.isPending) return
		const isCurrent = capture()
		setReportState('submitting')
		setReportMessage(null)
		try {
			await reportMutation.mutateAsync({ id: listingId, reason: reportReason })
			if (isCurrent()) {
				setReportState('success')
				setReportMessage('Report submitted. Thank you.')
				setReportReason('')
			}
		} catch (error) {
			if (isCurrent()) {
				setReportState('error')
				setReportMessage(
					error instanceof Error ? error.message : 'Unable to submit report.',
				)
			}
		}
	}
	return (
		<PackageInstallContext.Provider
			value={{
				busy: installMutation.isPending,
				confirmed,
				onInstall: () => void install(),
				onDisarm: () => setConfirmed(false),
			}}
		>
			<article css={detailArticleCss}>
				<CommunityDetailContent {...header} />
				{listingId
					? renderInstallStrip({ installMessage, installOutcome })
					: null}
				{data.readmeContent
					? renderReadmeSection(readme, agentsDocsHref)
					: renderEmptyReadme(agentsDocsHref)}
				{listingId && data.viewerIsAdmin ? (
					<AdminFeatureSection
						{...{
							featured: listing?.featured ?? false,
							featureState,
							featureMessage,
							onToggleFeature: () => void feature(),
						}}
					/>
				) : null}
				{listingId ? (
					<ReportDisclosure
						{...{
							loggedIn: data.loggedIn,
							reportReason,
							reportState,
							reportMessage,
							onReasonInput: setReportReason,
							onSubmitReport: () => void report(),
						}}
					/>
				) : null}
			</article>
		</PackageInstallContext.Provider>
	)
}

const mutationResources = [
	'loadPackage',
	'loadPackageFiles',
	'loadCommunity',
	'loadProfile',
	'loadOnboarding',
	'loadAccountPage',
	'loadUsagePage',
] as const

const reportResources = ['loadAdminCommunityReports'] as const
