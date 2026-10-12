import { defineConfig } from 'knip/config'
import { toolCliEntryFiles } from './tools/knip-tool-entries.ts'

export default defineConfig({
	include: ['files', 'exports', 'types'],
	workspaces: {
		'.': {
			entry: [...toolCliEntryFiles(process.cwd()), 'e2e/**/*.ts', 'vitest*.ts'],
			project: ['tools/**/*.{ts,js,mjs}', '*.ts', 'e2e/**/*.ts'],
		},
		'packages/worker': {
			paths: {
				'#start/server/*': ['./start/server/*.ts'],
				'#app/oauth-page.ts': ['./start/oauth-page.ts'],
			},
			entry: [
				'start/client.tsx',
				'start/server.ts',
				// Vite replaces the HTTP OAuth renderer with this native Start entry.
				'start/oauth-page.ts',
				'start/router.tsx',
				'start/routeTree.gen.ts',
				'start/routes/**/*.{ts,tsx}',
				'client/entry.tsx',
				'src/mcp/capabilities/**/*.ts',
				'src/mcp/instructions/**/*.ts',
			],
			project: [
				'src/**/*.{ts,tsx}',
				'start/**/*.{ts,tsx}',
				'client/**/*.{ts,tsx}',
				'universal/**/*.{ts,tsx}',
			],
		},
		'packages/jobs-worker': {
			project: ['src/**/*.ts'],
		},
		'packages/highlight-worker': {
			project: ['src/**/*.ts'],
		},
		'packages/api-worker': {
			project: ['src/**/*.ts'],
		},
		'packages/api-docs-worker': {
			project: ['src/**/*.ts'],
		},
		'packages/backup-control-plane': {
			project: ['*.ts'],
		},
		'packages/status': {
			project: ['*.ts'],
		},
		'packages/nx-cache': {
			entry: ['smoke-probe.ts'],
			project: ['*.ts'],
		},
		'packages/shared': {
			entry: ['src/**/*.ts'],
			project: ['src/**/*.ts'],
		},
		'packages/mock-servers/cloudflare': {
			project: ['src/**/*.ts'],
		},
	},
})
