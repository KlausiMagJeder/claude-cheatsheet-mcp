/**
 * Integration test: dashboard.html is served by the web server on GET /.
 *
 * Regression guard for the bug fixed on 2026-04-17 — Task 23 Step 2:
 * The build-script previously only copied `src/static/` to `dist/static/` but
 * forgot `src/web/dashboard.html -> dist/web/dashboard.html`. Since server.ts
 * resolves the dashboard path via `path.join(__dirname, 'dashboard.html')`
 * (i.e. relative to the compiled JS in dist/web/), a missing copy step turned
 * GET / into "dashboard.html not found".
 *
 * This test asserts the end-to-end wiring (build-script -> compiled server
 * -> HTTP response). If scripts/copy-assets.mjs ever skips dashboard.html
 * again, this test fails loudly.
 *
 * Prerequisites: `npm run build` has produced a current dist/.
 */
import type { AddressInfo } from 'node:net';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { startWebServer } from '../../web/server.js';
import type { CatalogIndex } from '../../types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DASHBOARD = path.resolve(__dirname, '../../../dist/web/dashboard.html');

function emptyIndex(): CatalogIndex {
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
    await new Promise<void>((resolve) => server.on('listening', () => resolve()));

    try {
      const addr = server.address() as AddressInfo;
      const res = await fetch(`http://127.0.0.1:${addr.port}/`);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toMatch(/text\/html/);
      const body = await res.text();
      // Smoke-Check: echter HTML-Body, nicht der 404-Fallback.
      expect(body).toMatch(/<!DOCTYPE html>/i);
      expect(body).not.toMatch(/dashboard\.html not found/);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
