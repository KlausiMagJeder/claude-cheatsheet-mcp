import { generateTags } from '../tagger/index.js';
import type { CatalogEntry } from '../types.js';

function makeEntry(overrides: Partial<CatalogEntry>): CatalogEntry {
  return {
    id: 'skill:test',
    kind: 'skill',
    name: 'test',
    description: '',
    tags: [],
    scope: 'global',
    source: 'test',
    metadata: {},
    ...overrides,
  };
}

describe('generateTags', () => {
  it('adds kind as tag', () => {
    const entry = makeEntry({ kind: 'skill' });
    const tags = generateTags(entry);
    expect(tags).toContain('skill');
  });

  it('extracts review tag from description', () => {
    const entry = makeEntry({ description: 'Comprehensive PR review using specialized agents' });
    const tags = generateTags(entry);
    expect(tags).toContain('review');
  });

  it('extracts multiple tags', () => {
    const entry = makeEntry({
      name: 'systematic-debugging',
      description: 'Bug analysis and fix workflow with test verification',
    });
    const tags = generateTags(entry);
    expect(tags).toContain('debugging');
    expect(tags).toContain('testing');
  });

  it('extracts tags from name', () => {
    const entry = makeEntry({ name: 'test-driven-development' });
    const tags = generateTags(entry);
    expect(tags).toContain('testing');
  });

  it('returns deduplicated tags', () => {
    const entry = makeEntry({
      name: 'test-something',
      description: 'test coverage and test spec',
    });
    const tags = generateTags(entry);
    const testCount = tags.filter((t) => t === 'testing').length;
    expect(testCount).toBe(1);
  });
});
