<!-- intent-skills:start -->

## Skill Loading

Use the repository’s installed Intent. If it is unavailable, report the missing
dependency instead of downloading a replacement. Before editing files for a
substantial task:

- Run `npm exec --no -- intent list` from the workspace root to see available
  local skills.
- If a listed skill matches the task, run
  `npm exec --no -- intent load <package>#<skill>` before changing files.
- Use the loaded `SKILL.md` guidance while making the change.
- Monorepos: when working across packages, run the skill check from the
  workspace root and prefer the local skill for the package being changed.
- Multiple matches: prefer the most specific local skill for the package or
  concern you are changing; load additional skills only when the task spans
  multiple packages or concerns.

<!-- intent-skills:end -->

# kody agent index

Kody is a multi-user personal assistant: every signed-in user gets a fully
isolated assistant (own packages, jobs, secrets, memories, remote connectors,
email inboxes, durable storage).

`npm run validate` is the single authoritative local gate.

This file is a map, not the docs. Open the page that owns the task:

- Contributor documentation map:
  [docs/contributing/index.md](./docs/contributing/index.md)
- Engineering principles: [docs/principles/](./docs/principles/index.md)
- Task skills: [`.agents/skills/`](./.agents/skills/)

## Cursor Cloud-specific instructions

Cloud Agent VM gotchas (Node on `PATH`, Playwright install, dev server, seeding,
local limitations):
[docs/contributing/cloud-agents.md](./docs/contributing/cloud-agents.md)
