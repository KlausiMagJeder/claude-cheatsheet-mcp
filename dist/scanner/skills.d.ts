import type { CatalogEntry } from '../types.js';
/**
 * Scannt alle Skills der installierten Plugins unter `pluginsPath`.
 *
 * @param pluginsPath Absoluter Pfad zu `~/.claude/plugins/` (injizierbar für Tests).
 * @returns Liste von `CatalogEntry` mit `kind: "skill"`.
 */
export declare function scanSkills(pluginsPath: string): Promise<CatalogEntry[]>;
