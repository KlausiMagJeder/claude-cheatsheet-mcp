# Contributing to claude-cheatsheet-mcp

Danke für dein Interesse, zu `claude-cheatsheet-mcp` beizutragen! Dieses Dokument beschreibt, wie du lokal entwickelst, welche Konventionen gelten und wie ein Pull Request idealerweise aussieht.

## Projekt-Scope

`claude-cheatsheet-mcp` ist ein lokaler MCP-Server, der installierte Claude-Code-Ressourcen (Skills, Commands, Agents, Hooks, MCP-Tools, CLI-Builtins, Jarvis-Rollen) scannt und als Katalog sowie via Web-Dashboard zugänglich macht. Beiträge sind willkommen in den Bereichen:

- Zusätzliche Scanner / Discovery-Quellen
- Verbesserte Tagger-/Suggest-Heuristiken
- Dashboard-UX
- Plattform-Portabilität (Linux, Windows)
- Dokumentation und Beispiele

Größere Architektur-Änderungen bitte vorab als Issue diskutieren.

## Entwicklungs-Setup

**Voraussetzungen:**

- Node.js ≥ 20
- npm (getestet mit aktuellen npm-10-Versionen)
- macOS oder Linux (Windows nicht offiziell getestet, WSL sollte funktionieren)

**Repo klonen und initialisieren:**

```bash
git clone https://github.com/KlausiMagJeder/claude-cheatsheet-mcp.git
cd claude-cheatsheet-mcp
npm install
```

**Build:**

```bash
npm run build
```

**Entwicklungs-Watch-Modus:**

```bash
npm run dev
```

**Server lokal starten:**

```bash
node dist/index.js
# Dashboard: http://127.0.0.1:37778
```

## Code-Style

Der Produktiv-Code steht unter strikter TypeScript-Konfiguration (ESM, strict mode). Tooling ist bereits konfiguriert:

- **ESLint** (Flat-Config, v9) — `npm run lint`
- **Prettier** — `npm run format:check`, Auto-Fix mit `npm run format`
- **Type-Check** — `npx tsc --noEmit`

Bitte vor jedem PR sicherstellen, dass alle drei Checks grün sind. ESLint-Disables nur mit Inline-Begründung.

## Tests

Das Projekt nutzt Jest mit ts-jest und `--experimental-vm-modules` (ESM-native Tests). Aktuell 124 Tests in 22 Suiten.

```bash
npm test
```

Neue Funktionalität sollte von mindestens einem Unit-Test abgedeckt sein; größere Flows (z.B. End-to-End-Scanner) gerne zusätzlich als Integrationstest.

## PR-Prozess

1. **Fork** des Repos erstellen.
2. **Feature-Branch** von `main` aus anlegen (`git checkout -b feat/<kurzbeschreibung>`).
3. Änderungen implementieren, Tests und Lint grün halten.
4. **Commit-Messages** — kurz, imperativ, optional [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`). Kein Zwang, aber gerne gesehen.
5. **Pull Request** gegen `main` eröffnen mit:
   - Aussagekräftigem Titel
   - Kurzer Beschreibung: _Was_ ändert sich und _warum_
   - Verweis auf zugehöriges Issue, falls vorhanden
   - Hinweis, falls Breaking-Changes eingeführt werden
6. Die CI muss grün sein (Lint, Format, Type-Check, Tests, Build).
7. Reviewer geben Feedback — bitte auf Änderungswünsche eingehen oder begründet widersprechen.

## Issues und Security-Disclosure

- **Bug-Reports / Feature-Requests:** via [GitHub Issues](https://github.com/KlausiMagJeder/claude-cheatsheet-mcp/issues).
- **Sicherheitslücken NICHT öffentlich in Issues melden.** Stattdessen vertraulich gemäß [SECURITY.md](./SECURITY.md) disclosen.

## Fragen

Für offene Fragen und Diskussionen: GitHub Issues mit Label `question` oder Discussion (falls aktiviert).
