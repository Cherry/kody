import { spawnSync } from 'node:child_process'

// Both implementations need evidence even when a new comparison check exposes
// an original defect. Keep failures visible and run the shared local servers
// in sequence because they write the same generated Worker configuration.
let failed = false
for (const script of ['test:e2e:run', 'test:e2e:start']) {
	const result = spawnSync('npm', ['run', script], {
		stdio: 'inherit',
		env: { ...process.env, CI: '1' },
	})
	if (result.error) console.error(result.error)
	if (result.status !== 0) failed = true
}
process.exitCode = failed ? 1 : 0
