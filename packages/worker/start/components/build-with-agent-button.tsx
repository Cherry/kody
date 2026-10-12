/** @jsxImportSource @emotion/react */
import { CopyTextButton } from './copy-text-button.tsx'
import { buildWithAgentPrompt } from '#universal/build-with-agent.ts'

export function BuildWithAgentButton({ business }: { business?: boolean }) {
	return (
		<CopyTextButton
			variant="ghost"
			value={buildWithAgentPrompt(business)}
			ariaLabel="Build with your agent, copy setup prompt"
			copiedLabel="Copied! Paste into your agent"
			idleLabel={
				<span
					css={{
						display: 'inline-flex',
						alignItems: 'center',
						gap: '0.65rem',
					}}
				>
					<span
						aria-hidden="true"
						css={{ display: 'inline-flex', gap: '0.3rem' }}
					>
						{['claudecode', 'codex', 'cursor'].map((icon) => (
							<img
								key={icon}
								src={`/images/icons/${icon}.svg`}
								alt=""
								width={18}
								height={18}
								css={{
									background: '#fff',
									borderRadius: '3px',
									padding: '2px',
								}}
							/>
						))}
					</span>
					Build with your agent
				</span>
			}
		/>
	)
}
