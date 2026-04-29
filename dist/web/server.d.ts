import * as http from 'node:http';
import type { CatalogIndex } from '../types.js';
interface ServerState {
    index: CatalogIndex;
}
export declare function startWebServer(state: ServerState, staticDir: string, port?: number): http.Server;
export {};
