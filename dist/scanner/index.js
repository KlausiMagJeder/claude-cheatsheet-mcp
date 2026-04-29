import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { generateTags, applyOverrides } from '../tagger/index.js';
import { scanSkills } from './skills.js';
import { scanCommands } from './commands.js';
import { scanAgents } from './agents.js';
import { scanMcpTools } from './mcp-tools.js';
import { scanHooks } from './hooks.js';
import { scanRoles } from './roles.js';
import { scanCliBuiltins } from './cli-builtins.js';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_STATIC_DIR = path.resolve(__dirname, '..', 'static');
/**
 * Baut den Katalog-Index auf, indem alle Scanner parallel ausgeführt werden.
 *
 * @param globalPath     Absoluter Pfad zu `~/.claude/` (settings.json, commands/, …)
 * @param projectPath    Optional: Projekt-Root für `.claude/settings.json` + `.claude/commands/`
 * @param staticDir      Verzeichnis mit statischen Katalog-Dateien
 * @param userConfigPath Optional: Pfad zu `~/.claude.json` (User-Scope-Settings, authoritative für User-MCPs + User-Hooks). Default: `~/.claude.json`.
 * @param pluginsPath    Optional: Pfad zu `~/.claude/plugins/`. Default: `<globalPath>/plugins`.
 */
export async function buildIndex(globalPath, projectPath, staticDir = DEFAULT_STATIC_DIR, userConfigPath = path.join(os.homedir(), '.claude.json'), pluginsPath = path.join(globalPath, 'plugins')) {
    // Run all scanners in parallel; tolerate individual failures.
    const results = await Promise.allSettled([
        scanSkills(pluginsPath),
        scanCommands(globalPath, projectPath, pluginsPath),
        scanAgents(staticDir, pluginsPath),
        scanMcpTools(globalPath, userConfigPath, pluginsPath),
        scanHooks(globalPath, projectPath, userConfigPath, pluginsPath),
        scanRoles(globalPath),
        scanCliBuiltins(staticDir),
    ]);
    const entries = results.flatMap((result) => result.status === 'fulfilled' ? result.value : []);
    // Load tag overrides (optional).
    let overrides = {};
    try {
        const overridesPath = path.join(staticDir, 'tag-overrides.json');
        const content = await fs.readFile(overridesPath, 'utf-8');
        overrides = JSON.parse(content);
    }
    catch {
        // No overrides file — fine.
    }
    // Apply tagger to every entry.
    //
    // WARUM Merge statt Überschreiben: Einige Scanner setzen bereits Tags
    // (Skills-Scanner aus Frontmatter `tags:`, Hooks-Scanner mit Event-Tag).
    // Diese Pre-Tags dürfen durch `generateTags` nicht verloren gehen.
    // Reihenfolge: existing + auto-generated → applyOverrides. So können
    // Overrides sowohl Pre-Tags als auch Auto-Tags ergänzen/entfernen.
    for (const entry of entries) {
        const generated = generateTags(entry);
        const merged = Array.from(new Set([...entry.tags, ...generated]));
        entry.tags = applyOverrides(merged, overrides, entry.id);
    }
    return {
        entries,
        scannedAt: new Date(),
        globalPath,
        projectPath,
    };
}
//# sourceMappingURL=index.js.map