/** @jsxImportSource @emotion/react */
import { createFileRoute } from '@tanstack/react-router'
import { PrivacyRoute } from '../pages/privacy.tsx'

export const Route = createFileRoute('/privacy')({ component: PrivacyRoute })
