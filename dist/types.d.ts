export declare const ENTRY_KINDS: readonly ["skill", "command", "agent", "mcp_tool", "cli_command", "hook", "role"];
export type EntryKind = (typeof ENTRY_KINDS)[number];
export declare const SCOPES: readonly ["global", "project"];
export type Scope = (typeof SCOPES)[number];
export interface CatalogEntry {
    id: string;
    kind: EntryKind;
    name: string;
    description: string;
    tags: string[];
    scope: Scope;
    source: string;
    filePath?: string;
    metadata: Record<string, unknown>;
}
export interface CatalogIndex {
    entries: CatalogEntry[];
    scannedAt: Date;
    globalPath: string;
    projectPath?: string;
}
export interface EntryShort {
    id: string;
    name: string;
    description: string;
    tags: string[];
    scope: Scope;
}
export interface Suggestion {
    entry: EntryShort;
    relevance: number;
    reason: string;
}
export declare function isEntryKind(value: string): value is EntryKind;
export declare function isScope(value: string): value is Scope;
export declare function createEntryId(kind: EntryKind, name: string): string;
export declare function toShort(entry: CatalogEntry): EntryShort;
