/** @jsxImportSource @emotion/react */
import { useSubmitterScope } from '../use-submitter-scope.ts'
import { usePageInvalidation } from '../page-invalidation.ts'
import { useEffect, useMemo, useRef, useState } from 'react'
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
	const capture = useSubmitterScope()
	const mounted = useRef(true)
	const busy = useRef(new Set<string>())
	useEffect(() => {
		mounted.current = true
		return () => {
			mounted.current = false
		}
	}, [])
	const [installBusy, setInstallBusy] = useState(false)
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
	async function install() {
		if (!listing || busy.current.has('install') || installOutcome) return
		if (!confirmed) {
			setConfirmed(true)
			return
		}
		setConfirmed(false)
		busy.current.add('install')
		setInstallBusy(true)
		setInstallMessage(null)
		try {
			const result = await post<CommunityInstallApiPayload>(
				routes.communityInstallApiPost.href({ listingId: listing.id }),
				{ acknowledged: true },
			)
			if (!result.status || !result.targetName || !result.agentPrompt)
				throw new Error('Unable to install this public package.')
			if (mounted.current)
				setInstallOutcome({
					status: result.status,
					targetName: result.targetName,
					agentPrompt: result.agentPrompt,
					packageId:
						result.status === 'installed' ? (result.packageId ?? null) : null,
					failedChecks: result.failedChecks ?? [],
				})
			await invalidatePages()
		} catch (error) {
			if (mounted.current)
				setInstallMessage(
					error instanceof Error
						? error.message
						: 'Unable to install this public package.',
				)
		} finally {
			busy.current.delete('install')
			if (mounted.current) setInstallBusy(false)
		}
	}
	async function feature() {
		if (!listing || busy.current.has('feature')) return
		busy.current.add('feature')
		setFeatureState('submitting')
		setFeatureMessage(null)
		try {
			await post(
				routes.communityFeatureApiPost.href({ listingId: listing.id }),
				{ featured: !listing.featured },
			)
			await invalidatePages()
			if (mounted.current) setFeatureState('idle')
		} catch (error) {
			if (mounted.current) {
				setFeatureState('error')
				setFeatureMessage(
					error instanceof Error
						? error.message
						: 'Unable to update featured status.',
				)
			}
		} finally {
			busy.current.delete('feature')
		}
	}
	async function report() {
		if (!listingId || busy.current.has('report')) return
		busy.current.add('report')
		setReportState('submitting')
		setReportMessage(null)
		try {
			await post(routes.communityReportApiPost.href({ listingId }), {
				reason: reportReason,
			})
			if (mounted.current) {
				setReportState('success')
				setReportMessage('Report submitted. Thank you.')
				setReportReason('')
			}
		} catch (error) {
			if (mounted.current) {
				setReportState('error')
				setReportMessage(
					error instanceof Error ? error.message : 'Unable to submit report.',
				)
			}
		} finally {
			busy.current.delete('report')
		}
	}
	return (
		<PackageInstallContext.Provider
			value={{
				busy: installBusy,
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
