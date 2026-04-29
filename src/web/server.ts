import * as http from 'node:http';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CatalogIndex } from '../types.js';
import { createRouter } from './routes.js';

// ESM-natives __dirname-Äquivalent. dashboard.html liegt nach Build neben
// server.js in dist/web/ (Task 23 liefert die Datei, bis dahin 404 akzeptabel).
const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface ServerState {
  index: CatalogIndex;
}

export function startWebServer(state: ServerState, staticDir: string, port = 37778): http.Server {
  const router = createRouter(state, staticDir);
  const dashboardPath = path.join(__dirname, 'dashboard.html');

  const server = http.createServer((req, res) => {
    // Alle Request-Handling-Zweige sind async; Fehler MÜSSEN zentral gefangen
    // werden, sonst führt eine nicht-abgefangene Promise-Rejection zu einem
    // unbeantworteten Socket (Client hängt) und crasht den Node-Prozess.
    void handleRequest(req, res, router, dashboardPath);
  });

  // SECURITY / Bedarfsanalyse B1 (Regression W1+A3):
  // Bind an 127.0.0.1 — NICHT 0.0.0.0 — weil der Server Inhalte aus ~/.claude/
  // ausliefert (Skill-Quelltexte, Hook-Konfigs mit Tokens, Agent-Prompts,
  // MCP-Server-Zugangsdaten). Ein LAN-Bind würde diese Inhalte ungeschützt
  // jedem Gerät im gleichen Netz zugänglich machen. Loopback-only ist die
  // einzig vertretbare Default-Einstellung; eine explizite Opt-Out-Flag müsste
  // Authentifizierung voraussetzen und ist in v0.1 nicht vorgesehen.
  server.listen(port, '127.0.0.1', () => {
    const address = server.address();
    const actualPort = typeof address === 'object' && address ? address.port : port;
    // stderr statt stdout: der Host-Prozess nutzt stdout für MCP-JSON-RPC.
    console.error(`Cheatsheet Dashboard @ http://127.0.0.1:${actualPort}`);
  });

  // Bedarfsanalyse A2: Port-Kollision (EADDRINUSE) darf den Prozess nicht
  // crashen. Wir loggen auf stderr und lassen den Caller entscheiden, ob
  // ein Retry mit anderem Port sinnvoll ist.
  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(
        `[web-server] port ${port} already in use — dashboard not started. ` +
          `Set CHEATSHEET_WEB_PORT to use a different port.`,
      );
      return;
    }
    console.error('[web-server] unexpected error:', err);
  });

  return server;
}

async function handleRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  router: ReturnType<typeof createRouter>,
  dashboardPath: string,
): Promise<void> {
  // CORS: zulässig weil Server nur an 127.0.0.1 bindet (B1). Ohne LAN-Exposure
  // entfällt die übliche CORS-Risikoklasse; `*` erlaubt lokale Tools/Browser-
  // Erweiterungen, ohne den Nutzer zur Konfiguration zu zwingen.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const rawUrl = req.url ?? '/';
  let url: URL;
  try {
    url = new URL(rawUrl, 'http://127.0.0.1');
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid URL' }));
    return;
  }

  const pathname = url.pathname;

  try {
    if (pathname === '/' || pathname === '/index.html') {
      try {
        const html = await fs.readFile(dashboardPath, 'utf-8');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
      } catch {
        // Task 23 liefert dashboard.html — bis dahin freundlicher Placeholder
        // statt Crash. 404 mit Hinweis, damit Dev-Flow ohne Datei läuft.
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('dashboard.html not found (see Task 23)');
      }
      return;
    }

    if (pathname.startsWith('/api/')) {
      const params: Record<string, string> = {};
      url.searchParams.forEach((value, key) => {
        params[key] = value;
      });

      const result = await router.handle(pathname, params);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(result));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  } catch (err) {
    console.error('[web-server] handler error:', err);
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
}
