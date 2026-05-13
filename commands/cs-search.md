---
description: Full-text search the cheatsheet catalog by keywords. Routes to the cheatsheet MCP search tool.
argument-hint: <keywords>
---

The user wants to search the cheatsheet catalog by keyword (literal match on name, description, tags).

**Action:** Call exactly one MCP tool — `search` from the `cheatsheet` MCP server — with parameter `query="$ARGUMENTS"`. Do not call any other tool first.

**If `$ARGUMENTS` is empty:** Do NOT call any tool. Print:
> Usage: `/cs-search <keywords>` — example: `/cs-search rails`

**Output Format:**

For every catalog result list, format entries as:

`**<name>** (<kind>) — <description> — \`id: <id>\``

- Max 10 entries per response.
- Footer: ``Use `get_detail(id=...)` for full details of any entry.``
- This format MUST match the slash-command output (`/cheatsheet`, `/cs-search`, `/cs-suggest`).
