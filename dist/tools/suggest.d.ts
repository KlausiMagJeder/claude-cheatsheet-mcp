import type { CatalogIndex, Suggestion } from '../types.js';
export interface SuggestOptions {
    task: string;
}
export declare function suggest(index: CatalogIndex, options: SuggestOptions): Suggestion[];
