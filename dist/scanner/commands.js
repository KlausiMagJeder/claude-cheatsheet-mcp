// Scanner für Slash-Commands aus drei Quellen:
//   1. Global:       <globalPath>/commands/*.md
//   2. Projekt:      <projectPath>/.claude/commands/*.md
//   3. Plugins:      <pluginsPath>/cache/<mp>/<plugin>/<version>/commands/*.md
//                    Autoritativ ist `plugin.json → commands` (wenn gesetzt);
//                    fehlt das Feld, fällt der Scanner auf den Konventions-Ordner
//                    `commands/` zurück (siehe Domain-Expert-Knowledge
//                    `claude-plugins-dirstruktur.md` § 5.3 / 6.3).
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import matter from 'gray-matter';
import { glob } from 'glob';
import { createEntryId } from '../types.js';
export async function scanCommands(globalPath, projectPath, pluginsPath) {
    const entries = [];
    // Global commands: <globalPath>/commands/*.md
    const globalDir = path.join(globalPath, 'commands');
    entries.push(...(await scanCommandDir(globalDir, 'global')));
    // Project commands: <projectPath>/.claude/commands/*.md
    if (projectPath !== undefined) {
        const projectDir = path.join(projectPath, '.claude', 'commands');
        entries.push(...(await scanCommandDir(projectDir, 'project')));
    }
    // Plugin commands
    if (pluginsPath !== undefined) {
        entries.push(...(await scanPluginCommands(pluginsPath)));
    }
    return entries;
}
async function scanCommandDir(dir, scope) {
    const entries = [];
    const pattern = path.join(dir, '*.md');
    let files;
    try {
        files = await glob(pattern);
    }
    catch {
        return [];
    }
    for (const filePath of files) {
        const entry = await parseCommandFile(filePath, scope);
        if (entry) {
            if (scope === 'project')
                entry.metadata['projectPath'] = dir;
            entries.push(entry);
        }
    }
    return entries;
}
async function parseCommandFile(filePath, scope) {
    let content;
    try {
        content = await fs.readFile(filePath, 'utf-8');
    }
    catch {
        return null;
    }
    let parsed;
    try {
        parsed = matter(content);
    }
    catch {
        return null;
    }
    const frontmatter = parsed.data;
    const basename = path.basename(filePath, '.md');
    const name = `/${basename}`;
    const description = typeof frontmatter['description'] === 'string'
        ? frontmatter['description']
        : extractFirstParagraph(content);
    return {
        id: createEntryId('command', name),
        kind: 'command',
        name,
        description,
        tags: [],
        scope,
        source: filePath,
        filePath,
        metadata: {},
    };
}
async function scanPluginCommands(pluginsPath) {
    const cacheDir = path.join(pluginsPath, 'cache');
    let exists = false;
    try {
        const st = await fs.stat(cacheDir);
        exists = st.isDirectory();
    }
    catch {
        return [];
    }
    if (!exists)
        return [];
    const patterns = ['*/*/*/', '*/@*/*/*/'];
    const rootSet = new Set();
    for (const pattern of patterns) {
        let matches;
        try {
            matches = await glob(pattern, { cwd: cacheDir, absolute: true, follow: true, nodir: false });
        }
        catch {
            continue;
        }
        for (const m of matches)
            rootSet.add(path.resolve(m));
    }
    const entries = [];
    for (const root of rootSet) {
        const ctx = deriveCtxFromPath(root, cacheDir);
        if (!ctx)
            continue;
        const filePaths = await findPluginCommandFiles(ctx);
        for (const filePath of filePaths) {
            const entry = await parsePluginCommandFile(filePath, ctx);
            if (entry)
                entries.push(entry);
        }
    }
    return entries;
}
/**
 * Findet Command-Dateien für ein Plugin.
 *
 * Reihenfolge:
 *   1. `plugin.json → commands`-Array (autoritativ) — wenn vorhanden, werden
 *      ausschließlich diese Pfade verwendet.
 *   2. Fallback: `<plugin-root>/commands/*.md`
 *
 * Path-Traversal-Schutz: Deklarationen, die mit `path.resolve` außerhalb des
 * Plugin-Roots landen, werden verworfen.
 */
async function findPluginCommandFiles(ctx) {
    const declared = await readDeclaredCommandPaths(ctx.root);
    if (declared !== null) {
        const results = [];
        for (const rel of declared) {
            const resolved = path.resolve(ctx.root, rel);
            if (!isUnderRoot(resolved, ctx.root))
                continue;
            // `resolved` kann eine konkrete .md-Datei sein ODER ein Ordner,
            // in dem Commands liegen. Beide Fälle defensiv behandeln.
            let stat;
            try {
                stat = await fs.stat(resolved);
            }
            catch {
                // Vielleicht deklariert plugin.json den Namen ohne .md-Endung —
                // typisch "./commands/setup" statt ".../setup.md". Einen .md-Fallback probieren.
                try {
                    await fs.stat(`${resolved}.md`);
                    results.push(`${resolved}.md`);
                }
                catch {
                    // silent
                }
                continue;
            }
            if (stat.isFile()) {
                results.push(resolved);
            }
            else if (stat.isDirectory()) {
                try {
                    const mds = await glob('*.md', { cwd: resolved, absolute: true });
                    results.push(...mds);
                }
                catch {
                    // silent
                }
            }
        }
        return results;
    }
    // Fallback: Konvention `commands/*.md`
    const commandsDir = path.join(ctx.root, 'commands');
    try {
        const stat = await fs.stat(commandsDir);
        if (!stat.isDirectory())
            return [];
    }
    catch {
        return [];
    }
    try {
        return await glob('*.md', { cwd: commandsDir, absolute: true });
    }
    catch {
        return [];
    }
}
async function readDeclaredCommandPaths(pluginRoot) {
    const manifestPath = path.join(pluginRoot, '.claude-plugin', 'plugin.json');
    let raw;
    try {
        raw = await fs.readFile(manifestPath, 'utf-8');
    }
    catch {
        return null;
    }
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch {
        return null;
    }
    if (!parsed || typeof parsed !== 'object')
        return null;
    const commands = parsed.commands;
    if (!Array.isArray(commands))
        return null;
    return commands.filter((c) => typeof c === 'string');
}
async function parsePluginCommandFile(filePath, ctx) {
    let content;
    try {
        content = await fs.readFile(filePath, 'utf-8');
    }
    catch {
        return null;
    }
    let parsed;
    try {
        parsed = matter(content);
    }
    catch {
        return null;
    }
    const frontmatter = parsed.data;
    const basename = path.basename(filePath, '.md');
    const name = `/${basename}`;
    const description = typeof frontmatter['description'] === 'string'
        ? frontmatter['description']
        : extractFirstParagraph(content);
    return {
        id: createEntryId('command', name),
        kind: 'command',
        name,
        description,
        tags: [],
        // Plugin-Commands sind im globalen Kosmos sichtbar; Differenzierung
        // erfolgt über metadata.plugin.
        scope: 'global',
        source: filePath,
        filePath,
        metadata: {
            plugin: ctx.plugin,
            marketplace: ctx.marketplace,
            version: ctx.version,
        },
    };
}
function deriveCtxFromPath(pluginRoot, cacheDir) {
    const rel = path.relative(cacheDir, pluginRoot);
    const segments = rel.split(path.sep).filter((s) => s.length > 0);
    if (segments.length === 3) {
        const [marketplace, plugin, version] = segments;
        if (!marketplace || !plugin || !version)
            return null;
        return { root: pluginRoot, plugin, marketplace, version };
    }
    if (segments.length === 4 && segments[1]?.startsWith('@')) {
        const [marketplace, scope, pluginName, version] = segments;
        if (!marketplace || !scope || !pluginName || !version)
            return null;
        return { root: pluginRoot, plugin: `${scope}/${pluginName}`, marketplace, version };
    }
    return null;
}
function isUnderRoot(resolved, root) {
    if (resolved === root)
        return true;
    return resolved.startsWith(root + path.sep);
}
/** Extracts the first non-empty paragraph after the front-matter block. */
function extractFirstParagraph(content) {
    const lines = content.split('\n');
    const textLines = [];
    let inFrontmatter = false;
    let pastFrontmatter = false;
    for (const line of lines) {
        if (line.trim() === '---') {
            if (!pastFrontmatter) {
                inFrontmatter = !inFrontmatter;
                if (!inFrontmatter)
                    pastFrontmatter = true;
                continue;
            }
        }
        if (inFrontmatter)
            continue;
        if (line.trim() === '' && textLines.length > 0)
            break;
        if (line.trim() !== '')
            textLines.push(line.trim());
    }
    return textLines.join(' ').slice(0, 200);
}
//# sourceMappingURL=commands.js.map