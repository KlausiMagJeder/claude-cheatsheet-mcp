import type { CatalogIndex, EntryShort } from '../types.js';
import { toShort } from '../types.js';

interface ListMcpParams {
  server?: string;
}

export function listMcpTools(index: CatalogIndex, params: ListMcpParams): EntryShort[] {
  let entries = index.entries.filter((e) => e.kind === 'mcp_tool');

  if (params.server) {
    entries = entries.filter((e) => e.metadata.serverName === params.server);
  }

  return entries.map(toShort);
}
