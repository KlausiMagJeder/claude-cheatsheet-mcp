// Scanner für Agents (Subagent-Typen für den Task-Tool).
//
// Zwei Quellen:
//   1. Statische Built-in-Liste: `<staticDir>/agents-builtin.json`
//      (die 5 echten Claude-Code-Built-ins: general-purpose, Explore, Plan,
//      statusline-setup, claude-code-guide)
//   2. Plugin-Agents dynamisch:
//        <pluginsPath>/cache/<mp>/<plugin>/<version>/agents/*.md
//        <pluginsPath>/cache/<mp>/<plugin>/<version>/skills/<skill>/agents/*.md
//      (Skill-internal-Agents — empirisch bei `skill-creator` beobachtet.)
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { glob } from 'glob';
import matter from 'gray-matter';
import { createEntryId } from '../types.js';
export async function scanAgents(staticDir, pluginsPath) {
    const entries = [];
    // --- 1. Built-ins -------------------------------------------------------
    entries.push(...(await loadBuiltinAgents(staticDir)));
    // --- 2. Plugin-Agents (dynamisch) --------------------------------------
    if (pluginsPath !== undefined) {
        entries.push(...(await scanPluginAgents(pluginsPath)));
    }
    return entries;
}
async function loadBuiltinAgents(staticDir) {
    const filePath = path.join(staticDir, 'agents-builtin.json');
    let content;
    try {
        content = await fs.readFile(filePath, 'utf-8');
    }
    catch {
        return [];
    }
    // WARUM silent []: Konsistent mit anderen Scannern — malformed JSON
    // darf den gesamten Scanner nicht crashen (Promise.allSettled-Vertrag).
    let agents;
    try {
        agents = JSON.parse(content);
    }
    catch {
        return [];
    }
    return agents.map((agent) => ({
        id: createEntryId('agent', agent.name),
        kind: 'agent',
        name: agent.name,
        description: agent.description,
        tags: [],
        scope: 'global',
        source: agent.plugin ?? 'built-in',
        metadata: {
            plugin: agent.plugin,
        },
    }));
}
async function scanPluginAgents(pluginsPath) {
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
    // Dedup-Key: "<plugin>::<agent-name>". Ein Agent, der sowohl in /agents/
    // als auch in skills/<name>/agents/ auftaucht, wird nur einmal erfasst.
    const seen = new Set();
    for (const root of rootSet) {
        const ctx = deriveCtxFromPath(root, cacheDir);
        if (!ctx)
            continue;
        const agentFiles = await findPluginAgentFiles(ctx);
        for (const filePath of agentFiles) {
            const entry = await parseAgentFile(filePath, ctx);
            if (!entry)
                continue;
            const key = `${ctx.plugin}::${entry.name}`;
            if (seen.has(key))
                continue;
            seen.add(key);
            entries.push(entry);
        }
    }
    return entries;
}
async function findPluginAgentFiles(ctx) {
    const results = [];
    // a) <plugin-root>/agents/*.md
    try {
        const found = await glob('agents/*.md', { cwd: ctx.root, absolute: true, follow: true });
        results.push(...found);
    }
    catch {
        // silent
    }
    // b) <plugin-root>/skills/<skill>/agents/*.md (z.B. skill-creator/grader)
    try {
        const found = await glob('skills/*/agents/*.md', {
            cwd: ctx.root,
            absolute: true,
            follow: true,
        });
        results.push(...found);
    }
    catch {
        // silent
    }
    return results;
}
async function parseAgentFile(filePath, ctx) {
    let raw;
    try {
        raw = await fs.readFile(filePath, 'utf-8');
    }
    catch {
        return null;
    }
    let parsed;
    try {
        parsed = matter(raw);
    }
    catch {
        return null;
    }
    const data = parsed.data;
    const frontmatterName = typeof data.name === 'string' ? data.name.trim() : '';
    const fallbackName = path.basename(filePath, '.md');
    const name = frontmatterName.length > 0 ? frontmatterName : fallbackName;
    if (name.length === 0)
        return null;
    const description = typeof data.description === 'string' ? data.description.trim() : `Agent ${name}`;
    const metadata = {
        plugin: ctx.plugin,
        marketplace: ctx.marketplace,
        version: ctx.version,
    };
    if (typeof data.model === 'string')
        metadata.model = data.model;
    if (typeof data.color === 'string')
        metadata.color = data.color;
    return {
        id: createEntryId('agent', name),
        kind: 'agent',
        name,
        description,
        tags: [],
        scope: 'global',
        source: ctx.plugin,
        filePath,
        metadata,
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
//# sourceMappingURL=agents.js.map