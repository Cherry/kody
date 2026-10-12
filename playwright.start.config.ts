import { defineConfig } from '@playwright/test'
import original from './playwright.config.ts'

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3848'
const webServer = Array.isArray(original.webServer)
	? original.webServer[0]
	: original.webServer

export default defineConfig({
	...original,
	testIgnore: ['**/*.node.test.ts'],
	outputDir: 'test-results-start',
	use: { ...original.use, baseURL },
	webServer: {
		...webServer,
		command:
			'npm run e2e:web-server -- --config vite.start.config.ts --port 3848',
		url: `${baseURL}/health`,
		reuseExistingServer: Boolean(process.env.PLAYWRIGHT_BASE_URL),
	},
})
