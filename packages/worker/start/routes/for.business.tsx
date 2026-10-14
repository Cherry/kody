import { acquisitionMarkdown } from '#start/server/markdown'
import { createFileRoute } from '@tanstack/react-router'
import { BusinessRoute } from '../pages/business.tsx'
export const Route = createFileRoute('/for/business')({
	server: { handlers: { GET: acquisitionMarkdown } },
	component: BusinessRoute,
})
