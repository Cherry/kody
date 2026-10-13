import { randomUUID } from 'node:crypto'
import { executeE2eD1Command } from '../d1-utils.ts'
import { expect, test, waitForClientHydration } from '../playwright-utils.ts'

test('system email deletion requires confirmation and persists through reload', async ({
	page,
	seedE2eUser,
	login,
}) => {
	const suffix = Date.now()
	const user = await seedE2eUser({
		email: `system-email-${suffix}@example.com`,
		username: `system-email-${suffix}`,
		password: 'system-email-password',
		admin: true,
	})
	const id = randomUUID()
	const missingId = randomUUID()
	const subject = `System email deletion ${suffix}`
	executeE2eD1Command(
		`INSERT INTO system_email_messages (id, direction, from_address, subject, text_body, processing_status, created_at, updated_at) VALUES ('${id}', 'inbound', 'sender@example.com', '${subject}', 'Delete only this test message', 'stored', datetime('now'), datetime('now')), ('${missingId}', 'inbound', 'sender@example.com', 'Already removed ${suffix}', 'Concurrent removal test', 'stored', datetime('now'), datetime('now'));`,
	)
	try {
		await login({ email: user.email, password: user.password, mode: 'login' })
		await page.goto(`/admin/system-email?messageId=${id}`)
		await waitForClientHydration(page)
		const deletes: unknown[] = []
		page.on('request', (request) => {
			if (
				request.method() === 'POST' &&
				new URL(request.url()).pathname === '/admin/system-email.json'
			)
				deletes.push(request.postDataJSON())
		})
		await page
			.getByRole('button', { name: `Delete message "${subject}"`, exact: true })
			.click()
		await expect(
			page.getByRole('button', {
				name: `Confirm delete message "${subject}"`,
				exact: true,
			}),
		).toBeVisible()
		expect(deletes).toEqual([])
		const stillStored = await page.request.get(
			`/admin/system-email.json?messageId=${id}`,
		)
		expect((await stillStored.json()).selectedMessage.id).toBe(id)
		const accepted = page.waitForResponse(
			(response) =>
				response.request().method() === 'POST' &&
				new URL(response.url()).pathname === '/admin/system-email.json',
		)
		await page
			.getByRole('button', {
				name: `Confirm delete message "${subject}"`,
				exact: true,
			})
			.click()
		expect((await accepted).status()).toBe(200)
		await expect(page).toHaveURL(/\/admin\/system-email$/)
		expect(deletes).toEqual([{ action: 'delete', message_id: id }])
		await expect(
			page.getByRole('link', { name: subject, exact: true }),
		).toHaveCount(0)
		await page.reload()
		const persisted = await page.request.get(
			`/admin/system-email.json?messageId=${id}`,
		)
		expect((await persisted.json()).selectedMessage).toBeNull()

		// A concurrent delete must surface the real server error, not pretend success.
		await page.goto(`/admin/system-email?messageId=${missingId}`)
		await waitForClientHydration(page)
		executeE2eD1Command(
			`DELETE FROM system_email_messages WHERE id = '${missingId}';`,
		)
		await page
			.getByRole('button', {
				name: `Delete message "Already removed ${suffix}"`,
				exact: true,
			})
			.click()
		await page
			.getByRole('button', {
				name: `Confirm delete message "Already removed ${suffix}"`,
				exact: true,
			})
			.click()
		await expect(
			page.getByText('System email message not found.', { exact: true }),
		).toBeVisible()
		await expect(page).toHaveURL(new RegExp(`messageId=${missingId}`))
		await expect(
			page.getByRole('button', {
				name: `Delete message "Already removed ${suffix}"`,
				exact: true,
			}),
		).toHaveCount(0)
	} finally {
		executeE2eD1Command(
			`DELETE FROM system_email_messages WHERE id IN ('${id}', '${missingId}');`,
		)
	}
})
