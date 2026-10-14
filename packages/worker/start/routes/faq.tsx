/** @jsxImportSource @emotion/react */
import { staticDocumentHead } from '../components/document-head.ts'
import { createFileRoute } from '@tanstack/react-router'
import { FaqRoute } from '../pages/faq.tsx'

export const Route = createFileRoute('/faq')({
	head: staticDocumentHead('faq'),
	component: FaqRoute,
})
