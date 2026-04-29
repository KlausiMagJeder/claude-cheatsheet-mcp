import type { CatalogIndex } from '../types.js';
/**
 * Baut den Katalog-Index auf, indem alle Scanner parallel ausgeführt werden.
 *
 * @param globalPath     Absoluter Pfad zu `~/.claude/` (settings.json, commands/, …)
 * @param projectPath    Optional: Projekt-Root für `.claude/settings.json` + `.claude/commands/`
 * @param staticDir      Verzeichnis mit statischen Katalog-Dateien
 * @param userConfigPath Optional: Pfad zu `~/.claude.json` (User-Scope-Settings, authoritative für User-MCPs + User-Hooks). Default: `~/.claude.json`.
 * @param pluginsPath    Optional: Pfad zu `~/.claude/plugins/`. Default: `<globalPath>/plugins`.
 */
export declare function buildIndex(globalPath: string, projectPath?: string, staticDir?: string, userConfigPath?: string, pluginsPath?: string): Promise<CatalogIndex>;
