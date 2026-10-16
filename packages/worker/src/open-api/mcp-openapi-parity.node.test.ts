import { expect, test } from 'vitest'
import { apiOperationsById } from './operations.ts'

/**
 * MCP tool names registered in `registerTools`. `api` is the OpenAPI
 * dispatcher, so it has no operation of its own.
 */
const mcpTools = [
	{ name: 'search', operationId: 'search' },
	{ name: 'execute', operationId: 'execute' },
] as const

const mcpToolsWithoutApiOperation = new Set(['api'])

test('every MCP tool has an OpenAPI operation or an explicit allowlist entry', () => {
	for (const tool of mcpTools) {
		expect(apiOperationsById.has(tool.operationId)).toBe(true)
	}
	expect(mcpToolsWithoutApiOperation.has('api')).toBe(true)
	expect(apiOperationsById.has('searchTool')).toBe(true)
	expect(apiOperationsById.has('cliLoginDeviceToken')).toBe(true)
	expect(apiOperationsById.get('execute')?.kind).toBe('native')
	expect(apiOperationsById.get('search')?.kind).toBe('capability')
})
