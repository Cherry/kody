# kody agent index

Kody is a multi-user personal assistant: every signed-in user gets a fully
isolated assistant (own packages, jobs, secrets, memories, remote connectors,
email inboxes, durable storage).

`npm run validate` is the single authoritative local gate.

Open the page that owns the task, and load
[installed Intent skills](./docs/contributing/intent-skills.md) before
substantial edits:

- Contributor documentation map:
  [docs/contributing/index.md](./docs/contributing/index.md)
- Engineering principles: [docs/principles/](./docs/principles/index.md)
- Task skills: [`.agents/skills/`](./.agents/skills/)

Cloud Agent VM gotchas (Node on `PATH`, Playwright install, dev server, seeding,
local limitations):
[docs/contributing/cloud-agents.md](./docs/contributing/cloud-agents.md)
