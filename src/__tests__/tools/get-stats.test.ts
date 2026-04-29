import { getStats } from '../../tools/get-stats.js';
import type { CatalogIndex } from '../../types.js';

describe('getStats', () => {
  it('returns counts per kind', () => {
    const index: CatalogIndex = {
      entries: [
        {
          id: '1',
          kind: 'skill',
          name: 's1',
          description: '',
          tags: [],
          scope: 'global',
          source: '',
          metadata: {},
        },
        {
          id: '2',
          kind: 'skill',
          name: 's2',
          description: '',
          tags: [],
          scope: 'global',
          source: '',
          metadata: {},
        },
        {
          id: '3',
          kind: 'command',
          name: 'c1',
          description: '',
          tags: [],
          scope: 'global',
          source: '',
          metadata: {},
        },
        {
          id: '4',
          kind: 'agent',
          name: 'a1',
          description: '',
          tags: [],
          scope: 'global',
          source: '',
          metadata: {},
        },
      ],
      scannedAt: new Date('2026-04-16T12:00:00Z'),
      globalPath: '/tmp',
    };

    const stats = getStats(index);
    expect(stats.total).toBe(4);
    expect(stats.byKind.skill).toBe(2);
    expect(stats.byKind.command).toBe(1);
    expect(stats.byKind.agent).toBe(1);
    expect(stats.scannedAt).toBe(index.scannedAt.toISOString());
  });
});
