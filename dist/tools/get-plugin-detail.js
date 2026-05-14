// Plugin-zentrische Detail-Abfrage: gibt für einen Plugin-Namen alle
// installierten Assets (Skills, Commands, Agents, Hooks, MCP-Tools) gruppiert
// nach Kind plus Install-Metadaten zurück.
//
// WARUM nur diese 5 Kinds: Roles (~/.claude/jarvis/rolls/) und CLI-Builtins
// (src/static/cli-commands.json) sind nicht plugin-scoped und setzen
// metadata.plugin nicht. Siehe Bedarfsanalyse §2.1.
//
// Pure Function über `CatalogIndex` — kein Disk-I/O, kein neuer Scanner.
import { toShort } from '../types.js';
const PLUGIN_KINDS = ['skill', 'command', 'agent', 'hook', 'mcp_tool'];
const PLUGIN_KIND_SET = new Set(PLUGIN_KINDS);
function readStringMeta(meta, key) {
    const value = meta[key];
    return typeof value === 'string' ? value : null;
}
export function getPluginDetail(index, params) {
    const { pluginName } = params;
    // Filter: nur plugin-scoped Kinds (skill/command/agent/hook/mcp_tool) UND
    // exakter Match auf metadata.plugin (case-sensitive).
    const matching = index.entries.filter((e) => {
        if (!PLUGIN_KIND_SET.has(e.kind))
            return false;
        const meta = e.metadata;
        if (!meta)
            return false;
        return typeof meta.plugin === 'string' && meta.plugin === pluginName;
    });
    const buckets = {
        skill: [],
        command: [],
        agent: [],
        hook: [],
        mcp_tool: [],
    };
    for (const entry of matching) {
        buckets[entry.kind].push(entry);
    }
    // WARUM erstes Element: installed-plugins.ts macht das seit v0.3.1
    // (extractEntry Z.127-137). Multi-Install ist Future-Issue (F-2).
    const firstMeta = matching[0]?.metadata !== undefined ? matching[0].metadata : {};
    const version = readStringMeta(firstMeta, 'version');
    const marketplace = readStringMeta(firstMeta, 'marketplace');
    const installPath = readStringMeta(firstMeta, 'installPath');
    const toShortList = (arr) => arr.map(toShort);
    return {
        found: matching.length > 0,
        pluginName,
        version,
        marketplace,
        installPath,
        totals: {
            skills: buckets.skill.length,
            commands: buckets.command.length,
            agents: buckets.agent.length,
            hooks: buckets.hook.length,
            mcp_tools: buckets.mcp_tool.length,
        },
        entries: {
            skills: toShortList(buckets.skill),
            commands: toShortList(buckets.command),
            agents: toShortList(buckets.agent),
            hooks: toShortList(buckets.hook),
            mcp_tools: toShortList(buckets.mcp_tool),
        },
    };
}
//# sourceMappingURL=get-plugin-detail.js.map