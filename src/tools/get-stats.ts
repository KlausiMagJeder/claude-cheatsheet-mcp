import type { CatalogIndex } from '../types.js';

interface StatsResult {
  total: number;
  byKind: Record<string, number>;
  scannedAt: string;
  globalPath: string;
  projectPath?: string;
}

export function getStats(index: CatalogIndex): StatsResult {
  const byKind: Record<string, number> = {};

  for (const entry of index.entries) {
    byKind[entry.kind] = (byKind[entry.kind] ?? 0) + 1;
  }

  return {
    total: index.entries.length,
    byKind,
    scannedAt: index.scannedAt.toISOString(),
    globalPath: index.globalPath,
    projectPath: index.projectPath,
  };
}
