/** @jsxImportSource @emotion/react */
import { usePageInvalidation } from '../page-invalidation.ts'
import {
	useEffect,
	useEffectEvent,
	useRef,
	useState,
	type FormEvent,
} from 'react'
import { useRouteContext } from '@tanstack/react-router'
import {
	useMutation,
	useQueryClient,
	useIsMutating,
} from '@tanstack/react-query'
import {
	pageResourceKey,
	snapshotPageResource,
	restorePageResource,
} from '../page-mutation-cache.ts'
import { type loadAccountPage } from '#start/server/account-page'
import { type loadProfile } from '#start/server/public-data'
import { SiteLink } from '../components/site-link.tsx'
import { listenForAvatarFileDrop } from '#client/listen-for-avatar-file-drop.ts'
import { AccountAvatarEditor } from './account-avatar-editor.tsx'
import {
	type AccountProfileLoaderData,
	type ProfileVisibility,
} from '#universal/loader-data.ts'
import { acceptedEmailVerificationDelivery } from '#universal/email-verification-delivery.ts'
import { routes } from '#universal/routes.ts'
import {
	colors,
	radius,
	spacing,
	typography,
} from '#universal/styles/tokens.ts'
import {
	getGhostButtonCss,
	mutedLinkCss,
} from '#universal/styles/style-primitives.ts'
import { toast } from '#client/toast.ts'
import {
	interpretAccountProfileSave,
	readProfileFormValues,
} from '#client/routes/account-profile-save.ts'
import {
	accountProfileApiPath,
	readJson,
} from '#client/routes/account-approval-shared.ts'
import { type AccountPagePayloads } from '#client/routes/account-page-data.ts'
import { AccountDeletePanel } from './account-delete-panel.tsx'
import { renderAccountLogoutPanel } from './account-logout-panel.tsx'
import {
	AccountManagementMessage,
	AccountManagementPanel,
	AccountManagementShell,
	AccountPageHeader,
	accountActionsCss,
} from './account-management-components.tsx'
import { useAccountEmailClaims } from './account-email-claims.ts'
import { AccountFormerEmailsPanel } from './account-former-emails-panel.tsx'
import { AccountProfilePanel } from './account-profile-panel.tsx'
import { AccountPasswordPanel } from './account-password-panel.tsx'
import { useAccountConnections } from './account-connections-panel.tsx'
import { renderOnboardingBanner } from './onboarding-banner.tsx'
import { shouldShowOnboardingChecklist } from '#client/routes/onboarding-checklist.tsx'
import {
	renderEmailVerificationPrompt,
	requestResendVerification,
} from './email-verification-prompt.tsx'

const accountAvatarApiPath = '/account/profile/avatar.json'

export function AccountPage({
	payloads,
	currentHref,
}: {
	payloads: AccountPagePayloads
	currentHref: string
}) {
	const invalidatePages = usePageInvalidation(mutationResources, {
		refreshShell: true,
		refreshRoute: true,
	})
	const initial = payloads.accountProfile
	const [resendStatus, setResendStatus] = useState<'idle' | 'sending'>('idle')
	const [resendMessage, setResendMessage] = useState<string | null>(null)
	const [resendTone, setResendTone] = useState<'error' | 'info'>('info')
	const { email, emailVerified, username } = initial
	const emailVerificationDelivery = initial.emailVerificationDelivery ?? null
	const savedDisplayName = initial.displayName
	const savedBio = initial.bio ?? ''
	const savedProfileVisibility = initial.profileVisibility
	const [displayNameEdit, setDraftDisplayName] = useState<string>()
	const [bioEdit, setDraftBio] = useState<string>()
	const [visibilityEdit, setDraftProfileVisibility] =
		useState<ProfileVisibility>()
	const draftDisplayName = displayNameEdit ?? savedDisplayName
	const draftBio = bioEdit ?? savedBio
	const draftProfileVisibility = visibilityEdit ?? savedProfileVisibility
	const [avatarPreview, setAvatarPreview] = useState<string | null>()
	const avatarUrl =
		avatarPreview === undefined ? initial.avatarUrl : avatarPreview
	const [avatarStatus, setAvatarStatus] = useState<
		'idle' | 'editing' | 'uploading' | 'removing'
	>('idle')
	const [editorFile, setEditorFile] = useState<File | null>(null)
	const [avatarDropActive, setAvatarDropActive] = useState(false)
	const [message, setMessage] = useState<string | null>(null)
	const [messageTone, setMessageTone] = useState<'error' | 'info'>('info')
	const optimisticAvatar = useRef<string | null>(null)
	const accountConnections = useAccountConnections(
		payloads.accountConnections,
		currentHref,
	)
	const accountEmailClaims = useAccountEmailClaims(
		initial.email,
		initial.formerEmails ?? [],
	)
	const needsOnboarding = payloads.onboarding?.needsOnboarding === true
	const onboardingChecklist = payloads.onboarding?.checklist ?? null

	function publishProfile(profile: AccountProfileLoaderData) {
		queryClient.setQueriesData<AccountQueryData>(
			{ queryKey: pageResourceKey(actorKey, 'loadAccountPage') },
			(data) =>
				data && {
					...data,
					payloads: { ...data.payloads, accountProfile: profile },
				},
		)
	}

	function releaseOptimisticAvatar() {
		if (!optimisticAvatar.current) return
		URL.revokeObjectURL(optimisticAvatar.current)
		optimisticAvatar.current = null
	}

	function openAvatarEditor(file: File) {
		if (avatarStatus !== 'idle' && avatarStatus !== 'editing') return
		setEditorFile(file)
		setAvatarStatus('editing')
		setMessage(null)
		setMessageTone('info')
	}

	const onDroppedFile = useEffectEvent((file: File) => openAvatarEditor(file))
	useEffect(() => {
		const controller = new AbortController()
		listenForAvatarFileDrop({
			signal: controller.signal,
			onDragActiveChange: setAvatarDropActive,
			onImageFile: onDroppedFile,
		})
		return () => {
			controller.abort()
			if (optimisticAvatar.current)
				URL.revokeObjectURL(optimisticAvatar.current)
		}
	}, [])

	function closeAvatarEditor() {
		setEditorFile(null)
		if (avatarStatus === 'editing') setAvatarStatus('idle')
	}

	function setAvatarEditorBusy(busy: boolean) {
		if (busy) {
			setAvatarStatus('uploading')
		} else if (editorFile) {
			setAvatarStatus('editing')
		}
	}

	async function uploadPreparedAvatar(prepared: File) {
		setEditorFile(null)
		releaseOptimisticAvatar()
		optimisticAvatar.current = URL.createObjectURL(prepared)
		setAvatarPreview(optimisticAvatar.current)
		setAvatarStatus('uploading')

		try {
			const body = new FormData()
			body.set('avatar', prepared)
			const response = await fetch(accountAvatarApiPath, {
				method: 'POST',
				headers: { Accept: 'application/json' },
				credentials: 'include',
				body,
			})
			if (response.status === 401) {
				window.location.assign('/login')
				return
			}
			const payload = await readJson<
				AccountProfileLoaderData & { error?: string }
			>(response)
			if (!response.ok || !payload?.ok) {
				throw new Error(payload?.error || 'Unable to upload avatar.')
			}
			releaseOptimisticAvatar()
			publishProfile(payload)
			setAvatarPreview(undefined)
			void invalidatePages()
			toast.success('Avatar updated.')
		} catch (error) {
			releaseOptimisticAvatar()
			setAvatarPreview(undefined)
			toast.error(
				error instanceof Error ? error.message : 'Unable to upload avatar.',
			)
		} finally {
			setAvatarStatus('idle')
		}
	}

	function handleAvatarSelected(event: FormEvent<HTMLElement>) {
		const input = event.currentTarget
		if (!(input instanceof HTMLInputElement) || !input.files?.[0]) return
		try {
			openAvatarEditor(input.files[0])
		} finally {
			input.value = ''
		}
	}

	async function handleRemoveAvatar() {
		releaseOptimisticAvatar()
		setAvatarPreview(null)
		setAvatarStatus('removing')

		try {
			const response = await fetch(accountAvatarApiPath, {
				method: 'POST',
				headers: {
					Accept: 'application/json',
					'Content-Type': 'application/json',
				},
				credentials: 'include',
				body: JSON.stringify({ remove: true }),
			})
			if (response.status === 401) {
				window.location.assign('/login')
				return
			}
			const payload = await readJson<
				AccountProfileLoaderData & { error?: string }
			>(response)
			if (!response.ok || !payload?.ok) {
				throw new Error(payload?.error || 'Unable to remove avatar.')
			}
			publishProfile(payload)
			setAvatarPreview(undefined)
			void invalidatePages()
			toast.success('Avatar removed.')
		} catch (error) {
			setAvatarPreview(undefined)
			toast.error(
				error instanceof Error ? error.message : 'Unable to remove avatar.',
			)
		} finally {
			setAvatarStatus('idle')
		}
	}

	async function handleResendVerification() {
		setResendStatus('sending')
		setResendMessage(null)
		setResendTone('info')

		try {
			const result = await requestResendVerification()
			if (result.ok) void invalidatePages()
			if (!result.ok && result.unauthorized) {
				window.location.assign('/login')
				return
			}
			setResendTone(result.ok ? 'info' : 'error')
			setResendMessage(result.message)
			if (result.ok) {
				queryClient.setQueriesData<AccountQueryData>(
					{ queryKey: pageResourceKey(actorKey, 'loadAccountPage') },
					(data) =>
						data && {
							...data,
							payloads: {
								...data.payloads,
								accountProfile: {
									...data.payloads.accountProfile,
									emailVerificationDelivery:
										acceptedEmailVerificationDelivery(),
								},
							},
						},
				)
			}
		} catch {
			setResendTone('error')
			setResendMessage('Unable to send the verification email.')
		} finally {
			setResendStatus('idle')
		}
	}

	const queryClient = useQueryClient()
	const { actorKey } = useRouteContext({ from: '__root__' })
	const isSaving = useIsMutating({ mutationKey: ['profile', actorKey] }) > 0
	type AccountQueryData = Awaited<ReturnType<typeof loadAccountPage>>
	type PublicProfileQueryData = Awaited<ReturnType<typeof loadProfile>>
	const ownProfileKey = [
		...pageResourceKey(actorKey, 'loadProfile'),
		{ username },
	]
	const invalidateProfileDependents = usePageInvalidation(
		profileMutationResources,
		{ refreshShell: true },
	)

	type ProfileResult = AccountProfileLoaderData & {
		error?: string
		packagesUpdated?: number
		communityListingsRepublished?: number
		packageUpdateMessage?: string
		communityUpdateWarning?: string
	}
	const profileMutation = useMutation({
		mutationKey: ['profile', actorKey],
		mutationFn: async (input: {
			displayName: string
			bio: string
			profileVisibility: ProfileVisibility
		}) => {
			const response = await fetch(accountProfileApiPath, {
				method: 'POST',
				headers: {
					Accept: 'application/json',
					'Content-Type': 'application/json',
				},
				credentials: 'include',
				body: JSON.stringify(input),
			})
			if (response.status === 401) window.location.assign('/login')
			const result = await readJson<ProfileResult>(response)
			if (!response.ok || !result || result.error)
				throw new Error(result?.error || 'Unable to save profile.')
			return result
		},
		onMutate: async (input) => {
			const account = await snapshotPageResource<AccountQueryData>(
				queryClient,
				actorKey,
				'loadAccountPage',
				(data) => ({
					...data,
					payloads: {
						...data.payloads,
						accountProfile: {
							...data.payloads.accountProfile,
							displayName: input.displayName,
							bio: input.bio,
						},
					},
				}),
			)
			const publicProfile = await snapshotPageResource<PublicProfileQueryData>(
				queryClient,
				actorKey,
				'loadProfile',
				(data) =>
					data.data?.isSelf
						? {
								...data,
								data: {
									...data.data,
									profile: {
										...data.data.profile,
										displayName: input.displayName,
										bio: input.bio,
									},
								},
							}
						: data,
				[{ username }],
			)
			return { account, publicProfile }
		},
		onError: async (error, _input, snapshot) => {
			// onMutate retired older reads. New reads wait for this mutation,
			// including uncached navigations which must survive a rejected write.
			restorePageResource(queryClient, snapshot?.account)
			restorePageResource(queryClient, snapshot?.publicProfile)
			void queryClient.invalidateQueries({ queryKey: ownProfileKey })
			void queryClient.invalidateQueries({
				queryKey: pageResourceKey(actorKey, 'loadAccountPage'),
			})
			// A failed save still needs feedback after navigating away from the form.
			toast.error(
				error instanceof Error ? error.message : 'Unable to save profile.',
			)
		},
		onSuccess: async (profile) => {
			publishProfile(profile)
			queryClient.setQueriesData<PublicProfileQueryData>(
				{ queryKey: ownProfileKey },
				(data) =>
					data && data.data?.isSelf
						? {
								...data,
								data: {
									...data.data,
									profile: {
										...data.data.profile,
										displayName: profile.displayName,
										bio: profile.bio,
									},
								},
							}
						: data,
			)
			// Cache work belongs to the mutation and survives a page unmount.
			void invalidateProfileDependents()
		},
	})

	function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		if (queryClient.isMutating({ mutationKey: ['profile', actorKey] })) return
		const submitted = readProfileFormValues(event.currentTarget, {
			displayName: draftDisplayName,
			bio: draftBio,
			profileVisibility: draftProfileVisibility,
		})
		setDraftDisplayName(submitted.displayName)
		setDraftBio(submitted.bio)
		setDraftProfileVisibility(submitted.profileVisibility)
		const profileFieldsChanged =
			submitted.displayName !== savedDisplayName ||
			submitted.bio !== savedBio ||
			submitted.profileVisibility !== savedProfileVisibility
		setMessage(null)
		setMessageTone('info')
		profileMutation.mutate(submitted, {
			onSuccess: (payload) => {
				const result = interpretAccountProfileSave({
					profileFieldsChanged,
					responseOk: true,
					payload,
				})
				if (result.status === 'saved') {
					setDraftDisplayName((edit) =>
						edit === submitted.displayName ? undefined : edit,
					)
					setDraftBio((edit) => (edit === submitted.bio ? undefined : edit))
					setDraftProfileVisibility((edit) =>
						edit === submitted.profileVisibility ? undefined : edit,
					)
					setMessage(result.message)
				} else if (result.status === 'error') {
					setMessage(result.message)
					setMessageTone('error')
				}
			},
			onError: (error) => {
				setMessage(
					error instanceof Error ? error.message : 'Unable to save profile.',
				)
				setMessageTone('error')
			},
		})
	}

	const view =
		new URL(currentHref, 'https://kody.local').pathname === '/account/security'
			? 'security'
			: new URL(currentHref, 'https://kody.local').pathname === '/account/data'
				? 'data'
				: 'profile'

	const emailClaims = accountEmailClaims.snapshot
	const isSendingEmailChange = emailClaims.emailChangeStatus === 'sending'
	const normalizedDraftEmail = emailClaims.draftEmail.trim().toLowerCase()
	const profileUnchanged =
		draftDisplayName === savedDisplayName &&
		draftBio === savedBio &&
		draftProfileVisibility === savedProfileVisibility

	return (
		<AccountManagementShell busy={false}>
			<AccountPageHeader
				title={
					view === 'profile'
						? 'Profile'
						: view === 'security'
							? 'Security'
							: 'Data & deletion'
				}
				description={
					view === 'profile'
						? 'How you appear across Kody, and the email you sign in with.'
						: view === 'security'
							? 'Your password, second sign-in step, the accounts you can sign in with, and emails you used before.'
							: 'Take a copy of your account data, or delete the account.'
				}
				currentHref={currentHref}
			/>

			{message ? (
				<AccountManagementMessage tone={messageTone}>
					{message}
				</AccountManagementMessage>
			) : null}

			{view === 'profile' ? (
				<>
					{!emailVerified
						? renderEmailVerificationPrompt({
								description:
									'Check your inbox for the verification link. MCP access and email features stay locked until this account email is verified.',
								delivery: emailVerificationDelivery,
								resendStatus,
								resendMessage,
								resendTone,
								onResend: () => {
									void handleResendVerification()
								},
								secondaryHref: '/pending-verification',
								secondaryLabel: 'Verification page',
							})
						: null}
					{emailVerified &&
					(needsOnboarding ||
						shouldShowOnboardingChecklist(onboardingChecklist))
						? renderOnboardingBanner({ checklist: onboardingChecklist })
						: null}
					<AccountProfilePanel
						{...{
							email,
							emailVerified,
							username,
							draftDisplayName,
							draftBio,
							draftProfileVisibility,
							draftEmail: emailClaims.draftEmail,
							emailChangePassword: emailClaims.emailChangePassword,
							avatarUrl,
							avatarStatus,
							isSaving,
							isSendingEmailChange,
							profileUnchanged,
							normalizedDraftEmail,
							emailChangeMessage: emailClaims.emailChangeMessage,
							emailChangeTone: emailClaims.emailChangeTone,
							emailChangeOpen: emailClaims.emailChangeOpen,
							onProfileSubmit: handleProfileSubmit,
							onEmailChangeSubmit: (event) => {
								void accountEmailClaims.handleEmailChangeSubmit(event, email)
							},
							onAvatarSelected: handleAvatarSelected,
							onRemoveAvatar: () => void handleRemoveAvatar(),
							onDraftDisplayNameChange: (value) => {
								setDraftDisplayName(value)
							},
							onDraftBioChange: (value) => {
								setDraftBio(value)
							},
							onDraftProfileVisibilityChange: (value) => {
								setDraftProfileVisibility(value)
							},
							onDraftEmailInput: accountEmailClaims.updateDraftEmail,
							onEmailChangeToggle: accountEmailClaims.handleEmailChangeToggle,
							onEmailChangePasswordInput:
								accountEmailClaims.updateEmailChangePassword,
						}}
					/>
				</>
			) : null}
			{view === 'security' ? (
				<>
					{emailVerified
						? AccountFormerEmailsPanel({
								formerEmails: emailClaims.formerEmails,
								releaseEmail: emailClaims.releaseEmail,
								releasePassword: emailClaims.releasePassword,
								releaseStatus: emailClaims.releaseStatus,
								releaseMessage: emailClaims.releaseMessage,
								releaseTone: emailClaims.releaseTone,
								onReleaseEmailInput: accountEmailClaims.updateReleaseEmail,
								onReleasePasswordInput:
									accountEmailClaims.updateReleasePassword,
								onReleaseSubmit:
									accountEmailClaims.handleFormerEmailReleaseSubmit,
								onUseAgainAsLogin: accountEmailClaims.useFormerEmailAsLogin,
								onReleaseListed: (listedEmail) => {
									void accountEmailClaims.requestFormerEmailRelease(listedEmail)
								},
							})
						: null}
					<AccountPasswordPanel
						hasUsablePassword={accountConnections.hasUsablePassword}
						onPasswordSet={() => {
							accountConnections.markHasUsablePassword()
						}}
					/>
					{accountConnections.render()}
				</>
			) : null}
			{view === 'data' ? (
				<>
					<AccountManagementPanel
						title="Your data"
						description="Download a portable JSON export of your Kody account data for backup or migration. Secret values are never included; secret entries export metadata such as names, hosts, and allowlists only."
					>
						<div>
							<SiteLink
								href="/account/export.json"
								download="kody-account-export.json"
								css={compactGhostButtonCss}
							>
								Download account export
							</SiteLink>
						</div>
					</AccountManagementPanel>
					<AccountManagementPanel
						title="Delete account"
						description="Permanently delete this Kody account and every isolated store attached to it. This cannot be undone."
					>
						<AccountDeletePanel
							hasUsablePassword={accountConnections.hasUsablePassword}
						/>
					</AccountManagementPanel>
				</>
			) : null}

			{renderAccountLogoutPanel()}

			{editorFile ? (
				<AccountAvatarEditor
					file={editorFile}
					onCancel={closeAvatarEditor}
					onBusyChange={setAvatarEditorBusy}
					onApply={(prepared) => {
						void uploadPreparedAvatar(prepared)
					}}
				/>
			) : null}
			{avatarDropActive ? (
				<div
					role="status"
					data-testid="account-avatar-drop-overlay"
					css={{
						position: 'fixed',
						inset: 0,
						zIndex: 2000,
						display: 'grid',
						placeItems: 'center',
						backgroundColor:
							'color-mix(in srgb, var(--color-background) 72%, transparent)',
						pointerEvents: 'none',
					}}
				>
					<p
						css={{
							margin: 0,
							padding: `${spacing.md} ${spacing.lg}`,
							border: `2px dashed ${colors.primary}`,
							borderRadius: radius.lg,
							backgroundColor: colors.surface,
							color: colors.text,
							fontWeight: typography.fontWeight.semibold,
						}}
					>
						Drop to set your avatar
					</p>
				</div>
			) : null}
			<p css={{ margin: 0 }}>
				<SiteLink href="/privacy" css={mutedLinkCss}>
					Privacy
				</SiteLink>
				{' · '}
				<SiteLink href="/terms" css={mutedLinkCss}>
					Terms
				</SiteLink>
			</p>
		</AccountManagementShell>
	)
}

const compactGhostButtonCss = getGhostButtonCss({ size: 'sm' })

const mutationResources = [
	'loadAccountPage',
	'loadProfile',
	'loadCommunity',
	'loadPackage',
] as const

const profileMutationResources = [
	'loadProfile',
	'loadCommunity',
	'loadPackage',
] as const
