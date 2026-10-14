/** @jsxImportSource @emotion/react */
import {
	useInfiniteQuery,
	useQuery,
	useMutation,
	useQueryClient,
} from '@tanstack/react-query'
import { usePageInvalidation } from '../page-invalidation.ts'
import {
	useState,
	useRef,
	useEffect,
	useEffectEvent,
	type FormEvent,
} from 'react'
import { useRouter, useRouteContext } from '@tanstack/react-router'

import { readJson } from '#client/routes/account-approval-shared.ts'
import { colors } from '#universal/styles/tokens.ts'
import { getGhostButtonCss } from '#universal/styles/style-primitives.ts'
import { type RoleName } from '#universal/permissions.ts'
import {
	type AdminCreatedUserSetup,
	type AdminPlanName,
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
	parseSelectedStableUserId,
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
	const client = useQueryClient()
	const activeScope = useRef<object | null>(null)
	useEffect(() => {
		const scope = {}
		activeScope.current = scope
		return () => {
			if (activeScope.current === scope) activeScope.current = null
		}
	}, [actorKey, props.currentHref])
	const sentinelRef = useRef<HTMLDivElement | null>(null)
	const status = 'ready' as AccountStatus
	const availableRoles = props.payload.availableRoles
	const availablePlans = props.payload.availablePlans
	const selectedUserFallback = props.payload.selectedUser
	const [loadAdditionalPages, setLoadAdditionalPages] = useState(false)
	const additional = useInfiniteQuery({
		queryKey: ['admin-users-pages', actorKey, getListKey(props.currentHref)],
		initialPageParam: props.payload.page + 1,
		enabled:
			loadAdditionalPages &&
			props.payload.page * props.payload.pageSize < props.payload.total,
		queryFn: async ({ pageParam, signal }) => {
			const response = await fetch(
				buildAdminUsersApiRequestUrl(props.currentHref, {
					page: pageParam,
					includeSelected: false,
				}),
				{
					headers: { Accept: 'application/json' },
					credentials: 'include',
					signal,
				},
			)
			const payload = await readJson<AdminUsersLoaderData>(response)
			if (!response.ok || !payload?.ok)
				throw new Error('Unable to load more users.')
			return payload
		},
		getNextPageParam: (last) =>
			last.page * last.pageSize < last.total ? last.page + 1 : undefined,
	})
	const userMap = new Map(
		props.payload.users.map((user) => [user.stableUserId, user]),
	)
	for (const page of additional.data?.pages ?? [])
		for (const user of page.users)
			if (!userMap.has(user.stableUserId)) userMap.set(user.stableUserId, user)
	const usersSnapshot = {
		items: [...userMap.values()],
		hasMore: additional.data
			? additional.hasNextPage
			: props.payload.page * props.payload.pageSize < props.payload.total,
		totalCount: props.payload.total,
		isLoadingMore: additional.isFetching,
		error: additional.error?.message ?? null,
	}
	const write = useMutation({
		mutationFn: async (input: {
			url: string
			init: RequestInit
			actorKey: string | null
			target: string | null
			permissions: boolean
		}) => fetch(input.url, input.init),
		onMutate: (input) => ({
			reconcile: input.permissions ? invalidateOwnPermissions : invalidatePages,
		}),
		onSettled: async (_data, _error, input, snapshot) => {
			await Promise.all([
				snapshot?.reconcile(),
				client.invalidateQueries({
					queryKey: ['admin-users-pages', input.actorKey],
				}),
				client.invalidateQueries({
					queryKey: [
						'admin-user',
						input.actorKey,
						...(input.target ? [input.target] : []),
					],
				}),
			])
		},
		gcTime: 0,
	})
	function post(url: string, init: RequestInit) {
		const body = JSON.parse(String(init.body)) as {
			stableUserId?: string
			action?: string
		}
		return write.mutateAsync({
			url,
			init,
			actorKey,
			target: body.stableUserId ?? null,
			permissions: body.stableUserId === actorKey,
		})
	}

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
	function invalidateUsage() {
		void client.invalidateQueries({ queryKey: ['admin-user', actorKey] })
	}
	function resetPlanDraft() {
		setPlanDraftStableUserId(null)
	}
	async function loadMoreUsers() {
		if (additional.isFetching || !usersSnapshot.hasMore) return false
		if (!loadAdditionalPages) setLoadAdditionalPages(true)
		else await additional.fetchNextPage()
		return true
	}
	async function submitRoleAction(action: 'assign_role' | 'remove_role') {
		const href = getCurrentHref()
		const submittedScope = activeScope.current
		const selectedUser = resolveSelectedUser(href)
		if (!selectedUser || actionState !== 'idle') return
		setActionState(action === 'assign_role' ? 'assigning' : 'removing')
		setMessage(null)
		try {
			// Carry filters + selected so the mutation response refreshes the
			// same list window and selectedUser fallback the UI is showing.
			const response = await post(buildAdminUsersApiRequestUrl(href), {
				method: 'POST',
				headers: {
					Accept: 'application/json',
					'Content-Type': 'application/json',
				},
				credentials: 'include',
				body: JSON.stringify({
					action,
					stableUserId: selectedUser.stableUserId,
					role: selectedRoleToAssign,
				}),
			})
			if (response.status === 401) {
				throw new Error('Please sign in again.')
			}
			const payload = await readJson<
				AdminUsersMutationData & {
					ok?: boolean
					error?: string
				}
			>(response)
			if (activeScope.current !== submittedScope) return
			if (!response.ok || !payload?.ok) {
				throw new Error(payload?.error || 'Unable to update user roles.')
			}
			resetPlanDraft()
			setMessage(
				action === 'assign_role'
					? `Assigned ${selectedRoleToAssign} role.`
					: `Removed ${selectedRoleToAssign} role.`,
			)
			setActionState('idle')
		} catch (error) {
			if (activeScope.current !== submittedScope) return
			setActionState('idle')
			setMessage(
				error instanceof Error ? error.message : 'Unable to update user roles.',
			)
		}
	}
	async function submitPlanAction() {
		const href = getCurrentHref()
		const submittedScope = activeScope.current
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
			const response = await post(buildAdminUsersApiRequestUrl(href), {
				method: 'POST',
				headers: {
					Accept: 'application/json',
					'Content-Type': 'application/json',
				},
				credentials: 'include',
				body: JSON.stringify({
					action: 'update_plan',
					stableUserId: selectedUser.stableUserId,
					plan,
				}),
			})
			if (response.status === 401) {
				throw new Error('Please sign in again.')
			}
			const payload = await readJson<
				AdminUsersMutationData & {
					ok?: boolean
					error?: string
				}
			>(response)
			if (activeScope.current !== submittedScope) return
			if (!response.ok || !payload?.ok) {
				throw new Error(payload?.error || 'Unable to update user plan.')
			}
			resetPlanDraft()
			invalidateUsage()
			setMessage(`Updated admin grant to ${plan}.`)
			setActionState('idle')
		} catch (error) {
			if (activeScope.current !== submittedScope) return
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
		const submittedScope = activeScope.current
		const selectedUser = resolveSelectedUser(href)
		if (!selectedUser || actionState !== 'idle') return
		setActionState('verifying')
		setMessage(null)
		try {
			const response = await post(buildAdminUsersApiRequestUrl(href), {
				method: 'POST',
				headers: {
					Accept: 'application/json',
					'Content-Type': 'application/json',
				},
				credentials: 'include',
				body: JSON.stringify({
					action,
					stableUserId: selectedUser.stableUserId,
				}),
			})
			if (response.status === 401) {
				throw new Error('Please sign in again.')
			}
			const payload = await readJson<
				AdminUsersMutationData & {
					ok?: boolean
					error?: string
				}
			>(response)
			if (activeScope.current !== submittedScope) return
			if (!response.ok || !payload?.ok) {
				throw new Error(payload?.error || 'Unable to update verification.')
			}
			resetPlanDraft()
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
			if (activeScope.current !== submittedScope) return
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
		const submittedScope = activeScope.current
		const selectedUser = resolveSelectedUser(href)
		if (!selectedUser || actionState !== 'idle') return
		setActionState('moderating')
		setMessage(null)
		try {
			// Carry filters + selected so the mutation response refreshes the
			// same list window and selectedUser fallback the UI is showing.
			const response = await post(buildAdminUsersApiRequestUrl(href), {
				method: 'POST',
				headers: {
					Accept: 'application/json',
					'Content-Type': 'application/json',
				},
				credentials: 'include',
				body: JSON.stringify({
					action,
					stableUserId: selectedUser.stableUserId,
				}),
			})
			if (response.status === 401) {
				throw new Error('Please sign in again.')
			}
			const payload = await readJson<
				AdminUsersMutationData & {
					ok?: boolean
					error?: string
				}
			>(response)
			if (activeScope.current !== submittedScope) return
			if (!response.ok || !payload?.ok) {
				throw new Error(payload?.error || 'Unable to update the account.')
			}
			resetPlanDraft()
			setMessage(
				action === 'suspend_user'
					? 'Account suspended.'
					: action === 'unsuspend_user'
						? 'Account suspension cleared.'
						: 'Outbound email resumed.',
			)
			setActionState('idle')
		} catch (error) {
			if (activeScope.current !== submittedScope) return
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
		const submittedScope = activeScope.current
		setActionState('creatingUser')
		setCreatedUser(null)
		setMessage(null)
		try {
			const response = await post(buildAdminUsersApiRequestUrl(href), {
				method: 'POST',
				headers: {
					Accept: 'application/json',
					'Content-Type': 'application/json',
				},
				credentials: 'include',
				body: JSON.stringify({
					action: 'create_user',
					email: String(formData.get('email') ?? '').trim(),
					username: String(formData.get('username') ?? '').trim(),
				}),
			})
			if (response.status === 401) {
				throw new Error('Please sign in again.')
			}
			const payload = await readJson<
				AdminUsersMutationData & {
					ok?: boolean
					error?: string
				}
			>(response)
			if (activeScope.current !== submittedScope) return
			if (!response.ok || !payload?.ok) {
				throw new Error(payload?.error || 'Unable to create user.')
			}
			resetPlanDraft()
			setCreatedUser(payload.createdUser ?? createdUser)
			setMessage('User created. Copy the setup link below.')
			setActionState('idle')
			if (payload.createdUser) form.reset()
		} catch (error) {
			if (activeScope.current !== submittedScope) return
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
	}, [
		usersSnapshot.items.length,
		usersSnapshot.hasMore,
		usersSnapshot.isLoadingMore,
	])
	const secondaryButtonCss = getGhostButtonCss({ size: 'sm' })
	const currentHref = props.currentHref
	const pending = false

	const { items: users, hasMore, totalCount, isLoadingMore } = usersSnapshot
	const filters = readFilterState(currentHref)
	const hasActiveFilters = Boolean(
		filters.search || filters.role || filters.verification,
	)
	const selectedStableUserId = getSelectedStableUserIdFromHref(currentHref)
	const selectedUser = resolveSelectedUser(currentHref)
	const isMutating = actionState !== 'idle'
	const selectedUsageId = selectedUser?.stableUserId ?? null
	const usageQuery = useQuery({
		meta: { actorKey },
		queryKey: ['admin-user', actorKey, selectedUsageId, 'usage'],
		enabled: selectedUsageId !== null,
		queryFn: async ({ signal }) => {
			const response = await fetch(
				`${adminUserUsageApiPath}?stableUserId=${encodeURIComponent(selectedUsageId!)}`,
				{
					headers: { Accept: 'application/json' },
					credentials: 'include',
					signal,
				},
			)
			const payload = await readJson<AdminUserUsageLoaderData>(response)
			if (!response.ok || !payload?.ok)
				throw new Error('Unable to load usage for this account.')
			return payload
		},
	})
	const usageData = usageQuery.data
	const usageStatus: UsageStatus = usageQuery.isPending
		? 'loading'
		: usageQuery.isError
			? 'error'
			: 'ready'
	const usageMessage = usageQuery.error?.message ?? null
	const usageFailedForStableUserId = usageQuery.isError ? selectedUsageId : null

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
