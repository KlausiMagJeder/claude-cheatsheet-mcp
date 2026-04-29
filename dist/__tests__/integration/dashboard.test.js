import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startWebServer } from '../../web/server.js';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DASHBOARD = path.resolve(__dirname, '../../../dist/web/dashboard.html');
function emptyIndex() {
    return {
        entries: [],
        scannedAt: new Date('2026-04-17T00:00:00Z'),
        globalPath: '/tmp',
    };
}
describe('dashboard.html is served on GET / (Task 23 regression)', () => {
    it('dist/web/dashboard.html exists after build', () => {
        // Direkt-Check: build hat die Datei kopiert.
        expect(fs.existsSync(DIST_DASHBOARD)).toBe(true);
    });
    it('GET / returns the dashboard HTML with 200', async () => {
        const state = { index: emptyIndex() };
        // Port 0 = OS-assigned free port, kein CI-Konflikt.
        const server = startWebServer(state, '/tmp/static', 0);
        await new Promise((resolve) => server.on('listening', () => resolve()));
        try {
            const addr = server.address();
            const res = await fetch(`http://127.0.0.1:${addr.port}/`);
            expect(res.status).toBe(200);
            expect(res.headers.get('content-type')).toMatch(/text\/html/);
            const body = await res.text();
            // Smoke-Check: echter HTML-Body, nicht der 404-Fallback.
            expect(body).toMatch(/<!DOCTYPE html>/i);
            expect(body).not.toMatch(/dashboard\.html not found/);
        }
        finally {
            await new Promise((resolve) => server.close(() => resolve()));
        }
    });
});
//# sourceMappingURL=dashboard.test.js.map