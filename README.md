# claude-cheatsheet

A Claude Code plugin that catalogs every installed skill, command, agent, hook, and MCP tool in one place — searchable via MCP tools inside Claude Code, or browsable in a local web dashboard.

[![CI](https://github.com/KlausiMagJeder/claude-cheatsheet-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/KlausiMagJeder/claude-cheatsheet-mcp/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Version](https://img.shields.io/badge/version-0.4.0-blue.svg)](./package.json)

## Install

Inside a Claude Code instance, run the following commands:

**Step 1: Add the marketplace**

```
/plugin marketplace add KlausiMagJeder/claude-cheatsheet-mcp
```

**Step 2: Install the plugin**

```
/plugin install claude-cheatsheet
```

**Step 3: Restart Claude Code**

A full restart is required so Claude Code loads the bundled MCP server from the plugin cache.

### Verification

After restart, confirm the server is connected:

```
/mcp
```

The entry `cheatsheet` must appear with status `connected`. Then run a tool to confirm end-to-end:

```
get_stats()
```

Open the local dashboard in your browser:

```
http://127.0.0.1:37778
```

> **Note:** Installation pulls a pre-built `dist/` from the repository (checked in since v0.3.2). For a local dev build or for environments where the native plugin path is not viable, see [Development](#development) below.

---

## What is claude-cheatsheet?

Claude Code installations grow quickly: skills from plugins, slash commands from multiple sources, MCP servers across user and project scope, hook definitions tucked inside settings files. Finding what's actually available — and where it lives — gets harder with every plugin you add.

claude-cheatsheet scans your full Claude Code environment and exposes the result two ways:

| What you get | How you use it |
|--------------|----------------|
| **13 MCP tools** | Query the catalog from inside Claude Code (`list_skills`, `search`, `suggest`, …) |
| **Plugin skill `cheatsheet`** | Auto-triggers on discovery questions ("what skills do I have?", "is there a tool for X?") and routes to the right catalog tool |
| **Slash commands** | `/cheatsheet`, `/cs-search`, `/cs-suggest`, `/cs-stats` — deterministic, tab-completable power-user entry points |
| **Web dashboard** | Browse the same catalog in your browser at `http://127.0.0.1:37778` |
| **Auto-tagging** | Keyword-based tags so related entries surface together |
| **Plugin discovery** | Empirically verified across 4 plugin layouts plus `installed_plugins.json` |

Everything is local. The server binds to loopback only, no data leaves your machine.

---

## Usage

Once installed, `cheatsheet` is available as an MCP server in any Claude Code session.

### MCP tools

The plugin registers 13 tools. Common entry points:

```typescript
// Aggregate counts across all categories
get_stats()

// List entries by category
list_skills()
list_commands()
list_agents()
list_hooks()
list_mcp_tools()
list_cli_commands()
list_roles()

// Full-text search across the catalog
search("test")

// Natural-language recommendation
suggest("I want to review a pull request")

// Detailed view of a single entry
get_detail("skills/superpowers/brainstorming")

// Refresh the catalog after installing new plugins
refresh()
```

The remaining tools are `get_workflows` (curated workflow templates) and a handful of category-specific listers.

### Slash commands

For deterministic, tab-completable access to the catalog, the plugin ships four slash commands:

| Command | What it does |
|---------|--------------|
| `/cheatsheet <task description>` | Top-level convenience, routes to `suggest`. Example: `/cheatsheet review pr` |
| `/cs-search <keywords>` | Explicit wrapper for `search` (literal keyword match) |
| `/cs-suggest <task description>` | Explicit wrapper for `suggest` (intent-oriented) |
| `/cs-stats` | Argumentless wrapper for `get_stats` (catalog inventory overview) |

Prefer the slash commands over plain natural-language prompts when you want a guaranteed, deterministic invocation — they bypass the LLM's tool-routing step. Useful for tab-completion, scripting, and shared team muscle memory.

### Skill

The plugin also installs a `cheatsheet` skill (`skills/cheatsheet/SKILL.md`). Claude Code auto-activates it whenever the user asks a discovery question — "what skills do I have?", "is there a tool for X?", "list my agents" — and routes to the appropriate MCP tool via the routing table inside the skill body. This sits parallel to the slash commands (deterministic, user-driven) and the raw MCP tools (LLM-driven, model-routed): same catalog, three entry points.

### Web dashboard

The plugin also starts a local HTTP server with full-text search, category filters, suggest ranking, and a detail view:

```
http://127.0.0.1:37778
```

The server binds to `127.0.0.1` only — it is not reachable from the LAN.

### Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `CHEATSHEET_WEB_PORT` | `37778` | Port for the local dashboard |
| `CHEATSHEET_WEB_DISABLED` | unset | Set to `1` to disable the web server entirely (MCP tools still work) |

Example — run as MCP-only without the dashboard:

```bash
CHEATSHEET_WEB_DISABLED=1 node dist/index.js
```

### User content

`src/static/workflows.json` and `src/static/tag-overrides.json` ship intentionally empty (`[]` / `{}`) so the plugin makes no assumptions about your specific setup. A user-config override mechanism (read path: `~/.config/claude-cheatsheet-mcp/`) is planned for a future release. Until then, edit the bundled files directly if you want custom workflows or tag mappings.

---

## Project structure

```
src/
  index.ts              # MCP server entry (stdio)
  types.ts              # Shared types
  scanner/              # 7 scanners + orchestrator
  tagger/               # Keyword-based tagging
  tools/                # 13 MCP tool implementations
  web/                  # HTTP server + vanilla dashboard
  static/               # CLI built-ins, workflows, tag overrides
dist/                   # Build output (tracked since v0.3.2)
skills/
  cheatsheet/SKILL.md   # Plugin-skill for discovery auto-triggering
commands/
  cheatsheet.md         # /cheatsheet → suggest
  cs-search.md          # /cs-search → search
  cs-suggest.md         # /cs-suggest → suggest
  cs-stats.md           # /cs-stats → get_stats
scripts/register.sh     # Maintainer fallback installer
```

---

## Requirements

- Claude Code (with plugin support)
- Node.js 20+
- macOS or Linux (Windows is not tested)

---

## Development

For maintainers, contributors, and anyone testing a local branch:

```bash
git clone https://github.com/KlausiMagJeder/claude-cheatsheet-mcp.git
cd claude-cheatsheet-mcp
npm install
npm run build
npm test
```

The full suite runs 156 tests (Jest). Additional scripts:

```bash
npm run lint          # ESLint v9 flat config
npm run format        # Prettier
npm run format:check  # Prettier in check mode
npx tsc --noEmit      # Type check only
```

### `dist/` is tracked

`dist/` is checked into the repository since v0.3.2. The bundled `.mcp.json` points at `${CLAUDE_PLUGIN_ROOT}/dist/index.js`, so the plugin must ship a working build for `/plugin install` to work end-to-end. Whenever you change `src/`, run `npm run build` and commit the updated `dist/` along with your source changes.

A release workflow that rebuilds `dist/` on tag push is planned but not yet in place.

### Plugin activation test (pre-release)

After changes to `.claude-plugin/plugin.json`, `.mcp.json`, or `.claude-plugin/marketplace.json`, run an end-to-end activation test in addition to the static manifest tests in `src/__tests__/plugin-manifests.test.ts`:

```bash
npm run build
test -f dist/index.js && echo "OK: dist/index.js present"
```

Then in Claude Code:

```
/plugin marketplace add KlausiMagJeder/claude-cheatsheet-mcp
/plugin install claude-cheatsheet
/plugin list                    # claude-cheatsheet must appear as active
/mcp                            # cheatsheet must appear, status connected
```

Tool smoke test:

```
get_stats()
list_skills()
search("test")
```

Cleanup before the next iteration:

```
/plugin uninstall claude-cheatsheet
```

#### Troubleshooting

- **`/mcp` does not show `cheatsheet`:** `dist/index.js` is missing — run `npm run build` and commit `dist/`. Or `${CLAUDE_PLUGIN_ROOT}` is not set in the plugin context — check Claude Code logs (on macOS: `~/Library/Logs/Claude/`).
- **`/plugin install` reports "plugin not found":** `plugin.json → name` must be exactly `claude-cheatsheet` (not `claude-cheatsheet-mcp`). Verify with `npm test -- plugin-manifests`.
- **Tool call fails with `ENOENT`:** Path resolution failed. Verify the absolute path inside the plugin cache: `~/.claude/plugins/cache/<owner>/<name>/<version>/dist/index.js`.

---

## Fallback installer: `scripts/register.sh`

For edge cases where the native plugin path is not an option, `scripts/register.sh` registers the MCP server **directly** in `~/.claude.json`, bypassing the marketplace mechanism entirely. Use it when:

- You want to test a local branch without publishing it as a plugin
- The plugin API behaves unexpectedly in your Claude Code version
- You need direct user-scope control (e.g. multi-server setups)

> **Target file:** the script writes to `~/.claude.json` (user-scope authority). Entries in `~/.claude/settings.json → mcpServers` are a silent no-op — `/mcp` does not pick them up.

### Commands

| Option | Description |
|--------|-------------|
| _(no flag)_ | Registers `cheatsheet` in `~/.claude.json` |
| `--dry-run` | Shows the planned change as preview, writes nothing |
| `--uninstall` | Removes the `cheatsheet` entry from `mcpServers` |
| `--force` | Re-registers even when the entry already exists |
| `--help` | Prints help and exits |

### Safety phases

| Phase | Action |
|-------|--------|
| 1/7 | **Build check** — verifies `dist/index.js` exists |
| 2/7 | **Pre-check** — reads existing `~/.claude.json` (or detects missing file) |
| 3/7 | **Plan mutation** — logs the planned change |
| 4/7 | **Backup** — timestamped copy to `~/.claude.json.bak.<ISO-TS>` |
| 5/7 | **Atomic edit** — writes to a temp file, then `mv` (no partial writes); other top-level keys remain untouched |
| 6/7 | **Parse validation** — verifies JSON validity post-edit; auto-rollback on failure |
| 7/7 | **Done** — prints backup path and next steps |

### Recommended flow

```bash
npm run build
./scripts/register.sh --dry-run    # Preview
./scripts/register.sh              # Apply
# Restart Claude Code, then check /mcp inside the session
```

### Manual rollback

If Claude Code fails to start after a registration, restore the most recent backup:

```bash
cp "$(ls -t ~/.claude.json.bak.* | head -1)" ~/.claude.json
```

### Migration: prior `~/.claude/settings.json` entries

Earlier versions of the script wrote to `~/.claude/settings.json` by mistake. That entry is unused and can be removed atomically:

```bash
F=~/.claude/settings.json
[ -f "$F" ] && cp "$F" "$F.bak.$(date -u +%Y-%m-%dT%H-%M-%S)" && \
  node -e 'const fs=require("fs"),p=process.argv[1],j=JSON.parse(fs.readFileSync(p,"utf8"));if(j.mcpServers){delete j.mcpServers.cheatsheet;if(Object.keys(j.mcpServers).length===0)delete j.mcpServers;}fs.writeFileSync(p,JSON.stringify(j,null,2)+"\n");' "$F"
```

Then re-register via `./scripts/register.sh` as normal.

---

## Security

- The web server binds **only to `127.0.0.1`** (loopback). It is not reachable from the LAN.
- The contents of `~/.claude/` (including hook tokens and agent prompts) are never exposed externally.
- `get_detail` enforces path-traversal protection: only files below `~/.claude/` or the active project path are read.
- The web dashboard escapes all user-controlled input to prevent injection.

For responsible disclosure of vulnerabilities, see [SECURITY.md](./SECURITY.md).

---

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup, code style, and the PR process.

- **Issues / bug reports:** <https://github.com/KlausiMagJeder/claude-cheatsheet-mcp/issues>
- **Repository:** <https://github.com/KlausiMagJeder/claude-cheatsheet-mcp>

---

## License

MIT — see [LICENSE](./LICENSE).
