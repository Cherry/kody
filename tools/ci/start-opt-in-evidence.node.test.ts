import { expect, test } from 'vitest'
import {
	assertDeploymentEvidence,
	assertDeployedReceipt,
} from './start-opt-in-evidence.ts'
const release = 'a'.repeat(40)
const run = {
	head_sha: release,
	status: 'completed',
	conclusion: 'failure',
	event: 'workflow_dispatch',
	path: '.github/workflows/deploy.yml',
	head_branch: 'taren/tanstack-start-migration',
}
const jobs = {
	jobs: [
		{
			name: 'Prepare inactive Start opt-in release',
			steps: [
				{
					name: 'Deploy inactive isolated workers with trusted production secrets',
					conclusion: 'success',
				},
			],
		},
	],
}
test('accepts successful inactive deployment step even when the later probe failed', () => {
	expect(() => assertDeploymentEvidence(run, jobs, release)).not.toThrow(
		/required|succeeded/,
	)
	for (const change of [
		{ head_sha: 'b'.repeat(40) },
		{ event: 'pull_request' },
		{ status: 'in_progress' },
		{ path: '.github/workflows/other.yml' },
	])
		expect(() =>
			assertDeploymentEvidence({ ...run, ...change }, jobs, release),
		).toThrow(/required|succeeded/)
	expect(() =>
		assertDeploymentEvidence(
			run,
			{ jobs: [{ name: 'Other job', steps: jobs.jobs[0]!.steps }] },
			release,
		),
	).toThrow(/required|succeeded/)
	expect(() =>
		assertDeploymentEvidence(
			run,
			{
				jobs: [
					{
						...jobs.jobs[0],
						steps: [{ ...jobs.jobs[0]!.steps[0], conclusion: 'failure' }],
					},
				],
			},
			release,
		),
	).toThrow(/required|succeeded/)
})
test('requires exact inactive deployed target receipt and review', () => {
	const receipt = {
		release,
		candidateName: `kody-start-${release}`,
		routerName: 'kody-start-router',
		activated: false,
	}
	const review = {
		manifest: {
			release,
			candidateName: receipt.candidateName,
			legacyName: 'kody-production',
			activated: false,
		},
	}
	expect(() => assertDeployedReceipt(review, receipt, release)).not.toThrow(
		/required|succeeded/,
	)
	for (const change of [
		{ activated: true },
		{ release: 'b'.repeat(40) },
		{ candidateName: 'kody-production' },
		{ routerName: 'other' },
	])
		expect(() =>
			assertDeployedReceipt(review, { ...receipt, ...change }, release),
		).toThrow(/required|succeeded/)
})
