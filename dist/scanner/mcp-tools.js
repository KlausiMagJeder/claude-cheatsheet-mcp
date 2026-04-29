// Scanner für MCP-Server-Registrierungen.
//
// Drei Quellen (Priorität absteigend — bei Namens-Kollision gewinnt die erste):
//   1. userConfigPath (~/.claude.json → mcpServers)  → metadata.mcpScope = "user"
//   2. pluginsPath (cache/<mp>/<plugin>/<version>/.mcp.json + plugin.json.mcpServers)
//                                                    → metadata.mcpScope = "plugin"
//   3. settingsDir/settings.json → mcpServers       → ohne mcpScope (Legacy, non-authoritative)
//
// Hintergrund: Laut Domain-Expert-Knowledge (claude-settings-hierarchie.md) ist
// `~/.claude.json` die **autoritative** Quelle für User-Scope-MCPs; das Feld
// `mcpServers` in `~/.claude/settings.json` existiert zwar schemaseitig, wird
// aber vom Claude-Code-CLI für die User-Scope-MCP-Erkennung nicht gelesen
// (Task-25-Lehre). Der Legacy-Read von settings.json bleibt für
// Rückwärtskompatibilität bestehen, wenn kein userConfigPath übergeben wird.
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { glob } from 'glob';
import { createEntryId } from '../types.js';
/**
 * Scannt MCP-Server-Registrierungen aus bis zu drei Quellen.
 *
 * @param settingsDir       Verzeichnis mit `settings.json` (Legacy, non-authoritative)
 * @param userConfigPath    Optional: Pfad zu `~/.claude.json` (autoritativ für User-Scope)
 * @param pluginsPath       Optional: `~/.claude/plugins/` (für Plugin-Scope)
 */
export async function scanMcpTools(settingsDir, userConfigPath, pluginsPath) {
    const entries = [];
    // Dedup: Ein Name wird pro (scope, name) nur einmal erfasst — User hat
    // Vorrang vor Plugin; Plugin darf denselben Namen aber parallel führen
    // (es ist ein anderer Scope und so für den Katalog auch unterscheidbar).
    const seenUserNames = new Set();
    // --- 1. User-Scope (~/.claude.json) ------------------------------------
    if (userConfigPath !== undefined) {
        const userServers = await readMcpServersFromJsonFile(userConfigPath);
        for (const [name, config] of Object.entries(userServers)) {
            if (seenUserNames.has(name))
                continue;
            seenUserNames.add(name);
            entries.push(buildEntry(name, config, userConfigPath, 'user'));
        }
    }
    // --- 2. Plugin-Scope ---------------------------------------------------
    if (pluginsPath !== undefined) {
        const pluginEntries = await scanPluginMcps(pluginsPath);
        entries.push(...pluginEntries);
    }
    // --- 3. Legacy: settings.json → mcpServers ------------------------------
    // WARUM: Solange kein userConfigPath gesetzt ist, bleibt dieser Pfad der
    // einzige Fall, in dem Legacy-Tests (und Altkonfigurationen ohne
    // ~/.claude.json) noch MCPs melden. Einträge erhalten KEIN mcpScope-Feld,
    // damit neue Filter darauf verzichten können.
    if (userConfigPath === undefined) {
        const settingsPath = path.join(settingsDir, 'settings.json');
        const legacyServers = await readMcpServersFromJsonFile(settingsPath);
        for (const [name, config] of Object.entries(legacyServers)) {
            entries.push(buildEntry(name, config, settingsPath, null));
        }
    }
    return entries;
}
/**
 * Liest `mcpServers` aus einer beliebigen JSON-Datei. Tolerant gegenüber
 * fehlender Datei, malformed JSON und abweichenden Strukturen.
 */
async function readMcpServersFromJsonFile(filePath) {
    let raw;
    try {
        raw = await fs.readFile(filePath, 'utf-8');
    }
    catch {
        return {};
    }
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch {
        return {};
    }
    if (!parsed || typeof parsed !== 'object')
        return {};
    const carrier = parsed;
    if (!carrier.mcpServers || typeof carrier.mcpServers !== 'object')
        return {};
    return carrier.mcpServers;
}
/**
 * Scannt Plugin-MCPs aus zwei Quellen pro Plugin-Root:
 *   a) `<plugin-root>/.mcp.json`             (beobachtet bei claude-mem)
 *   b) `<plugin-root>/.claude-plugin/plugin.json → mcpServers` (Schema-Variante)
 */
async function scanPluginMcps(pluginsPath) {
    const cacheDir = path.join(pluginsPath, 'cache');
    let exists = false;
    try {
        const st = await fs.stat(cacheDir);
        exists = st.isDirectory();
    }
    catch {
        exists = false;
    }
    if (!exists)
        return [];
    // Plugin-Root-Discovery analog zum Skills-Scanner: Standard-Layout und
    // defensiv Scoped-Packages.
    const patterns = ['*/*/*/', '*/@*/*/*/'];
    const rootSet = new Set();
    for (const pattern of patterns) {
        let matches;
        try {
            matches = await glob(pattern, {
                cwd: cacheDir,
                absolute: true,
                follow: true,
                nodir: false,
            });
        }
        catch {
            continue;
        }
        for (const m of matches)
            rootSet.add(path.resolve(m));
    }
    const entries = [];
    const seen = new Set();
    for (const root of rootSet) {
        const ctx = deriveCtxFromPath(root, cacheDir);
        if (!ctx)
            continue;
        // a) .mcp.json
        const mcpJson = await readMcpServersFromJsonFile(path.join(root, '.mcp.json'));
        for (const [name, cfg] of Object.entries(mcpJson)) {
            const key = `${ctx.plugin}::${name}`;
            if (seen.has(key))
                continue;
            seen.add(key);
            entries.push(buildPluginEntry(name, cfg, path.join(root, '.mcp.json'), ctx));
        }
        // b) plugin.json → mcpServers
        const manifestServers = await readPluginManifestMcpServers(root);
        for (const [name, cfg] of Object.entries(manifestServers)) {
            const key = `${ctx.plugin}::${name}`;
            if (seen.has(key))
                continue;
            seen.add(key);
            entries.push(buildPluginEntry(name, cfg, path.join(root, '.claude-plugin', 'plugin.json'), ctx));
        }
    }
    return entries;
}
async function readPluginManifestMcpServers(pluginRoot) {
    const manifestPath = path.join(pluginRoot, '.claude-plugin', 'plugin.json');
    let raw;
    try {
        raw = await fs.readFile(manifestPath, 'utf-8');
    }
    catch {
        return {};
    }
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch {
        return {};
    }
    if (!parsed || typeof parsed !== 'object')
        return {};
    const m = parsed;
    if (!m.mcpServers || typeof m.mcpServers !== 'object')
        return {};
    return m.mcpServers;
}
function deriveCtxFromPath(pluginRoot, cacheDir) {
    const rel = path.relative(cacheDir, pluginRoot);
    const segments = rel.split(path.sep).filter((s) => s.length > 0);
    if (segments.length === 3) {
        const [marketplace, plugin, version] = segments;
        if (!marketplace || !plugin || !version)
            return null;
        return { plugin, marketplace, version };
    }
    if (segments.length === 4 && segments[1]?.startsWith('@')) {
        const [marketplace, scope, pluginName, version] = segments;
        if (!marketplace || !scope || !pluginName || !version)
            return null;
        return { plugin: `${scope}/${pluginName}`, marketplace, version };
    }
    return null;
}
function buildEntry(name, config, source, mcpScope) {
    const metadata = {
        command: config.command,
        args: config.args,
        env: config.env,
    };
    if (mcpScope !== null)
        metadata.mcpScope = mcpScope;
    return {
        id: createEntryId('mcp_tool', name),
        kind: 'mcp_tool',
        name,
        description: `MCP server: ${name}`,
        tags: [],
        scope: 'global',
        source,
        metadata,
    };
}
function buildPluginEntry(name, config, source, ctx) {
    return {
        id: createEntryId('mcp_tool', name),
        kind: 'mcp_tool',
        name,
        description: `MCP server: ${name}`,
        tags: [],
        scope: 'global',
        source,
        metadata: {
            command: config.command,
            args: config.args,
            env: config.env,
            mcpScope: 'plugin',
            plugin: ctx.plugin,
            marketplace: ctx.marketplace,
            version: ctx.version,
        },
    };
}
//# sourceMappingURL=mcp-tools.js.map