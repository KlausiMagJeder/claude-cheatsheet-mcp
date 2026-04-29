export const ENTRY_KINDS = [
  'skill',
  'command',
  'agent',
  'mcp_tool',
  'cli_command',
  'hook',
  'role',
] as const;

export type EntryKind = (typeof ENTRY_KINDS)[number];

export const SCOPES = ['global', 'project'] as const;

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

export function isEntryKind(value: string): value is EntryKind {
  return ENTRY_KINDS.includes(value as EntryKind);
}

export function isScope(value: string): value is Scope {
  return SCOPES.includes(value as Scope);
}

export function createEntryId(kind: EntryKind, name: string): string {
  return `${kind}:${name}`;
}

export function toShort(entry: CatalogEntry): EntryShort {
  return {
    id: entry.id,
    name: entry.name,
    description: entry.description,
    tags: entry.tags,
    scope: entry.scope,
  };
}
