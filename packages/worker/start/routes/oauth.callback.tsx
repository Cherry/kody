/** @jsxImportSource @emotion/react */
import { createFileRoute } from '@tanstack/react-router'
import { OAuthCallbackRoute } from '../pages/oauth-callback.tsx'

export const Route = createFileRoute('/oauth/callback')({
	component: OAuthCallbackRoute,
})
