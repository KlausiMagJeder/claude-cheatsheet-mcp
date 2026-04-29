import type { CatalogIndex, EntryKind, EntryShort } from '../types.js';
import { toShort } from '../types.js';

export interface ListParams {
  scope?: 'global' | 'project' | 'all';
}

export function createListHandler(kind: EntryKind) {
  return function handler(index: CatalogIndex, params: ListParams): EntryShort[] {
    let entries = index.entries.filter((e) => e.kind === kind);

    if (params.scope && params.scope !== 'all') {
      entries = entries.filter((e) => e.scope === params.scope);
    }

    return entries.map(toShort);
  };
}

export const listSkills = createListHandler('skill');
