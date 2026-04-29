import { isEntryKind, isScope } from '../types.js';
import { search } from '../tools/search.js';
import { suggest } from '../tools/suggest.js';
import { getDetail } from '../tools/get-detail.js';
import { getStats } from '../tools/get-stats.js';
import { getWorkflows } from '../tools/get-workflows.js';
export function createRouter(state, staticDir) {
    return {
        async handle(pathname, params) {
            if (pathname === '/api/entries') {
                let entries = state.index.entries;
                if (params.kind && isEntryKind(params.kind)) {
                    const kind = params.kind;
                    entries = entries.filter((e) => e.kind === kind);
                }
                if (params.scope && params.scope !== 'all' && isScope(params.scope)) {
                    const scope = params.scope;
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
                const kind = params.kind && isEntryKind(params.kind) ? params.kind : undefined;
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
                if (!result)
                    return { error: 'Not found' };
                return result;
            }
            return { error: 'Unknown route' };
        },
    };
}
//# sourceMappingURL=routes.js.map