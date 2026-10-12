/** @jsxImportSource @emotion/react */
import { createFileRoute } from '@tanstack/react-router'
import { TermsRoute } from '../pages/terms.tsx'

export const Route = createFileRoute('/terms')({ component: TermsRoute })
