/** @jsxImportSource @emotion/react */
import { createFileRoute } from '@tanstack/react-router'
import { loadOrganizations } from '#start/server/org-organizations'
import { CreateOrganizationPage } from '../pages/org-organizations.tsx'
export const Route = createFileRoute('/account_/organizations_/new')({
	loader: () => loadOrganizations(),
	head: () => ({ meta: [{ title: 'Create organization' }] }),
	component: CreateOrganizationPage,
})
