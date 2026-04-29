import type { CatalogEntry, CatalogIndex, EntryKind } from '../types.js';
export interface SearchOptions {
    query: string;
    kind?: EntryKind;
}
export declare function search(index: CatalogIndex, options: SearchOptions): CatalogEntry[];
