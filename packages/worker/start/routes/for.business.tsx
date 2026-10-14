import { createFileRoute } from '@tanstack/react-router'
import { BusinessRoute } from '../pages/business.tsx'
export const Route = createFileRoute('/for/business')({
	component: BusinessRoute,
})
