---
name: cheatsheet
description: >-
  Use when the user asks what Claude Code skills, commands, agents, MCP tools,
  or hooks are installed, or wants to find the right asset for a task —
  examples: 'what skills do I have?', 'is there a tool for X?', 'list my
  agents', 'suggest a tool for PR review'. Queries the local `cheatsheet`
  catalog via MCP.
---

# Cheatsheet — Discover Installed Claude Code Assets

Surfaces the local `cheatsheet` catalog of installed Claude Code assets (skills, slash-commands, agents, MCP tools, hooks, Jarvis roles, CLI builtins, workflows) so the user can find what they already have without grep'ing config files.

## When to Use

- "What skills do I have installed?" → call `list_skills`.
- "Is there a tool for PR review?" → call `suggest` with the task.
- "Find a hook that runs before commit" → call `search` with the keywords.
- "How many MCP tools do I have?" → call `get_stats`.
- "Show me my Jarvis roles" → call `list_roles`.
- "List CLI commands" → call `list_cli_commands`.
- "Re-scan, I just installed a plugin" → call `refresh`.

## When NOT to Use

- NOT for searching source code or grep'ing files in the project — use the Grep tool instead.
- NOT for searching past conversation memory ("how did we solve X last time?") — use the `mem-search` skill instead.
- NOT for web documentation lookups or fetching external pages — use WebFetch / WebSearch instead.
- NOT for reading or editing arbitrary files — use Read / Edit directly.

## Tool Routing

All routing targets the `cheatsheet` MCP server. Pick exactly one tool per user intent.

| User intent | MCP tool |
|---|---|
| "Suggest the right tool for X" / task-oriented intent | `suggest(task=<intent>)` |
| "Search / find by keyword" / literal match across name, description, tags | `search(query=<keywords>)` |
| "Show details for entry ID X" / drill-down after a list | `get_detail(id=<id>)` |
| "Inventory / stats / how many of each kind" | `get_stats()` |
| "List all skills" | `list_skills()` |
| "List all slash-commands" | `list_commands()` |
| "List all agents" | `list_agents()` |
| "List all MCP tools" (across all configured servers) | `list_mcp_tools()` |
| "List all hooks" | `list_hooks()` |
| "List all Jarvis roles" | `list_roles()` |
| "List Claude Code CLI commands" (built-ins like `/help`, `/clear`) | `list_cli_commands()` |
| "Show curated workflows" | `get_workflows()` |
| "Refresh / re-scan the catalog" (after install/uninstall) | `refresh()` |

## Output Format

For every catalog result list, format entries as:

`**<name>** (<kind>) — <description> — \`id: <id>\``

- Max 10 entries per response.
- Footer: ``Use `get_detail(id=...)` for full details of any entry.``
- This format MUST match the slash-command output (`/cheatsheet`, `/cs-search`, `/cs-suggest`).

## Edge Cases

- **Empty result:** Say "No matching catalog entries." Suggest the user try `get_stats` for an overview or refine keywords. Do not show an empty list.
- **Tool error / MCP server unreachable:** Surface the error verbatim and hint that `/plugin` may need re-activation or that `refresh` may help.
- **Ambiguous intent (e.g. just "agents"):** Prefer `list_agents` over `search(query="agents")` — full listings are cheaper and more complete than keyword-search for catalog kinds.
