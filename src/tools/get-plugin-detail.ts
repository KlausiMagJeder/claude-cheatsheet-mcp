// Plugin-zentrische Detail-Abfrage: gibt für einen Plugin-Namen alle
// installierten Assets (Skills, Commands, Agents, Hooks, MCP-Tools) gruppiert
// nach Kind plus Install-Metadaten zurück.
//
// Pure Function über `CatalogIndex` — kein Disk-I/O, kein neuer Scanner.
import type { CatalogEntry, CatalogIndex, EntryShort } from '../types.js';
import { toShort } from '../types.js';

export interface GetPluginDetailParams {
  pluginName: string;
}

export interface PluginDetailResult {
  found: boolean;
  pluginName: string;
  version: string | null;
  marketplace: string | null;
  installPath: string | null;
  totals: {
    skills: number;
    commands: number;
    agents: number;
    hooks: number;
    mcp_tools: number;
  };
  entries: {
    skills: EntryShort[];
    commands: EntryShort[];
    agents: EntryShort[];
    hooks: EntryShort[];
    mcp_tools: EntryShort[];
  };
}

const PLUGIN_KINDS = ['skill', 'command', 'agent', 'hook', 'mcp_tool'] as const;
type PluginKind = (typeof PLUGIN_KINDS)[number];
const PLUGIN_KIND_SET: ReadonlySet<string> = new Set(PLUGIN_KINDS);

function readStringMeta(meta: Record<string, unknown>, key: string): string | null {
  const value = meta[key];
  return typeof value === 'string' ? value : null;
}

export function getPluginDetail(
  index: CatalogIndex,
  params: GetPluginDetailParams,
): PluginDetailResult {
  const { pluginName } = params;

  // Filter: nur plugin-scoped Kinds (skill/command/agent/hook/mcp_tool) UND
  // exakter Match auf metadata.plugin (case-sensitive).
  const matching: CatalogEntry[] = index.entries.filter((e) => {
    if (!PLUGIN_KIND_SET.has(e.kind)) return false;
    const meta = e.metadata as Record<string, unknown> | undefined;
    if (!meta) return false;
    return typeof meta.plugin === 'string' && meta.plugin === pluginName;
  });

  const buckets: Record<PluginKind, CatalogEntry[]> = {
    skill: [],
    command: [],
    agent: [],
    hook: [],
    mcp_tool: [],
  };
  for (const entry of matching) {
    buckets[entry.kind as PluginKind].push(entry);
  }

  // WARUM erstes Element: installed-plugins.ts macht das seit v0.3.1
  // (extractEntry Z.127-137). Multi-Install ist Future-Issue (F-2).
  const firstMeta: Record<string, unknown> =
    matching[0]?.metadata !== undefined ? (matching[0].metadata as Record<string, unknown>) : {};

  const version = readStringMeta(firstMeta, 'version');
  const marketplace = readStringMeta(firstMeta, 'marketplace');
  const installPath = readStringMeta(firstMeta, 'installPath');

  const toShortList = (arr: CatalogEntry[]): EntryShort[] => arr.map(toShort);

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
