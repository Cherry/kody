/** @jsxImportSource @emotion/react */
import { createFileRoute } from '@tanstack/react-router'
import { ResetPasswordRoute } from '../pages/reset-password.tsx'

export const Route = createFileRoute('/reset-password')({
	component: ResetPassword,
})

function ResetPassword() {
	const search = Route.useRouteContext().pageLocation.searchStr
	return <ResetPasswordRoute key={search} />
}
