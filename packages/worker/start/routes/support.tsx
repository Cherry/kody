/** @jsxImportSource @emotion/react */
import { staticDocumentHead } from '../components/document-head.ts'
import { createFileRoute } from '@tanstack/react-router'
import { SupportRoute } from '../pages/support.tsx'

export const Route = createFileRoute('/support')({
	head: staticDocumentHead('support'),
	component: SupportRoute,
})
