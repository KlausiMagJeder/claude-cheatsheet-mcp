import type { CatalogIndex, EntryKind, EntryShort } from '../types.js';
export interface ListParams {
    scope?: 'global' | 'project' | 'all';
}
export declare function createListHandler(kind: EntryKind): (index: CatalogIndex, params: ListParams) => EntryShort[];
export declare const listSkills: (index: CatalogIndex, params: ListParams) => EntryShort[];
