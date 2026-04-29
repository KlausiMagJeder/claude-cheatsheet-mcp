export const ENTRY_KINDS = [
    'skill',
    'command',
    'agent',
    'mcp_tool',
    'cli_command',
    'hook',
    'role',
];
export const SCOPES = ['global', 'project'];
export function isEntryKind(value) {
    return ENTRY_KINDS.includes(value);
}
export function isScope(value) {
    return SCOPES.includes(value);
}
export function createEntryId(kind, name) {
    return `${kind}:${name}`;
}
export function toShort(entry) {
    return {
        id: entry.id,
        name: entry.name,
        description: entry.description,
        tags: entry.tags,
        scope: entry.scope,
    };
}
//# sourceMappingURL=types.js.map