---
name: mcp-skill-maintenance
description: Safely add, inspect, disable, and document DSH MCP servers and local skills.
whenToUse: Use when configuring an MCP server or maintaining shared DSH skills.
user-invocable: true
---

# MCP and Skill Maintenance

## MCP checklist

1. Give the Cordis row `id` and `serverName` unique, descriptive names.
2. Select `stdio` for a local command or `streamable-http` for a remote endpoint.
3. Keep credentials in environment variables and reference them through `!!js process.env.VARIABLE`.
4. Start with `failOnStartupError: false` for optional services; enable strict startup only when the service is mandatory.
5. Restart DSH after changing host-side MCP configuration, then verify the expected `mcp__<server>__<tool>` tools are present.
6. Disable a broken or unused server with `disabled: true` instead of deleting a working configuration immediately.

## Skill checklist

1. Store each shared skill as `skills/<name>/SKILL.md` or `skills/<name>.md`.
2. Use a unique kebab-case `name` and a concise `description` in frontmatter.
3. State when the skill should be used with `whenToUse`.
4. Keep instructions concrete, ordered, and scoped to a repeatable task.
5. Do not store secrets in Skill text, examples, or checked-in configuration.
