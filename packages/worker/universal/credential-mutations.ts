import { z } from 'zod'
import { credentialPickSchema } from './credential-pick-schema.ts'
import {
	credentialTriggerKinds,
	credentialProposalSenderKinds,
	maxCredentialProposalValues,
	maxCredentialProposalReasonLength,
	normalizeProposalSenderValue,
} from './credential-contracts.ts'
const credentialMappingChangeSchema = z.strictObject({
	target: z.discriminatedUnion('type', [
		z.strictObject({
			type: z.literal('default'),
			layer: z.enum(['org', 'mine']),
		}),
		z.strictObject({
			type: z.literal('trigger'),
			trigger: z.strictObject({
				kind: z.enum(credentialTriggerKinds),
				name: z.string().trim().min(1),
			}),
		}),
	]),
	needKey: z.string().trim().min(1),
	credentials: z
		.array(credentialPickSchema)
		.max(maxCredentialProposalValues)
		.nullable(),
})

export const credentialMappingChangesSchema = z.strictObject({
	changes: z
		.array(credentialMappingChangeSchema)
		.min(1)
		.max(maxCredentialProposalValues),
})

export const credentialProposalSchema = z
	.strictObject({
		changes: z
			.array(
				credentialMappingChangeSchema.extend({
					credentials: z
						.array(credentialPickSchema)
						.max(maxCredentialProposalValues),
				}),
			)
			.max(maxCredentialProposalValues),
		enable: z
			.array(
				z.strictObject({
					kind: z.enum(credentialTriggerKinds),
					name: z.string().trim().min(1),
				}),
			)
			.max(maxCredentialProposalValues),
		sender: z
			.strictObject({
				kind: z.enum(credentialProposalSenderKinds),
				value: z.string().nullable(),
			})
			.transform((sender, context) => {
				if (sender.kind === 'any_authenticated')
					return { kind: sender.kind, value: null }
				const value = normalizeProposalSenderValue(
					sender.kind,
					sender.value ?? '',
				)
				if (!value) {
					context.addIssue({
						code: 'custom',
						message: 'Invalid proposal sender.',
					})
					return z.NEVER
				}
				return { kind: sender.kind, value }
			})
			.nullable(),
		reason: z.string().max(maxCredentialProposalReasonLength).nullable(),
		errors: z.array(z.string()),
	})
	.refine(
		(proposal) =>
			proposal.changes.length + proposal.enable.length <=
			maxCredentialProposalValues,
		'Too many proposal changes.',
	)
