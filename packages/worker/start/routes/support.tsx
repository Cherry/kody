/** @jsxImportSource @emotion/react */
import { createFileRoute } from '@tanstack/react-router'
import { SupportRoute } from '../pages/support.tsx'

export const Route = createFileRoute('/support')({ component: SupportRoute })
