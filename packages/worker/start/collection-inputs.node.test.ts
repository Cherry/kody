import { expect, test } from 'vitest'
import { activityInput } from './activity-input.ts'
import { secretsInput } from './secrets-input.ts'

test('activity selection prefers route identity and normalizes filters before caching', () => {
	expect(
		activityInput(
			'team',
			'?selected=other&view=recent&surface=job&triage=resolved&cursor=%20next%20',
			'run',
		),
	).toEqual({
		orgSlug: 'team',
		selectedRunId: 'run',
		viewFilter: 'recent',
		statusFilter: 'all',
		surfaceFilter: 'job',
		triageFilter: 'resolved',
		cursor: 'next',
	})
	expect(
		activityInput(
			'team',
			'?view=invalid&status=invalid&surface=invalid&error_triage=invalid',
		),
	).toMatchObject({
		viewFilter: 'errors',
		statusFilter: 'error',
		surfaceFilter: 'all',
		triageFilter: 'open',
	})
})
test('secret input retains repeated approval hosts and scoped secret identity', () => {
	const input = secretsInput(
		'team',
		'?selected=other&hosts=a,b&host=c&allowed-host=d&allowedHosts=e&names=ONE,TWO&name=THREE&scope=package&package_id=approval&packageId=storage&provider=github',
		{ scope: 'session', name: 'TOKEN', sessionId: 'session' },
	)
	expect(input.selectedSecretId).toBe('session::session::TOKEN')
	expect(input.provider).toBe('github')
	expect(input.setupName).toBe('THREE')
	expect(input.approval).toEqual({
		hosts: ['a,b', 'c', 'd', 'e'],
		names: ['ONE,TWO', 'THREE'],
		scope: 'package',
		packageId: 'approval',
		storagePackageId: 'storage',
		sessionId: undefined,
	})
	expect(secretsInput('team', '?scope=invalid')).toMatchObject({
		selectedSecretId: null,
		approval: { scope: 'user' },
	})
})
