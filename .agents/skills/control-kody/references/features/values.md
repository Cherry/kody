# Values

Leftover drain for retired named values. Not in account nav. Do not write new
rows; map leftovers to memories, package storage, repos, secrets, or
integrations. See `docs/guides/values.md`.

## How to get there

`/@<slug>/-/values` → `/@<slug>/-/values/:valueId`.

## Drive it

```bash
npm run control-kody -- browse --origin <preview> --path /@<slug>/-/values
```

The page uses native Start server functions for website reads and mutations. Use
supported MCP capabilities through `control-kody search` and
`control-kody execute` when fixture data is needed.

Delete remaining values through the UI. Do not create new value rows.
