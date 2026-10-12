import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(process.argv[2] ?? 'dist-start')

function sources(directory) {
	const result = new Set()
	for (const entry of readdirSync(directory, { withFileTypes: true })) {
		const file = join(directory, entry.name)
		if (entry.isDirectory()) {
			for (const source of sources(file)) result.add(source)
		} else if (entry.name.endsWith('.map')) {
			for (const source of JSON.parse(readFileSync(file, 'utf8')).sources ?? [])
				result.add(source.replaceAll('\\', '/'))
		}
	}
	return result
}

for (const environment of ['client', 'server']) {
	const modules = [...sources(join(root, environment))]
	const redact = modules.filter((source) =>
		source.includes('/@tanstack/redact/'),
	)
	const upstream = modules.filter((source) =>
		/\/node_modules\/(?:react|react-dom|scheduler)\//.test(source),
	)
	if (redact.length === 0 || upstream.length > 0) {
		throw new Error(
			`${environment}: expected Redact source maps without upstream React runtime modules; found ${redact.length} Redact entries and ${JSON.stringify(upstream)}`,
		)
	}
	console.log(
		`${environment}: ${redact.length} Redact source entries, no upstream React runtime entries`,
	)
}
