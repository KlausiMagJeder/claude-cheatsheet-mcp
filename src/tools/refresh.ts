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

export function createRefreshHandler(buildIndex: BuildFn, state: ServerState) {
  return async function refresh(params: RefreshParams): Promise<RefreshResult> {
    const globalPath = state.index.globalPath;
    const projectPath = params.projectPath ?? state.index.projectPath;

    const newIndex = await buildIndex(globalPath, projectPath);
    state.index = newIndex;

    return {
      scannedAt: newIndex.scannedAt.toISOString(),
      totalEntries: newIndex.entries.length,
    };
  };
}
