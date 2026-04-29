# Security Policy

## Supported Versions

Nur die jeweils aktuelle Minor-Version erhält Security-Fixes. Frühere Versionen werden nicht zurückgepatcht, solange das Projekt noch im `0.x`-Bereich ist (Semver: Breaking-Changes auch in Minor-Bumps möglich).

| Version | Supported          |
| ------- | ------------------ |
| 0.3.x   | Ja (aktuelle Line) |
| < 0.3   | Nein               |

## Reporting a Vulnerability

**Bitte keine Sicherheitslücken in öffentlichen GitHub-Issues melden.** Nutze stattdessen einen der folgenden vertraulichen Wege:

1. **GitHub Security Advisory (bevorzugt):** „Report a vulnerability" auf der Repository-Seite (<https://github.com/KlausiMagJeder/claude-cheatsheet-mcp/security/advisories/new>). Dieser Weg erstellt ein privates Advisory, auf das nur Maintainer und die meldende Person Zugriff haben.
2. **Alternativ per E-Mail:** `5804944+KlausiMagJeder@users.noreply.github.com` — verschlüsselte Kommunikation bevorzugt.

**Erwartete Informationen im Report:**

- Betroffene Version(en) und Komponente (z.B. Web-Dashboard, Scanner, `register.sh`).
- Reproduktions-Schritte.
- Mögliche Auswirkungen.
- Optional: Patch-Vorschlag.

**Antwort-Zeit:** Ziel ist eine erste Bestätigung innerhalb von 7 Tagen. Abschließender Fix und koordinierte Veröffentlichung je nach Schweregrad, aber in der Regel innerhalb 30 Tagen.

## Threat Model / Design-Annahmen

Der Server ist für **lokale Nutzung** konzipiert und bindet ausschließlich an `127.0.0.1` (Loopback). Daraus ergeben sich folgende Invarianten, die beim Melden berücksichtigt werden sollten:

- **Loopback-Bind:** Das Web-Dashboard (`http://127.0.0.1:37778`) ist nicht aus dem LAN erreichbar. Ein externer Angreifer ohne lokalen Shell-Zugriff hat keine Netzwerk-Angriffsfläche.
- **Path-Traversal-Schutz:** `get_detail` validiert den angeforderten Pfad gegen eine Allowlist (`~/.claude/` sowie expliziter Projekt-Scope). Versuche, daraus auszubrechen, gelten als Bug und sollen gemeldet werden.
- **XSS-Schutz im Dashboard:** User-gelieferte Strings werden über `escHtml`-Pattern auf `textContent`-Basis eskapet; kein `innerHTML`-Injection-Point.
- **Stdio-Reinheit:** Der MCP-Server schreibt nie nach stdout außer MCP-JSON-RPC-Frames — Logs gehen konsequent nach stderr.
- **Keine externe Netzwerk-Kommunikation:** Der Server ruft keine externen Dienste auf.

**Was NICHT im Scope des Threat-Models ist:** Schutz gegen lokale Angreifer mit Shell-Zugriff auf den User-Account. Wer Shell-Zugriff hat, kann `~/.claude/`-Inhalte ohnehin direkt lesen. Lokale **Privilege-Escalation**-Szenarien (z.B. `register.sh` schreibt in falsche Settings-Datei mit zerstörenden Seiteneffekten) sind jedoch explizit im Scope — bitte melden.

## Out of Scope

- Verwundbarkeiten in abhängigen Third-Party-Paketen (bitte direkt upstream melden; wir updaten die Dependencies zeitnah, sobald Fixes verfügbar sind).
- Angriffe, die physischen Zugriff auf den lokalen Rechner voraussetzen.
- DoS-Szenarien gegen den lokalen Loopback-Dashboard.

## Credits

Meldende Personen werden — soweit gewünscht — im CHANGELOG und / oder Security-Advisory namentlich genannt.
