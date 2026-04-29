import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { CatalogEntry } from '../types.js';
import { createEntryId } from '../types.js';

/**
 * Scannt `<homeDir>/.claude/jarvis/rolls/`-Unterordner.
 * Pro Rolle wird die gleichnamige `.md`-Datei als Beschreibung gelesen.
 *
 * @param homeDir Absoluter Pfad zum Home-Verzeichnis (injizierbar für Tests).
 * @returns Liste von `CatalogEntry` mit `kind: "role"`.
 */
export async function scanRoles(homeDir: string): Promise<CatalogEntry[]> {
  const rollsDir = path.join(homeDir, 'jarvis', 'rolls');

  let dirEntries: string[];
  try {
    dirEntries = await fs.readdir(rollsDir);
  } catch {
    return [];
  }

  const entries: CatalogEntry[] = [];

  for (const name of dirEntries) {
    const entryPath = path.join(rollsDir, name);

    let stat;
    try {
      stat = await fs.stat(entryPath);
    } catch {
      continue;
    }

    if (!stat.isDirectory()) continue;

    const mdFile = path.join(entryPath, `${name}.md`);
    let description = '';
    try {
      const raw = await fs.readFile(mdFile, 'utf-8');
      description = extractDescription(raw);
    } catch {
      // No .md file — description stays empty
    }

    entries.push({
      id: createEntryId('role', name),
      kind: 'role',
      name,
      description,
      tags: [],
      scope: 'global',
      source: 'jarvis',
      filePath: mdFile,
      metadata: {},
    });
  }

  return entries;
}

/**
 * Extrahiert die erste nicht-leere Textzeile nach der H1-Überschrift
 * als kurze Beschreibung. Fallback: leer.
 */
function extractDescription(raw: string): string {
  const lines = raw.split('\n');
  let afterH1 = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!afterH1) {
      if (trimmed.startsWith('# ')) afterH1 = true;
      continue;
    }
    if (trimmed.length > 0 && !trimmed.startsWith('#')) {
      return trimmed.replace(/^\*\*.*?\*\*\s*/, '').trim();
    }
  }
  return '';
}
