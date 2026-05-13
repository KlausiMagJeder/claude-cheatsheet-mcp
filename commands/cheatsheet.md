---
description: Suggest the right Claude Code asset for a task (intent-oriented). Routes to the cheatsheet MCP suggest tool.
argument-hint: <task description>
---

The user wants a suggestion for the best Claude Code asset (skill, command, agent, MCP tool, hook) for a specific task.

**Action:** Call exactly one MCP tool — `suggest` from the `cheatsheet` MCP server — with parameter `task="$ARGUMENTS"`. Do not call any other tool first.

**If `$ARGUMENTS` is empty:** Do NOT call any tool. Print:
> Usage: `/cheatsheet <task description>` — example: `/cheatsheet review pr`
>
> Related commands: `/cs-search` (keyword match), `/cs-suggest` (explicit suggest), `/cs-stats` (catalog overview).

**Output Format:**

For every catalog result list, format entries as:

`**<name>** (<kind>) — <description> — \`id: <id>\``

- Max 10 entries per response.
- Footer: ``Use `get_detail(id=...)` for full details of any entry.``
- This format MUST match the slash-command output (`/cheatsheet`, `/cs-search`, `/cs-suggest`).
