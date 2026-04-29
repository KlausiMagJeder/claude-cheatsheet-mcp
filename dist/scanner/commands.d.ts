import type { CatalogEntry } from '../types.js';
export declare function scanCommands(globalPath: string, projectPath?: string, pluginsPath?: string): Promise<CatalogEntry[]>;
