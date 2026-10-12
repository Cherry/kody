import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { redact } from '@tanstack/redact/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type PluginOption } from 'vite'
import originalConfig from './vite.config.ts'

const root = path.dirname(fileURLToPath(import.meta.url))

// Match tanstack.com's Worker setup: every server variant uses one runtime.
const redactServerAliases = [
	'react-dom/server',
	'react-dom/server.edge',
	'react-dom/server.node',
	'react-dom/server.bun',
	'react-dom/server.browser',
	'react-dom/static.edge',
	'react-dom/static.node',
	'react-dom/static',
].map((specifier) => ({
	find: new RegExp(`^${specifier.replaceAll('.', '\\.')}$`),
	replacement: '@tanstack/redact/server',
}))

async function withoutRemix(plugins: PluginOption[]): Promise<PluginOption[]> {
	const output: PluginOption[] = []
	for (const item of plugins) {
		const plugin = await item
		if (Array.isArray(plugin)) output.push(...(await withoutRemix(plugin)))
		else if (plugin && !plugin.name.startsWith('pitlane-')) output.push(plugin)
	}
	return output
}

export default defineConfig(async (environment) => {
	const original = await originalConfig(environment)
	return {
		...original,
		cacheDir: path.resolve(root, 'node_modules/.vite-start'),
		environments: {
			client: {
				// The late-injected Buffer polyfill is missed by the initial dependency scan.
				// Prebundle it so first use cannot reload a page with an unfinished form.
				optimizeDeps: { include: ['buffer'] },
			},
			ssr: {
				optimizeDeps: { noDiscovery: true, include: [] },
				resolve: { noExternal: ['@tanstack/redact'] },
			},
		},
		ssr: { noExternal: ['@tanstack/redact'] },
		build: {
			...original.build,
			outDir: process.env.KODY_VITE_OUTDIR ?? 'dist-start',
		},
		plugins: [
			{
				name: 'kody-legacy-jsx-compiler',
				enforce: 'pre' as const,
				transform(source: string, id: string) {
					if (
						!id.endsWith('.tsx') ||
						id.includes('/start/') ||
						!id.includes('/packages/worker/')
					)
						return
					return {
						code: `/** @jsxImportSource remix/component */\n${source}`,
						map: null,
					}
				},
			},
			...(await withoutRemix(original.plugins ?? [])),
			redact(),
			tanstackStart({
				srcDirectory: 'packages/worker/start',
				router: {
					codeSplittingOptions: {
						defaultBehavior: [
							['loader'],
							['component'],
							['pendingComponent'],
							['errorComponent'],
							['notFoundComponent'],
						],
					},
				},
				server: { entry: 'server.ts' },
			}),
			react({
				include: /\/start\/.*\.[jt]sx?$/,
				jsxImportSource: '@emotion/react',
			}),
		],
		resolve: {
			...original.resolve,
			alias: [
				...redactServerAliases,
				{
					find: /^use-sync-external-store\/shim\/index\.js$/,
					replacement: '@tanstack/redact',
				},
				{
					find: /^#app\/oauth-page\.ts$/,
					replacement: path.resolve(
						root,
						'packages/worker/start/oauth-page.ts',
					),
				},
				{
					find: /^#start\/server\/(.*)$/,
					replacement: path.resolve(root, 'packages/worker/start/server/$1.ts'),
				},
				{
					find: /^#app\/hmr\.ts$/,
					replacement: path.resolve(root, 'packages/worker/src/app/hmr.ts'),
				},
				{
					find: /^#app\/client-entry-assets\.ts$/,
					replacement: path.resolve(
						root,
						'packages/worker/src/app/client-entry-assets.ts',
					),
				},
				{
					find: /^#app\/handler\.ts$/,
					replacement: path.resolve(root, 'packages/worker/start/server.ts'),
				},
				...(Array.isArray(original.resolve?.alias)
					? original.resolve.alias
					: []),
			],
		},
		oxc: {
			jsx: { runtime: 'automatic' as const, importSource: '@emotion/react' },
		},
	}
})
