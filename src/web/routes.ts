import type { CatalogIndex, EntryKind, Scope } from '../types.js';
import { isEntryKind, isScope } from '../types.js';
import { search } from '../tools/search.js';
import { suggest } from '../tools/suggest.js';
import { getDetail } from '../tools/get-detail.js';
import { getStats } from '../tools/get-stats.js';
import { getWorkflows } from '../tools/get-workflows.js';

interface ServerState {
  index: CatalogIndex;
}

// WARUM `any` im Rückgabe-Typ (lokale ESLint-Ausnahme):
// Jeder API-Zweig hat eine andere Shape (EntryShort[], StatsResult,
// CatalogEntry[], Suggestion[], Workflow[], DetailResult, ErrorObj). Eine
// Union-Rückgabe zwingt jeden Caller zu manuellem Narrowing beim Zugriff
// auf `.length` / `.total` / `.entry.name` — das bläht Tests und
// dashboard-Client-Code unnötig auf, während alles am Serialize-Boundary
// (JSON.stringify) konvergiert. Generic-Overloads über den pathname-String
// scheitern an dynamischen Aufrufen aus dem HTTP-Handler. Die Ausnahme ist
// bewusst lokal auf diese eine Return-Position begrenzt.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ApiResult = any;

export interface Router {
  handle(pathname: string, params: Record<string, string>): Promise<ApiResult>;
}

export function createRouter(state: ServerState, staticDir: string): Router {
  return {
    async handle(pathname: string, params: Record<string, string>): Promise<ApiResult> {
      if (pathname === '/api/entries') {
        let entries = state.index.entries;
        if (params.kind && isEntryKind(params.kind)) {
          const kind: EntryKind = params.kind;
          entries = entries.filter((e) => e.kind === kind);
        }
        if (params.scope && params.scope !== 'all' && isScope(params.scope)) {
          const scope: Scope = params.scope;
          entries = entries.filter((e) => e.scope === scope);
        }
        // Vollständige CatalogEntry zurück (nicht toShort), damit der
        // Dashboard-Client `kind`, `source` und `filePath` filtern/anzeigen
        // kann. Der Test-Contract erwartet `result[0].kind`.
        return entries;
      }

      if (pathname === '/api/stats') {
        return getStats(state.index);
      }

      if (pathname === '/api/search') {
        const kind: EntryKind | undefined =
          params.kind && isEntryKind(params.kind) ? params.kind : undefined;
        return search(state.index, {
          query: params.q ?? '',
          kind,
        });
      }

      if (pathname === '/api/suggest') {
        return suggest(state.index, { task: params.task ?? '' });
      }

      if (pathname === '/api/workflows') {
        return getWorkflows(staticDir, { task: params.task });
      }

      if (pathname.startsWith('/api/entry/')) {
        const id = decodeURIComponent(pathname.slice('/api/entry/'.length));
        const result = await getDetail(state.index, { id });
        if (!result) return { error: 'Not found' };
        return result;
      }

      return { error: 'Unknown route' };
    },
  };
}
