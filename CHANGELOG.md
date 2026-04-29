# Changelog

Alle nennenswerten Änderungen an diesem Projekt werden in diesem Dokument festgehalten.

Das Format orientiert sich an [Keep a Changelog](https://keepachangelog.com/de/1.1.0/) und dieses Projekt folgt [Semantic Versioning](https://semver.org/lang/de/).

## [Unreleased]

## [0.3.1] - 2026-04-19

### Changed
- `installed_plugins.json`-Parser unterstützt v2-Schema (`{version: 2, plugins: {...}}`) **und** bleibt rückwärtskompatibel zum v1-Flat-Record.
- Plugin-Discovery nimmt das erste Installations-Element (`installations[0]`) pro Plugin — strukturell auf Mehrfach-Installationen vorbereitet.

### Fixed
- Scanner-Parse-Fehler bei neu generierten `installed_plugins.json`-Dateien (v2-Schema wurde vorher nicht erkannt).

## [0.3.0] - 2026-04-18

### Added
- Scanner-Completeness-Fixes gemäß empirisch verifizierter Plugin-/Settings-Hierarchie:
  - User-MCPs werden jetzt aus `~/.claude.json` (Root-User-Scope) gelesen, nicht mehr aus `~/.claude/settings.json`.
  - Plugin-MCPs: `.mcp.json` im Plugin-Root wird berücksichtigt.
  - Plugin-Commands, dynamische Plugin-Agents und Plugin-Hooks werden gescannt (Layouts A/B/C/D laut `claude-plugins-dirstruktur.md`).
- `repos/`-Fallback für lokal entwickelte Plugins (falls das Verzeichnis nicht leer ist).

### Fixed
- Silent-No-Op bei der MCP-Discovery durch Lesen der falschen Settings-Datei.

## [0.2.0] - 2026-04-17

### Changed
- Tool-Descriptions semantisch angereichert (v2) — jede der 13 MCP-Tools liefert nun eine ausführliche, diskriminierende Beschreibung, damit Claude-Client-Modelle die Tools korrekt auswählen.

## [0.1.0] - 2026-04-16

### Added
- Initial Release.
- **13 MCP-Tools:** `list_skills`, `list_commands`, `list_agents`, `list_hooks`, `list_mcp_tools`, `list_cli_commands`, `list_roles`, `get_detail`, `get_stats`, `get_workflows`, `search`, `suggest`, `refresh`.
- **7 Scanner** (Skills, Commands, Agents, Hooks, MCP-Tools, CLI-Builtins, Jarvis-Rollen) mit Orchestrator und defensiven Fehler-Pfaden (`Promise.allSettled`).
- **Lokales Web-Dashboard** auf `http://127.0.0.1:37778` mit Suche, Kategorie-Filter, Suggest-Ranking und Detail-View.
- **Register-Script** `scripts/register.sh` mit atomarem Edit, Backup, Parse-Validation und Auto-Rollback.

[Unreleased]: https://github.com/KlausiMagJeder/claude-cheatsheet-mcp/compare/v0.3.1...HEAD
[0.3.1]: https://github.com/KlausiMagJeder/claude-cheatsheet-mcp/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/KlausiMagJeder/claude-cheatsheet-mcp/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/KlausiMagJeder/claude-cheatsheet-mcp/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/KlausiMagJeder/claude-cheatsheet-mcp/releases/tag/v0.1.0
