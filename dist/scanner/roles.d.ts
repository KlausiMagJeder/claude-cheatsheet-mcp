import type { CatalogEntry } from '../types.js';
/**
 * Scannt `<homeDir>/.claude/jarvis/rolls/`-Unterordner.
 * Pro Rolle wird die gleichnamige `.md`-Datei als Beschreibung gelesen.
 *
 * @param homeDir Absoluter Pfad zum Home-Verzeichnis (injizierbar für Tests).
 * @returns Liste von `CatalogEntry` mit `kind: "role"`.
 */
export declare function scanRoles(homeDir: string): Promise<CatalogEntry[]>;
