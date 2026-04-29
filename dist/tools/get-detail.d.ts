import type { CatalogEntry, CatalogIndex } from '../types.js';
interface GetDetailParams {
    id: string;
}
interface DetailResult {
    entry: CatalogEntry;
    content?: string;
}
export declare function getDetail(index: CatalogIndex, params: GetDetailParams): Promise<DetailResult | null>;
export {};
