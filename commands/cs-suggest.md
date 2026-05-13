---
description: Suggest the best Claude Code asset for a task (intent-oriented, explicit). Routes to the cheatsheet MCP suggest tool.
argument-hint: <task description>
---

The user wants an explicit, intent-oriented suggestion from the cheatsheet catalog.

**Action:** Call exactly one MCP tool — `suggest` from the `cheatsheet` MCP server — with parameter `task="$ARGUMENTS"`. Do not call any other tool first.

**If `$ARGUMENTS` is empty:** Do NOT call any tool. Print:
> Usage: `/cs-suggest <task description>` — example: `/cs-suggest review pull request`

**Output Format:**

For every catalog result list, format entries as:

`**<name>** (<kind>) — <description> — \`id: <id>\``

- Max 10 entries per response.
- Footer: ``Use `get_detail(id=...)` for full details of any entry.``
- This format MUST match the slash-command output (`/cheatsheet`, `/cs-search`, `/cs-suggest`).
