import { expect, test } from 'vitest'
import {
	cliBaselineVersion,
	planCliRelease,
	type ReleaseCommit,
} from './cli-release-plan.ts'

function commit(
	partial: Partial<ReleaseCommit> & { subject: string },
): ReleaseCommit {
	return {
		body: '',
		touchesCli: false,
		touchesClientInputs: false,
		...partial,
	}
}

test('fix and feat on the CLI bump patch and minor from 1.26.3', () => {
	expect(
		planCliRelease({
			currentVersion: cliBaselineVersion,
			generatedClientChanged: false,
			commits: [commit({ subject: 'fix(cli): retry login', touchesCli: true })],
		}),
	).toEqual({ version: '1.26.4' })
	expect(
		planCliRelease({
			currentVersion: cliBaselineVersion,
			generatedClientChanged: false,
			commits: [
				commit({ subject: 'feat(cli): device token login', touchesCli: true }),
			],
		}),
	).toEqual({ version: '1.27.0' })
})

test('shared spec commits publish only when the generated client changes', () => {
	const commits = [
		commit({
			subject: 'feat(api): add a field',
			touchesClientInputs: true,
		}),
	]
	expect(
		planCliRelease({
			currentVersion: cliBaselineVersion,
			generatedClientChanged: false,
			commits,
		}),
	).toBeNull()
	expect(
		planCliRelease({
			currentVersion: cliBaselineVersion,
			generatedClientChanged: true,
			commits,
		}),
	).toEqual({ version: '1.27.0' })
})

test('unrelated and docs commits do not publish', () => {
	expect(
		planCliRelease({
			currentVersion: cliBaselineVersion,
			generatedClientChanged: false,
			commits: [
				commit({ subject: 'feat(worker): unrelated' }),
				commit({ subject: 'docs(cli): readme', touchesCli: true }),
				commit({ subject: 'chore: format', touchesCli: true }),
			],
		}),
	).toBeNull()
})

test('a generated-client change without a releasable commit is a patch', () => {
	expect(
		planCliRelease({
			currentVersion: '1.27.0',
			generatedClientChanged: true,
			commits: [
				commit({
					subject: 'refactor(api): rename a local',
					touchesClientInputs: true,
				}),
			],
		}),
	).toEqual({ version: '1.27.1' })
})

test('breaking feat on the CLI is major', () => {
	expect(
		planCliRelease({
			currentVersion: cliBaselineVersion,
			generatedClientChanged: false,
			commits: [
				commit({
					subject: 'feat(cli)!: drop a flag',
					touchesCli: true,
				}),
			],
		}),
	).toEqual({ version: '2.0.0' })
})
