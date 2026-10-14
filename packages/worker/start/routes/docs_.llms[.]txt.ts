import { createFileRoute } from '@tanstack/react-router'
import { docsLlmsTxtHttp } from '#start/server/protocol-handlers'
export const Route = createFileRoute('/docs_/llms.txt')({
	server: { handlers: { GET: docsLlmsTxtHttp } },
})
