import type { CatalogIndex } from '../types.js';
type BuildFn = (globalPath: string, projectPath?: string) => Promise<CatalogIndex>;
interface RefreshParams {
    projectPath?: string;
}
interface RefreshResult {
    scannedAt: string;
    totalEntries: number;
}
interface ServerState {
    index: CatalogIndex;
}
export declare function createRefreshHandler(buildIndex: BuildFn, state: ServerState): (params: RefreshParams) => Promise<RefreshResult>;
export {};
