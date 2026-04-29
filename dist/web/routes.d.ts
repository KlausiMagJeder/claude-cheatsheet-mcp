import type { CatalogIndex } from '../types.js';
interface ServerState {
    index: CatalogIndex;
}
export type ApiResult = any;
export interface Router {
    handle(pathname: string, params: Record<string, string>): Promise<ApiResult>;
}
export declare function createRouter(state: ServerState, staticDir: string): Router;
export {};
