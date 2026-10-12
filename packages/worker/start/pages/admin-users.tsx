/** @jsxImportSource @emotion/react */
import { usePageInvalidation } from '../page-invalidation.ts'
import {
	useState,
	useRef,
	useEffect,
	useEffectEvent,
	type FormEvent,
} from 'react'
import { useRouter, useRouteContext } from '@tanstack/react-router'
import {
	createInfiniteList,
	type InfiniteListSnapshot,
} from '#client/infinite-list.ts'
import { readJson } from '#client/routes/account-approval-shared.ts'
import { colors } from '#universal/styles/tokens.ts'
import { getGhostButtonCss } from '#universal/styles/style-primitives.ts'
import { type RoleName } from '#universal/permissions.ts'
import {
	type AdminCreatedUserSetup,
	type AdminPlanName,
	type AdminUserListItem,
	type AdminUsersLoaderData,
	type AdminUsersMutationData,
	type AdminUserUsageLoaderData,
} from '#universal/loader-data.ts'
import {
	type AdminUserFilterState,
	adminUserUsageApiPath,
	buildAdminUsersApiRequestUrl,
	buildFilteredListHref,
	buildUserDetailHrefFrom,
	getListKey,
	getSelection,
	nextAdminUsersWindowAfterCreate,
	nextAdminUsersWindowAfterMutation,
	parseSelectedStableUserId,
	shouldReseedAdminUsersWindow,
	readFilterState,
} from '#client/routes/admin-users-shared.ts'
import {
	AccountManagementMessage,
	AccountManagementShell,
	AdminPageHeader,
} from './account-management-components.tsx'
import { AdminCreateUserPanel } from './admin-users-create.tsx'
import {
	RecordChips,
	RecordTable,
	RecordTableSearch,
	RecordTableSelect,
	recordCellClamp,
} from './record-table.tsx'
import {
	type AdminUsersActionState,
	AdminUserDetail,
} from './admin-users-detail.tsx'
const clampedCellCss = recordCellClamp(28)
type AccountStatus = 'loading' | 'ready' | 'error'
type UsageStatus = 'loading' | 'ready' | 'error'
export function AdminUsersPage(props: {
	payload: AdminUsersLoaderData
	currentHref: string
}) {
	const invalidatePages = usePageInvalidation(mutationResources)
	const invalidateOwnPermissions = usePageInvalidation('permissions', {
		refreshShell: true,
	})
	const { actorKey } = useRouteContext({ from: '__root__' })
	const router = useRouter()
	const replaceLocation = (href: string) =>
		void router.navigate({ href, replace: true })
	const lifetime = useRef<AbortController | null>(null)
	useEffect(() => {
		const controller = new AbortController()
		lifetime.current = controller
		return () => controller.abort()
	}, [])
	const sentinelRef = useRef<HTMLDivElement | null>(null)
	const status = 'ready' as AccountStatus
	const [availableRoles, setAvailableRoles] = useState<Array<RoleName>>(
		props.payload.availableRoles,
	)
	const [availablePlans, setAvailablePlans] = useState<Array<AdminPlanName>>(
		props.payload.availablePlans,
	)
	const loadedThroughPageRef = useRef(props.payload.page)
	const [usersSnapshot, setUsersSnapshot] = useState<
		InfiniteListSnapshot<AdminUserListItem>
	>(() => ({
		error: null,
		isLoadingInitial: false,
		isLoadingMore: false,
		items: props.payload.users,
		hasMore: props.payload.page * props.payload.pageSize < props.payload.total,
		totalCount: props.payload.total,
	}))
	const [userList] = useState(() => {
		const list = createInfiniteList<AdminUserListItem>({
			mergeDirection: 'append',
			getKey: (user) => user.stableUserId,
			onSnapshot: (snapshot) => setUsersSnapshot(snapshot),
		})
		return list
	})
	useEffect(() => () => userList.reset(), [userList])

	const [selectedUserFallback, setSelectedUserFallback] =
		useState<AdminUserListItem | null>(props.payload.selectedUser)
	const [message, setMessage] = useState<string | null>(null)
	const [actionState, setActionState] = useState<AdminUsersActionState>('idle')
	const [createdUser, setCreatedUser] = useState<AdminCreatedUserSetup | null>(
		null,
	)
	const [mintedVerifyUrl, setMintedVerifyUrl] = useState<string | null>(null)
	const [mintedVerifyUrlForStableUserId, setMintedVerifyUrlForStableUserId] =
		useState<string | null>(null)
	const [selectedRoleToAssign, setSelectedRoleToAssign] = useState(
		'user' as RoleName,
		// Draft follows the selected user (see the render body) until the admin
		// edits it. Null stored plan values are shown/saved as `free`.
	)
	const [planDraftChoice, setSelectedPlanChoice] =
		useState<AdminPlanName>('free')
	const [planDraftStableUserId, setPlanDraftStableUserId] = useState<
		string | null
	>(null)
	const lastLoadedListKeyRef = useRef('')
	const [usageStatus, setUsageStatus] = useState<UsageStatus>('loading')
	const [usageData, setUsageData] = useState<AdminUserUsageLoaderData | null>(
		null,
	)
	const [usageMessage, setUsageMessage] = useState<string | null>(null)
	const usageRequestIdRef = useRef(0)
	const [usageLoadedForStableUserId, setUsageLoadedForStableUserId] = useState<
		string | null
	>(null)
	const [usageFailedForStableUserId, setUsageFailedForStableUserId] = useState<
		string | null
	>(null)
	function getCurrentHref() {
		return props.currentHref
	}
	function getSelectedStableUserIdFromHref(href: string) {
		return parseSelectedStableUserId(getSelection(href).selectedId)
	}
	function resolveSelectedUser(href: string) {
		const selectedStableUserId = getSelectedStableUserIdFromHref(href)
		if (selectedStableUserId == null) return null
		return (
			usersSnapshot.items.find(
				(user) => user.stableUserId === selectedStableUserId,
			) ??
			(selectedUserFallback?.stableUserId === selectedStableUserId
				? selectedUserFallback
				: null)
		)
	}

	function buildHrefWithUpdatedFilters(
		nextFilters: Partial<AdminUserFilterState>,
	) {
		return buildFilteredListHref(getCurrentHref(), nextFilters)
	}
	function buildUserDetailHref(stableUserId: string) {
		return buildUserDetailHrefFrom(getCurrentHref(), stableUserId)
	}
	async function loadUserUsage(stableUserId: string) {
		const requestId = ++usageRequestIdRef.current
		try {
			const response = await fetch(
				`${adminUserUsageApiPath}?stableUserId=${stableUserId}`,
				{
					headers: { Accept: 'application/json' },
					credentials: 'include',
					signal: lifetime.current?.signal,
				},
			)
			if (requestId !== usageRequestIdRef.current) return
			if (response.status === 401) {
				window.location.assign('/login')
				return
			}
			const payload = await readJson<AdminUserUsageLoaderData>(response)
			if (!response.ok || !payload?.ok) {
				throw new Error('Unable to load usage for this account.')
			}
			setUsageData(payload)
			setUsageStatus('ready')
			setUsageMessage(null)
			setUsageLoadedForStableUserId(stableUserId)
			setUsageFailedForStableUserId(null)
		} catch (error) {
			if (requestId !== usageRequestIdRef.current) return
			setUsageStatus('error')
			setUsageMessage(
				error instanceof Error
					? error.message
					: 'Unable to load usage for this account.',
			)
			setUsageFailedForStableUserId(stableUserId)
		}
	}
	// Plan changes and credit grants move limits, so the same user refetches;
	// dropping the cache keeps stale limits off screen while that runs.
	function invalidateUsage() {
		setUsageData(null)
		setUsageLoadedForStableUserId(null)
		setUsageFailedForStableUserId(null)
	}
	// Any refresh of `users` may carry a newer stored plan, so drop the
	// unsaved draft and let the render pass reseed the select from the
	// refreshed record.
	function resetPlanDraft() {
		setPlanDraftStableUserId(null)
	}
	async function loadMoreUsers() {
		if (status !== 'ready') return false
		const nextPage = loadedThroughPageRef.current + 1
		const loaded = await userList.loadMore(async () => {
			const response = await fetch(
				buildAdminUsersApiRequestUrl(getCurrentHref(), {
					page: nextPage,
					includeSelected: false,
				}),
				{
					headers: { Accept: 'application/json' },
					credentials: 'include',
					signal: lifetime.current?.signal,
				},
			)
			if (response.status === 401) {
				window.location.assign('/login')
				throw new Error('Signed out.')
			}
			const payload = await readJson<AdminUsersLoaderData>(response)
			if (!response.ok || !payload?.ok) {
				throw new Error('Unable to load more users.')
			}
			return {
				items: payload.users,
				hasMore: payload.page * payload.pageSize < payload.total,
				totalCount: payload.total,
			}
		})
		if (loaded) {
			loadedThroughPageRef.current = nextPage
		}
		return loaded
	}
	/**
	 * Mutation responses carry the refreshed target user; patch it in place
	 * so a list the admin has scrolled deep into keeps its loaded window and
	 * URL selection instead of resetting to the first page. A role change can
	 * knock the target out of the active role filter, so drop rows that no
	 * longer match and take the refreshed filtered total from the server.
	 */
	function applyMutationPayload(payload: AdminUsersMutationData, href: string) {
		setAvailableRoles(payload.availableRoles)
		setAvailablePlans(payload.availablePlans)
		const nextWindow = nextAdminUsersWindowAfterMutation({
			currentItems: usersSnapshot.items,
			payload,
			href,
		})
		userList.reset()
		userList.replaceWindow(nextWindow)
		const selectedStableUserId = getSelectedStableUserIdFromHref(href)
		const updatedUser = payload.updatedUser
		setSelectedUserFallback(
			payload.selectedUser ??
				(updatedUser &&
				selectedStableUserId != null &&
				updatedUser.stableUserId === selectedStableUserId
					? updatedUser
					: selectedUserFallback),
		)
		void (updatedUser?.stableUserId === actorKey
			? invalidateOwnPermissions()
			: invalidatePages())
		resetPlanDraft()
	}
	function applyCreateUserPayload(
		payload: AdminUsersMutationData,
		href: string,
	) {
		if (payload.listRefreshFailed && !payload.updatedUser) return
		const selectedId = getSelectedStableUserIdFromHref(href)
		const keepFallback =
			payload.updatedUser?.stableUserId === selectedId
				? payload.updatedUser
				: selectedUserFallback
		if (!payload.listRefreshFailed) {
			setAvailableRoles(payload.availableRoles)
			setAvailablePlans(payload.availablePlans)
			loadedThroughPageRef.current = payload.page
			lastLoadedListKeyRef.current = getListKey(href)
		}
		setSelectedUserFallback(
			payload.listRefreshFailed
				? keepFallback
				: (payload.selectedUser ?? keepFallback),
			// reset() emits an empty snapshot; read the current window first.
		)
		// reset() emits an empty snapshot; read the current window first.
		const nextWindow = nextAdminUsersWindowAfterCreate({
			currentItems: usersSnapshot.items,
			currentHasMore: usersSnapshot.hasMore,
			currentTotal: usersSnapshot.totalCount,
			payload,
		})
		userList.reset()
		userList.replaceWindow(nextWindow)
		void invalidatePages()
		resetPlanDraft()
	}
	async function submitRoleAction(action: 'assign_role' | 'remove_role') {
		const href = getCurrentHref()
		const selectedUser = resolveSelectedUser(href)
		if (!selectedUser || actionState !== 'idle') return
		setActionState(action === 'assign_role' ? 'assigning' : 'removing')
		setMessage(null)
		try {
			// Carry filters + selected so the mutation response refreshes the
			// same list window and selectedUser fallback the UI is showing.
			const response = await fetch(buildAdminUsersApiRequestUrl(href), {
				method: 'POST',
				headers: {
					Accept: 'application/json',
					'Content-Type': 'application/json',
				},
				credentials: 'include',
				signal: lifetime.current?.signal,
				body: JSON.stringify({
					action,
					stableUserId: selectedUser.stableUserId,
					role: selectedRoleToAssign,
				}),
			})
			if (response.status === 401) {
				window.location.assign('/login')
				return
			}
			const payload = await readJson<
				AdminUsersMutationData & {
					ok?: boolean
					error?: string
				}
			>(response)
			if (!response.ok || !payload?.ok) {
				throw new Error(payload?.error || 'Unable to update user roles.')
			}
			applyMutationPayload(payload, href)
			setMessage(
				action === 'assign_role'
					? `Assigned ${selectedRoleToAssign} role.`
					: `Removed ${selectedRoleToAssign} role.`,
			)
			setActionState('idle')
		} catch (error) {
			setActionState('idle')
			setMessage(
				error instanceof Error ? error.message : 'Unable to update user roles.',
			)
		}
	}
	async function submitPlanAction() {
		const href = getCurrentHref()
		const selectedUser = resolveSelectedUser(href)
		if (!selectedUser || actionState !== 'idle') return
		const plan =
			selectedUser.stableUserId === planDraftStableUserId
				? planDraftChoice
				: (selectedUser.plan ?? 'free')
		setActionState('saving-plan')
		setMessage(null)
		try {
			// Carry filters + selected so the mutation response refreshes the
			// same list window and selectedUser fallback the UI is showing.
			const response = await fetch(buildAdminUsersApiRequestUrl(href), {
				method: 'POST',
				headers: {
					Accept: 'application/json',
					'Content-Type': 'application/json',
				},
				credentials: 'include',
				signal: lifetime.current?.signal,
				body: JSON.stringify({
					action: 'update_plan',
					stableUserId: selectedUser.stableUserId,
					plan,
				}),
			})
			if (response.status === 401) {
				window.location.assign('/login')
				return
			}
			const payload = await readJson<
				AdminUsersMutationData & {
					ok?: boolean
					error?: string
				}
			>(response)
			if (!response.ok || !payload?.ok) {
				throw new Error(payload?.error || 'Unable to update user plan.')
			}
			applyMutationPayload(payload, href)
			invalidateUsage()
			setMessage(`Updated admin grant to ${plan}.`)
			setActionState('idle')
		} catch (error) {
			setActionState('idle')
			setMessage(
				error instanceof Error ? error.message : 'Unable to update user plan.',
			)
		}
	}
	async function submitVerificationAction(
		action: 'mark_email_verified' | 'mint_verify_url',
	) {
		const href = getCurrentHref()
		const selectedUser = resolveSelectedUser(href)
		if (!selectedUser || actionState !== 'idle') return
		setActionState('verifying')
		setMessage(null)
		try {
			const response = await fetch(buildAdminUsersApiRequestUrl(href), {
				method: 'POST',
				headers: {
					Accept: 'application/json',
					'Content-Type': 'application/json',
				},
				credentials: 'include',
				signal: lifetime.current?.signal,
				body: JSON.stringify({
					action,
					stableUserId: selectedUser.stableUserId,
				}),
			})
			if (response.status === 401) {
				window.location.assign('/login')
				return
			}
			const payload = await readJson<
				AdminUsersMutationData & {
					ok?: boolean
					error?: string
				}
			>(response)
			if (!response.ok || !payload?.ok) {
				throw new Error(payload?.error || 'Unable to update verification.')
			}
			applyMutationPayload(payload, href)
			if (action === 'mint_verify_url' && payload.verifyUrl) {
				setMintedVerifyUrl(payload.verifyUrl)
				setMintedVerifyUrlForStableUserId(selectedUser.stableUserId)
				setMessage(
					'Minted a one-time verify link. Send it over a path that is not kody.codes.',
				)
			} else {
				setMintedVerifyUrl(null)
				setMintedVerifyUrlForStableUserId(null)
				setMessage('Marked email verified.')
			}
			setActionState('idle')
		} catch (error) {
			setActionState('idle')
			setMessage(
				error instanceof Error
					? error.message
					: 'Unable to update verification.',
			)
		}
	}
	async function submitModerationAction(
		action: 'suspend_user' | 'unsuspend_user' | 'resume_email_outbound',
	) {
		const href = getCurrentHref()
		const selectedUser = resolveSelectedUser(href)
		if (!selectedUser || actionState !== 'idle') return
		setActionState('moderating')
		setMessage(null)
		try {
			// Carry filters + selected so the mutation response refreshes the
			// same list window and selectedUser fallback the UI is showing.
			const response = await fetch(buildAdminUsersApiRequestUrl(href), {
				method: 'POST',
				headers: {
					Accept: 'application/json',
					'Content-Type': 'application/json',
				},
				credentials: 'include',
				signal: lifetime.current?.signal,
				body: JSON.stringify({
					action,
					stableUserId: selectedUser.stableUserId,
				}),
			})
			if (response.status === 401) {
				window.location.assign('/login')
				return
			}
			const payload = await readJson<
				AdminUsersMutationData & {
					ok?: boolean
					error?: string
				}
			>(response)
			if (!response.ok || !payload?.ok) {
				throw new Error(payload?.error || 'Unable to update the account.')
			}
			applyMutationPayload(payload, href)
			setMessage(
				action === 'suspend_user'
					? 'Account suspended.'
					: action === 'unsuspend_user'
						? 'Account suspension cleared.'
						: 'Outbound email resumed.',
			)
			setActionState('idle')
		} catch (error) {
			setActionState('idle')
			setMessage(
				error instanceof Error
					? error.message
					: 'Unable to update the account.',
			)
		}
	}
	async function submitCreateUser(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		if (!(event.currentTarget instanceof HTMLFormElement)) return
		if (actionState !== 'idle') return
		const form = event.currentTarget
		const formData = new FormData(form)
		const href = getCurrentHref()
		setActionState('creatingUser')
		setCreatedUser(null)
		setMessage(null)
		try {
			const response = await fetch(buildAdminUsersApiRequestUrl(href), {
				method: 'POST',
				headers: {
					Accept: 'application/json',
					'Content-Type': 'application/json',
				},
				credentials: 'include',
				signal: lifetime.current?.signal,
				body: JSON.stringify({
					action: 'create_user',
					email: String(formData.get('email') ?? '').trim(),
					username: String(formData.get('username') ?? '').trim(),
				}),
			})
			if (response.status === 401) {
				window.location.assign('/login')
				return
			}
			const payload = await readJson<
				AdminUsersMutationData & {
					ok?: boolean
					error?: string
				}
			>(response)
			if (!response.ok || !payload?.ok) {
				throw new Error(payload?.error || 'Unable to create user.')
			}
			applyCreateUserPayload(payload, href)
			setCreatedUser(payload.createdUser ?? createdUser)
			setMessage('User created. Copy the setup link below.')
			setActionState('idle')
			if (payload.createdUser) form.reset()
		} catch (error) {
			setActionState('idle')
			setMessage(
				error instanceof Error ? error.message : 'Unable to create user.',
			)
		}
	}
	const loadMoreFromIntersection = useEffectEvent(loadMoreUsers)
	useEffect(() => {
		const node = sentinelRef.current
		if (!node) return
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting))
					void loadMoreFromIntersection()
			},
			{ rootMargin: '400px' },
		)
		observer.observe(node)
		return () => observer.disconnect()
	}, [usersSnapshot])
	const secondaryButtonCss = getGhostButtonCss({ size: 'sm' })
	const currentHref = props.currentHref
	const pending = false
	const [appliedPayload, setAppliedPayload] = useState(props.payload)
	if (appliedPayload !== props.payload) {
		setAppliedPayload(props.payload)
		setAvailableRoles(props.payload.availableRoles)
		setAvailablePlans(props.payload.availablePlans)
		setSelectedUserFallback(props.payload.selectedUser)
		setPlanDraftStableUserId(null)
		setMessage(
			getSelectedStableUserIdFromHref(props.currentHref) != null &&
				!props.payload.selectedUser
				? 'User not found.'
				: null,
		)
	}
	useEffect(() => {
		const listKey = getListKey(props.currentHref)
		if (shouldReseedAdminUsersWindow(listKey, lastLoadedListKeyRef.current)) {
			loadedThroughPageRef.current = props.payload.page
			userList.reset()
			userList.replaceWindow({
				items: props.payload.users,
				hasMore:
					props.payload.page * props.payload.pageSize < props.payload.total,
				totalCount: props.payload.total,
			})
			lastLoadedListKeyRef.current = listKey
		}
	}, [props.payload, props.currentHref, userList])

	const { items: users, hasMore, totalCount, isLoadingMore } = usersSnapshot
	const filters = readFilterState(currentHref)
	const hasActiveFilters = Boolean(
		filters.search || filters.role || filters.verification,
	)
	const selectedStableUserId = getSelectedStableUserIdFromHref(currentHref)
	const selectedUser = resolveSelectedUser(currentHref)
	const isMutating = actionState !== 'idle'
	const selectedUsageId = selectedUser?.stableUserId ?? null
	const requestUserUsage = useEffectEvent(loadUserUsage)
	useEffect(() => {
		if (
			selectedUsageId &&
			usageLoadedForStableUserId !== selectedUsageId &&
			usageFailedForStableUserId !== selectedUsageId
		) {
			void requestUserUsage(selectedUsageId)
		}
	}, [selectedUsageId, usageLoadedForStableUserId, usageFailedForStableUserId])

	// Never render one account's usage under another account's header
	// while the drill-down request is still in flight.
	const selectedUsage =
		selectedUser &&
		usageData &&
		usageData.stableUserId === selectedUser.stableUserId
			? usageData
			: null
	const selectedPlanChoice =
		selectedUser?.stableUserId === planDraftStableUserId
			? planDraftChoice
			: (selectedUser?.plan ?? 'free')

	return (
		<AccountManagementShell busy={pending}>
			<AdminPageHeader
				title="Admin users"
				description="Review account metadata and manage role assignments and entitlement plans. User content is never shown here."
				currentHref={currentHref}
			/>
			{status === 'loading' ? (
				<p css={{ color: colors.textMuted, margin: 0 }}>Loading users…</p>
			) : null}
			{message ? (
				<AccountManagementMessage tone={status === 'error' ? 'error' : 'info'}>
					{message}
				</AccountManagementMessage>
			) : null}
			{usersSnapshot.error ? (
				<AccountManagementMessage tone="error">
					{usersSnapshot.error}
				</AccountManagementMessage>
			) : null}
			{
				<AdminCreateUserPanel
					{...{
						actionState,
						createdUser,
						isMutating,
						onSubmit: submitCreateUser,
					}}
				/>
			}
			<RecordTable
				mode="expand"
				busy={pending}
				ariaLabel="User accounts"
				selectedId={selectedStableUserId}
				// Unconditional: the snapshot keeps the previous window during a
				// refetch, and dropping the slot mid-refetch resized the search
				// field the reader is typing into.
				countLabel={`${users.length} of ${totalCount} ${totalCount === 1 ? 'account' : 'accounts'}`}
				emptyLabel={
					status === 'ready'
						? hasActiveFilters
							? 'No users match the current filters.'
							: 'No users found.'
						: 'Loading users…'
				}
				toolbar={
					<>
						<RecordTableSearch
							label="Search users"
							placeholder="Search by username or email"
							value={filters.search}
							onInput={(value) => {
								replaceLocation(buildHrefWithUpdatedFilters({ search: value }))
							}}
						/>
						<RecordTableSelect
							label="Filter users by role"
							value={filters.role}
							onChange={(value) => {
								replaceLocation(buildHrefWithUpdatedFilters({ role: value }))
							}}
						>
							<option value="">All roles</option>
							{availableRoles.map((role) => (
								<option key={role} value={role}>
									{role}
								</option>
							))}
						</RecordTableSelect>
						<RecordTableSelect
							label="Filter users by verification"
							value={filters.verification}
							onChange={(value) => {
								replaceLocation(
									buildHrefWithUpdatedFilters({
										verification: value === 'stalled' ? 'stalled' : '',
									}),
								)
							}}
						>
							<option value="">All verification</option>
							<option value="stalled">Stalled accepted</option>
						</RecordTableSelect>
					</>
				}
				columns={[
					{ key: 'username', label: 'Username', primary: true },
					{ key: 'email', label: 'Email', drop: 1 },
					{ key: 'roles', label: 'Roles', drop: 2 },
				]}
				rows={users.map((user) => ({
					id: user.stableUserId,
					// A role or plan mutation is in flight against the selected
					// user; navigating away mid-write would strand it.
					href: isMutating ? undefined : buildUserDetailHref(user.stableUserId),
					cells: {
						username: user.username,
						email: <span css={clampedCellCss}>{user.email}</span>,
						roles: <RecordChips items={user.roles} empty="No roles" />,
					},
				}))}
				footer={
					hasMore ? (
						<div ref={sentinelRef}>
							<button
								type="button"
								disabled={isLoadingMore}
								onClick={() => void loadMoreUsers()}
								css={{ ...secondaryButtonCss, width: '100%' }}
							>
								{isLoadingMore ? 'Loading more…' : 'Load more'}
							</button>
						</div>
					) : null
				}
				record={
					selectedUser ? (
						<AdminUserDetail
							key={selectedUser.stableUserId}
							{...{
								selectedUser,
								availableRoles,
								availablePlans,
								actionState,
								selectedRoleToAssign,
								selectedPlanChoice,
								mintedVerifyUrl,
								mintedVerifyUrlForStableUserId,
								usageStatus:
									selectedUsage ||
									usageFailedForStableUserId === selectedUsageId
										? usageStatus
										: 'loading',
								usageMessage,
								usageFailedForStableUserId,
								selectedUsage,
								onRoleToAssignChange: (role) => {
									setSelectedRoleToAssign(role)
								},
								onSubmitRoleAction: (action) => void submitRoleAction(action),
								onSubmitVerificationAction: (action) =>
									void submitVerificationAction(action),
								onPlanChoiceChange: (plan) => {
									setPlanDraftStableUserId(selectedUser.stableUserId)
									setSelectedPlanChoice(plan)
								},
								onSubmitPlanAction: () => void submitPlanAction(),
								onCreditsGranted: invalidateUsage,
								onSubmitModerationAction: (action) =>
									void submitModerationAction(action),
							}}
						/>
					) : null
				}
			/>
		</AccountManagementShell>
	)
}

const mutationResources = [
	'loadAdminUsers',
	'loadAdminRoles',
	'loadAdminInsights',
	'loadAccountPage',
	'loadProfile',
	'loadUsagePage',
	'loadBillingPage',
] as const
