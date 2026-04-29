import { createListHandler } from '../../tools/list-skills.js';
import type { CatalogIndex, CatalogEntry } from '../../types.js';

function makeIndex(entries: Partial<CatalogEntry>[]): CatalogIndex {
  return {
    entries: entries.map((e, i) => ({
      id: `test:${i}`,
      kind: 'skill',
      name: `entry-${i}`,
      description: 'test',
      tags: ['skill'],
      scope: 'global',
      source: 'test',
      metadata: {},
      ...e,
    })),
    scannedAt: new Date(),
    globalPath: '/tmp',
  };
}

describe('createListHandler', () => {
  it('filters by kind', () => {
    const index = makeIndex([
      { kind: 'skill', name: 's1' },
      { kind: 'command', name: 'c1' },
      { kind: 'skill', name: 's2' },
    ]);
    const handler = createListHandler('skill');
    const result = handler(index, {});
    expect(result.length).toBe(2);
  });

  it('filters by scope', () => {
    const index = makeIndex([
      { kind: 'skill', scope: 'global', name: 's1' },
      { kind: 'skill', scope: 'project', name: 's2' },
    ]);
    const handler = createListHandler('skill');
    const result = handler(index, { scope: 'project' });
    expect(result.length).toBe(1);
    expect(result[0].name).toBe('s2');
  });

  it("returns all when scope is 'all'", () => {
    const index = makeIndex([
      { kind: 'skill', scope: 'global', name: 's1' },
      { kind: 'skill', scope: 'project', name: 's2' },
    ]);
    const handler = createListHandler('skill');
    const result = handler(index, { scope: 'all' });
    expect(result.length).toBe(2);
  });

  it('returns EntryShort format', () => {
    const index = makeIndex([
      { kind: 'skill', name: 's1', description: 'desc', tags: ['a'], scope: 'global' },
    ]);
    const handler = createListHandler('skill');
    const result = handler(index, {});
    expect(result[0]).toEqual({
      id: expect.any(String),
      name: 's1',
      description: 'desc',
      tags: ['a'],
      scope: 'global',
    });
  });
});
