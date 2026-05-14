import type { CatalogIndex, EntryShort } from '../types.js';
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
export declare function getPluginDetail(index: CatalogIndex, params: GetPluginDetailParams): PluginDetailResult;
