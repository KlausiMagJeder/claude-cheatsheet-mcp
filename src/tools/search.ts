import type { CatalogEntry, CatalogIndex, EntryKind } from '../types.js';

export interface SearchOptions {
  query: string;
  kind?: EntryKind;
}

export function search(index: CatalogIndex, options: SearchOptions): CatalogEntry[] {
  const q = options.query.toLowerCase();

  return index.entries.filter((entry) => {
    if (options.kind !== undefined && entry.kind !== options.kind) {
      return false;
    }
    return (
      entry.name.toLowerCase().includes(q) ||
      entry.description.toLowerCase().includes(q) ||
      entry.tags.some((tag) => tag.toLowerCase().includes(q))
    );
  });
}
