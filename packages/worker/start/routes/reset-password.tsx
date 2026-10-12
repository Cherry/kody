/** @jsxImportSource @emotion/react */
import { createFileRoute, useLocation } from '@tanstack/react-router'
import { ResetPasswordRoute } from '../pages/reset-password.tsx'

export const Route = createFileRoute('/reset-password')({
	component: ResetPassword,
})

function ResetPassword() {
	const search = useLocation({ select: (location) => location.searchStr })
	return <ResetPasswordRoute key={search} />
}
