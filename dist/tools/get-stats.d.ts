import type { CatalogIndex } from '../types.js';
interface StatsResult {
    total: number;
    byKind: Record<string, number>;
    scannedAt: string;
    globalPath: string;
    projectPath?: string;
}
export declare function getStats(index: CatalogIndex): StatsResult;
export {};
