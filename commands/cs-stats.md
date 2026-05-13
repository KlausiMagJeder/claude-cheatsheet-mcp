---
description: Show inventory statistics of all installed Claude Code assets (counts per kind). Routes to the cheatsheet MCP get_stats tool.
---

The user wants an inventory overview of installed Claude Code assets across all kinds (skills, commands, agents, MCP tools, hooks, roles, CLI commands).

**Action:** Call exactly one MCP tool — `get_stats` from the `cheatsheet` MCP server — with no parameters. Do not call any other tool first.

**If `$ARGUMENTS` contains text:** Ignore it (this command takes no arguments). Still call `get_stats`.

**Output:** Present the returned stats as a compact Markdown table (kind → count).
