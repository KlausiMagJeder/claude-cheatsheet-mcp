import type { CatalogEntry } from '../types.js';
/**
 * Scans hooks from global, project, user-config and plugin sources.
 *
 * @param globalPath     Path to the global `.claude` directory (contains settings.json)
 * @param projectPath    Optional path to project root (`.claude/settings.json` inside)
 * @param userConfigPath Optional path to `~/.claude.json` (user-scope hooks)
 * @param pluginsPath    Optional path to `~/.claude/plugins/` (plugin-scope hooks)
 */
export declare function scanHooks(globalPath: string, projectPath?: string, userConfigPath?: string, pluginsPath?: string): Promise<CatalogEntry[]>;
