import type { CatalogIndex, EntryShort } from '../types.js';
interface ListMcpParams {
    server?: string;
}
export declare function listMcpTools(index: CatalogIndex, params: ListMcpParams): EntryShort[];
export {};
