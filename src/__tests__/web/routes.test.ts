import type { AddressInfo } from 'node:net';
import { createRouter } from '../../web/routes.js';
import { startWebServer } from '../../web/server.js';
import type { CatalogIndex } from '../../types.js';

function makeIndex(): CatalogIndex {
  return {
    entries: [
      {
        id: 'skill:brainstorming',
        kind: 'skill',
        name: 'brainstorming',
        description: 'Explore ideas',
        tags: ['skill', 'planning'],
        scope: 'global',
        source: 'superpowers',
        metadata: {},
      },
      {
        id: 'command:/jira',
        kind: 'command',
        name: '/jira',
        description: 'Jira analyzer',
        tags: ['command', 'jira'],
        scope: 'global',
        source: 'commands',
        metadata: {},
      },
    ],
    scannedAt: new Date('2026-04-16T12:00:00Z'),
    globalPath: '/tmp',
  };
}

describe('createRouter', () => {
  const state = { index: makeIndex() };
  const router = createRouter(state, '/tmp/static');

  it('GET /api/entries returns all entries', async () => {
    const result = await router.handle('/api/entries', {});
    expect(result.length).toBe(2);
  });

  it('GET /api/entries?kind=skill filters by kind', async () => {
    const result = await router.handle('/api/entries', { kind: 'skill' });
    expect(result.length).toBe(1);
    expect(result[0].kind).toBe('skill');
  });

  it('GET /api/stats returns stats', async () => {
    const result = await router.handle('/api/stats', {});
    expect(result.total).toBe(2);
  });

  it('GET /api/search?q=jira finds entries', async () => {
    const result = await router.handle('/api/search', { q: 'jira' });
    expect(result.length).toBe(1);
    expect(result[0].name).toBe('/jira');
  });

  it('GET /api/suggest?task=plan finds planning tools', async () => {
    const result = await router.handle('/api/suggest', { task: 'plan' });
    expect(result.length).toBeGreaterThan(0);
  });

  it('GET /api/entry/:id returns detail', async () => {
    const result = await router.handle('/api/entry/skill:brainstorming', {});
    expect(result.entry.name).toBe('brainstorming');
  });
});

describe('startWebServer (security: loopback-only binding)', () => {
  // ~/.claude/ contents (secrets, hook tokens, agent prompts) must never
  // be exposed to the LAN. The server MUST bind 127.0.0.1, never 0.0.0.0.
  it('binds to 127.0.0.1 and responds on loopback', async () => {
    const state = { index: makeIndex() };
    // port 0 = OS-assigned free port, avoids collisions in CI
    const server = startWebServer(state, '/tmp/static', 0);

    await new Promise<void>((resolve) => server.on('listening', () => resolve()));

    try {
      const addr = server.address() as AddressInfo;
      expect(addr).not.toBeNull();
      expect(addr.address).toBe('127.0.0.1');

      // Positive check: loopback request succeeds
      const res = await fetch(`http://127.0.0.1:${addr.port}/api/stats`);
      expect(res.status).toBe(200);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
