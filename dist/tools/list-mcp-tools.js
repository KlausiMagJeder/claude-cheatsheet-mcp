import { toShort } from '../types.js';
export function listMcpTools(index, params) {
    let entries = index.entries.filter((e) => e.kind === 'mcp_tool');
    if (params.server) {
        entries = entries.filter((e) => e.metadata.serverName === params.server);
    }
    return entries.map(toShort);
}
//# sourceMappingURL=list-mcp-tools.js.map