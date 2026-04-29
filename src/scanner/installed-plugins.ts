// Parser für ~/.claude/plugins/installed_plugins.json.
//
// Schlüssel-Konvention: "<plugin>@<marketplace>".
// Value enthält mindestens { version, installPath }.
//
// Defensives Fehler-Handling: Fehlende Datei oder malformed JSON liefert null
// zurück, sodass der Caller (Skills-Scanner) sauber auf Glob-Discovery fallen
// kann — KEINE Exceptions. Das ist bewusst silent-fallback-OK, siehe Design
// in `~/.claude/jarvis/rolls/domain-expert/output/claude-code-platform/knowledge/claude-plugins-dirstruktur.md`.

import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export interface InstalledPluginRef {
  plugin: string;
  marketplace: string;
  version: string;
  installPath: string;
}

interface RawEntry {
  version?: unknown;
  installPath?: unknown;
}

/**
 * Liest und parst `<pluginsPath>/installed_plugins.json`.
 *
 * @param pluginsPath Absoluter Pfad zu `~/.claude/plugins/` (oder ein Testordner).
 * @returns Array der installierten Plugin-Refs — oder `null`, wenn die Datei
 *          fehlt bzw. nicht geparst werden kann (Caller fällt dann auf Glob).
 */
export async function readInstalledPlugins(
  pluginsPath: string,
): Promise<InstalledPluginRef[] | null> {
  const filePath = path.join(pluginsPath, 'installed_plugins.json');

  let raw: string;
  try {
    raw = await fs.readFile(filePath, 'utf-8');
  } catch {
    // Datei fehlt → Caller soll Glob-Fallback nutzen.
    return null;
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    // Malformed JSON → Fallback auf Glob, nicht crashen.
    return null;
  }

  if (!json || typeof json !== 'object' || Array.isArray(json)) {
    return null;
  }

  const root = json as Record<string, unknown>;
  const entriesSource = selectEntriesSource(root);
  if (entriesSource === null) {
    // Unbekanntes Schema → Caller soll Glob-Fallback nutzen.
    return null;
  }

  const refs: InstalledPluginRef[] = [];
  for (const [key, value] of Object.entries(entriesSource)) {
    const entry = extractEntry(value);
    if (!entry) continue;
    if (typeof entry.installPath !== 'string' || entry.installPath.length === 0) {
      continue;
    }

    // Key-Format: "<plugin>@<marketplace>".
    // Bei scoped Packages kann `@` mehrfach vorkommen (z.B. "@acme/tool@mp").
    // Defensiv: den LETZTEN `@` als Separator verwenden, damit der Scope-Prefix
    // erhalten bleibt.
    const atIdx = key.lastIndexOf('@');
    const plugin = atIdx > 0 ? key.slice(0, atIdx) : key;
    const marketplace = atIdx > 0 ? key.slice(atIdx + 1) : 'unknown';

    const version =
      typeof entry.version === 'string' && entry.version.length > 0 ? entry.version : 'unknown';

    refs.push({
      plugin,
      marketplace,
      version,
      installPath: entry.installPath,
    });
  }

  return refs;
}

/**
 * Wählt den Source-Record für Plugin-Einträge abhängig vom Schema.
 *
 * v2: Root hat numerisches `version`-Feld und ein `plugins`-Object.
 * v1: Root-Keys sind direkt Plugin-Namen (keine numerische `version`).
 *
 * @returns Record oder null, falls das Schema nicht erkannt wird.
 */
function selectEntriesSource(root: Record<string, unknown>): Record<string, unknown> | null {
  const versionField = root.version;
  const pluginsField = root.plugins;

  if (typeof versionField === 'number') {
    if (pluginsField && typeof pluginsField === 'object' && !Array.isArray(pluginsField)) {
      return pluginsField as Record<string, unknown>;
    }
    // v2-Marker vorhanden, aber `plugins` fehlt/ungültig → unbekanntes Schema.
    return null;
  }

  // Kein numerisches `version` → v1-Shape: Root-Keys = Plugin-Namen.
  // Defensiv: leeres Root-Object zählt als gültiger v1-Input (0 Einträge).
  return root;
}

/**
 * Normalisiert einen Plugin-Eintrag zu einer flachen Metadaten-Shape.
 *
 * v2 serialisiert den Eintrag als Array (typischerweise mit einem Element pro
 * Scope). v1 verwendet direkt ein Object. Beides auf ein Object mit den
 * benötigten Feldern mappen.
 */
function extractEntry(value: unknown): RawEntry | null {
  if (Array.isArray(value)) {
    const first = value[0];
    if (!first || typeof first !== 'object') return null;
    return first as RawEntry;
  }
  if (value && typeof value === 'object') {
    return value as RawEntry;
  }
  return null;
}
