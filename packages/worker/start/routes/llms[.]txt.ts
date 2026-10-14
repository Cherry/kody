import { createFileRoute } from '@tanstack/react-router'
import { llmsTxtHttp } from '#start/server/protocol-handlers'
export const Route = createFileRoute('/llms.txt')({
	server: { handlers: { GET: llmsTxtHttp } },
})
