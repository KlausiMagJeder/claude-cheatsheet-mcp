# claude-cheatsheet-mcp

[![CI](https://github.com/KlausiMagJeder/claude-cheatsheet-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/KlausiMagJeder/claude-cheatsheet-mcp/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Version](https://img.shields.io/badge/version-0.3.1-blue.svg)](./package.json)

MCP-Server, der alle installierten Claude-Code-Skills, Commands, Agents, Tools, Hooks und Jarvis-Rollen als durchsuchbaren Katalog bereitstellt.

---

## Features

- **13 MCP-Tools** — `list_skills`, `list_commands`, `list_agents`, `list_hooks`, `list_mcp_tools`, `list_cli_commands`, `list_roles`, `get_detail`, `get_stats`, `get_workflows`, `search`, `suggest`, `refresh`
- **Lokales Web-Dashboard** (`http://127.0.0.1:37778`) mit Freitext-Suche, Kategorie-Filter, Suggest-Ranking und Detail-View
- **Auto-Tag-Generierung** basierend auf Keyword-Matching (konfigurierbares Tag-Override via `src/static/`)
- **Empirisch verifizierte Plugin-Discovery** — unterstützt 4 Layout-Varianten sowie `installed_plugins.json` als primäre Discovery-Quelle

> **Hinweis zu User-Inhalten:** `src/static/workflows.json` und `src/static/tag-overrides.json` werden absichtlich leer (`[]` / `{}`) ausgeliefert, damit keine plugin-/skill-spezifischen Annahmen anderer Setups in deine Installation einfließen. Eigene Workflow-Templates und Tag-Overrides kannst du dort eintragen — ein User-Config-Override-Mechanismus (Lesepfad `~/.config/claude-cheatsheet-mcp/`) ist für v0.4.0 geplant.

---

## Voraussetzungen

- **Node.js ≥ 20**
- **macOS oder Linux** (Windows nicht getestet)

---

## Installation

```bash
npm install
npm run build
```

---

## Registrierung in Claude Code

Das Skript `scripts/register.sh` trägt den MCP-Server in `~/.claude.json` ein.
Es benötigt **kein `jq`** — die gesamte JSON-Manipulation erfolgt über den bereits vorhandenen Node-Prozess.

> **Ziel-Datei:** Claude Code liest User-Scope-MCP-Registrierungen aus der **Root-Datei `~/.claude.json`** (direkt in `$HOME`), **nicht** aus `~/.claude/settings.json`. Einträge in `~/.claude/settings.json.mcpServers` sind für die MCP-Discovery ein Silent-No-Op — `/mcp` findet sie nicht.

### Falls du vor diesem Fix bereits registriert hast

Der frühere Skript-Stand schrieb fälschlich in `~/.claude/settings.json`. Der dortige `cheatsheet`-Eintrag ist unbenutzt und kann folgendermaßen entfernt werden (atomisch, mit Backup):

```bash
F=~/.claude/settings.json; [ -f "$F" ] && cp "$F" "$F.bak.$(date -u +%Y-%m-%dT%H-%M-%S)" && node -e 'const fs=require("fs"),p=process.argv[1],j=JSON.parse(fs.readFileSync(p,"utf8"));if(j.mcpServers){delete j.mcpServers.cheatsheet;if(Object.keys(j.mcpServers).length===0)delete j.mcpServers;}fs.writeFileSync(p,JSON.stringify(j,null,2)+"\n");' "$F"
```

Danach wie gewohnt mit `./scripts/register.sh` in `~/.claude.json` registrieren.

### Kommandos

| Option | Beschreibung |
|---|---|
| _(kein Flag)_ | Registriert `cheatsheet` in `~/.claude.json` |
| `--dry-run` | Zeigt die geplante Änderung als Preview; schreibt nichts |
| `--uninstall` | Entfernt den `cheatsheet`-Eintrag aus `mcpServers` |
| `--force` | Re-registriert, auch wenn der Eintrag bereits vorhanden ist |
| `--help` | Zeigt die Hilfe und beendet das Skript |

### Sicherheits-Phasen

| Phase | Aktion |
|---|---|
| 1/7 | **Build-Check** — prüft, ob `dist/index.js` existiert |
| 2/7 | **Pre-Check** — liest vorhandene `~/.claude.json` (oder erkennt fehlende Datei) |
| 3/7 | **Mutation planen** — zeigt geplante Änderung im Log |
| 4/7 | **Backup** — timestamped Kopie nach `~/.claude.json.bak.<ISO-TS>` |
| 5/7 | **Atomarer Edit** — schreibt in Temp-Datei, dann `mv` (kein teilweiser Schreibzustand); alle anderen Top-Level-Keys bleiben unverändert |
| 6/7 | **Parse-Validation** — prüft JSON-Gültigkeit nach dem Edit; Auto-Rollback bei Fehler |
| 7/7 | **Done** — gibt Backup-Pfad und Next-Steps aus |

### Empfohlener Ablauf

```bash
# 1. Build sicherstellen
npm run build

# 2. Vorschau prüfen (kein Schreiben)
./scripts/register.sh --dry-run

# 3. Registrieren
./scripts/register.sh

# 4. Claude Code neu starten

# 5. MCP-Status prüfen
# In Claude Code: /mcp  →  "cheatsheet" muss erscheinen

# 6. Ersten Aufruf testen
# In Claude Code: Werkzeug "get_stats" aufrufen

# 7. Dashboard aufrufen
open http://127.0.0.1:37778
```

### Manueller Rollback (Notfall)

Falls Claude Code nach einem Neustart nicht startet, die letzte Backup-Datei manuell zurückspielen:

```bash
# Pfad aus der Ausgabe von register.sh übernehmen, z. B.:
cp ~/.claude.json.bak.2025-01-15T10-30-00 ~/.claude.json

# Oder das jeweils neueste Backup automatisch zurückspielen:
cp "$(ls -t ~/.claude.json.bak.* | head -1)" ~/.claude.json
```

---

## Plugin-Aktivierungstest (für Maintainer)

> **Zweck:** Dieser Abschnitt beschreibt den manuellen End-to-End-Test, mit dem der Maintainer nach einem Release (oder nach lokalen Änderungen an `.claude-plugin/plugin.json`, `.mcp.json` oder `.claude-plugin/marketplace.json`) verifiziert, dass das Plugin in Claude Code tatsächlich aktivierbar ist und der MCP-Server startet. Die Jest-Tests unter `src/__tests__/plugin-manifests.test.ts` sichern nur die **statische** Manifest-Korrektheit ab — die Laufzeit-Aktivierung in Claude Code ist nur durch diesen Test verifizierbar.

### Voraussetzung

```bash
# Vollständiger Build muss vorliegen, sonst zeigt .mcp.json ins Leere.
npm run build
test -f dist/index.js && echo "OK: dist/index.js vorhanden"
```

### Ablauf

**1. Lokalen Marketplace-Eintrag anlegen**

Claude Code registriert Marketplaces in `~/.claude/plugins/known_marketplaces.json`. Für einen lokalen Ordner-Marketplace (ohne GitHub-Push) editiere diese Datei und trage folgenden Eintrag hinzu (Pfad an lokales Repo anpassen):

```json
{
  "claude-cheatsheet-local": {
    "source": {
      "source": "local",
      "path": "/path/to/your/claude-cheatsheet-mcp"
    },
    "installLocation": "/path/to/your/claude-cheatsheet-mcp",
    "lastUpdated": "2026-04-16T00:00:00.000Z"
  }
}
```

> **Verifikations-Hinweis:** Die exakte Syntax des lokalen Marketplace-Source-Typs (`"source": "local"` mit `path`) ist in den öffentlichen Claude-Code-Doku-Quellen derzeit nicht explizit dokumentiert. Alternativ kann der Marketplace via `/plugin marketplace add <repo>` nach einem GitHub-Push registriert werden — dieser Pfad ist durch die 4 bereits registrierten GitHub-Marketplaces auf dem System empirisch belegt. **Bitte prüfen gegen aktuelle Claude-Code-CLI-Doku, falls die lokale Variante nicht greift.**

**2. Claude Code neu starten**

Nach jedem Eingriff in `~/.claude/plugins/known_marketplaces.json` oder `~/.claude/settings.json → extraKnownMarketplaces` ist ein Neustart von Claude Code erforderlich, damit die Plugin-Discovery neu gelesen wird.

**3. Plugin aktivieren**

In Claude Code:

```
/plugin marketplace list        # claude-cheatsheet-local muss erscheinen
/plugin install claude-cheatsheet
/plugin list                    # claude-cheatsheet muss als aktiv erscheinen
```

**4. MCP-Server-Start verifizieren**

```
/mcp
```

→ Ein Eintrag `cheatsheet` (aus `.mcp.json → mcpServers.cheatsheet`) muss in der Liste erscheinen, Status sollte `connected` sein.

**5. Tool-Test**

```
get_stats()
list_skills()
search("test")
```

Erfolgreiche Ausführung bestätigt, dass `${CLAUDE_PLUGIN_ROOT}/dist/index.js` korrekt aufgelöst wird.

**6. Aufräumen**

```
/plugin uninstall claude-cheatsheet
```

Anschließend den Eintrag in `~/.claude/plugins/known_marketplaces.json` wieder entfernen.

### Alternative Registrierungs-Pfade

| Pfad | Wann verwenden | Belegt |
|---|---|---|
| Lokaler Ordner-Marketplace (oben) | Test vor GitHub-Push | Syntax unverifiziert — siehe Hinweis oben |
| `/plugin marketplace add <github-repo>` | Nach erfolgtem Push | Empirisch belegt (4/4 installierte Marketplaces) |
| Manueller Eintrag in `~/.claude/settings.json → extraKnownMarketplaces` | Persistente User-Scope-Registrierung | Empirisch belegt durch Settings-Hierarchie |

### Troubleshooting

- **`/mcp` zeigt `cheatsheet` nicht:** `dist/index.js` fehlt → `npm run build`. Oder `${CLAUDE_PLUGIN_ROOT}` wird von Claude Code im Plugin-Kontext nicht gesetzt → Logs in `~/Library/Logs/Claude/` (macOS) prüfen.
- **`/plugin install` meldet "plugin not found":** `plugin.json → name` muss exakt `claude-cheatsheet` lauten (nicht `claude-cheatsheet-mcp`). Gegencheck via Jest: `npm test -- plugin-manifests`.
- **Tool-Aufruf schlägt fehl mit `ENOENT`:** Pfad-Auflösung fehlgeschlagen. Absoluten Pfad im Plugin-Cache-Ordner (`~/.claude/plugins/cache/<owner>/<name>/<version>/dist/index.js`) prüfen.

---

## Verwendung nach Registrierung

Nach einem Neustart von Claude Code steht `cheatsheet` als MCP-Server zur Verfügung.

**Server-Status prüfen:**

```
/mcp
```
→ `cheatsheet` muss in der Liste erscheinen.

**Beispiel-Aufrufe (in Claude Code):**

```typescript
// Statistik aller katalogisierten Einträge
get_stats()

// Alle Skills auflisten
list_skills()

// Volltextsuche
search("test")

// Natürlichsprachliche Empfehlung
suggest("ich will einen PR reviewen")
```

**Web-Dashboard:**

```
http://127.0.0.1:37778
```

Der Port ist über die Umgebungsvariable `CHEATSHEET_WEB_PORT` konfigurierbar.
Der Web-Server kann vollständig deaktiviert werden:

```bash
CHEATSHEET_WEB_DISABLED=1 node dist/index.js
```

---

## Projektstruktur

```
src/
  index.ts              # MCP-Server Entry (stdio)
  types.ts              # Gemeinsame Typen
  scanner/              # 7 Scanner + Orchestrator
  tagger/               # Keyword-basiertes Tagging
  tools/                # 13 MCP-Tool-Implementierungen
  web/                  # HTTP-Server + Vanilla-Dashboard
  static/               # CLI-Builtins, Workflows, Agents, Tag-Overrides
scripts/register.sh     # Installations-Skript
```

---

## Entwicklung

```bash
# Tests (124 Tests)
npm test

# Linting (ESLint v9 Flat-Config)
npm run lint

# Formatierung (Prettier)
npm run format

# Typ-Check (ohne Ausgabe)
npx tsc --noEmit
```

---

## Security-Hinweise

- Der Web-Server bindet **ausschließlich auf `127.0.0.1`** (Loopback) — kein Zugriff aus dem LAN möglich.
- Die Inhalte von `~/.claude/` (inkl. Hook-Tokens, Agent-Prompts) werden nicht nach außen exponiert.
- `get_detail` ist mit Path-Traversal-Schutz versehen: Es werden nur Dateien unterhalb von `~/.claude/` oder dem Projektpfad gelesen.

---

## Contributing

Beiträge sind willkommen. Siehe [CONTRIBUTING.md](./CONTRIBUTING.md) für Entwicklungs-Setup, Code-Style-Vorgaben und PR-Prozess.

---

## Security

Für verantwortungsvolle Disclosure von Sicherheitslücken siehe [SECURITY.md](./SECURITY.md).
Kurzfassung: Der Server bindet ausschließlich auf `127.0.0.1`, `~/.claude/`-Inhalte werden mit Path-Traversal-Schutz gelesen, das Web-Dashboard eskapet sämtlichen User-Input. Es besteht keine Netzwerk-Angriffsfläche für externe Akteure — lokale Privilege-Escalation-Szenarien sollten gemeldet werden.

---

## Kontakt / Feedback

- **Issues / Bug-Reports:** <https://github.com/KlausiMagJeder/claude-cheatsheet-mcp/issues>
- **Repository:** <https://github.com/KlausiMagJeder/claude-cheatsheet-mcp>

---

## Lizenz / Autor

MIT — Volltext siehe [LICENSE](./LICENSE).
