import type { CatalogEntry } from '../types.js';
/**
 * Scannt MCP-Server-Registrierungen aus bis zu drei Quellen.
 *
 * @param settingsDir       Verzeichnis mit `settings.json` (Legacy, non-authoritative)
 * @param userConfigPath    Optional: Pfad zu `~/.claude.json` (autoritativ für User-Scope)
 * @param pluginsPath       Optional: `~/.claude/plugins/` (für Plugin-Scope)
 */
export declare function scanMcpTools(settingsDir: string, userConfigPath?: string, pluginsPath?: string): Promise<CatalogEntry[]>;
