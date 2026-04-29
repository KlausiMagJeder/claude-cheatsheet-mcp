import type { CatalogEntry } from '../types.js';
export declare function generateTags(entry: CatalogEntry, content?: string): string[];
export interface TagOverride {
    add: string[];
    remove: string[];
}
export declare function applyOverrides(tags: string[], overrides: Record<string, TagOverride>, entryId: string): string[];
