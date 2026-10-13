import { readFile } from 'node:fs/promises'
import { transform } from 'esbuild'
import { type Plugin } from 'vite'

/** Minify inline CSS at build time without rewriting public asset URLs. */
export function inlineCssText(): Plugin {
	return {
		name: 'inline-css-text',
		apply: 'build',
		enforce: 'pre',
		async load(id) {
			if (!id.endsWith('.css?raw')) return null
			const filePath = id.slice(0, -'?raw'.length)
			this.addWatchFile(filePath)
			const { code } = await transform(await readFile(filePath, 'utf8'), {
				loader: 'css',
				minify: true,
			})
			return `export default ${JSON.stringify(code)}`
		},
	}
}
