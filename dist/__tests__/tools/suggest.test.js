import { suggest } from '../../tools/suggest.js';
function makeIndex() {
    return {
        entries: [
            {
                id: 'skill:review-pr',
                kind: 'skill',
                name: 'review-pr',
                description: 'PR review',
                tags: ['skill', 'review', 'git'],
                scope: 'global',
                source: 'pr-review-toolkit',
                metadata: {},
            },
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
            {
                id: 'skill:tdd',
                kind: 'skill',
                name: 'test-driven-development',
                description: 'TDD workflow',
                tags: ['skill', 'testing'],
                scope: 'global',
                source: 'superpowers',
                metadata: {},
            },
        ],
        scannedAt: new Date(),
        globalPath: '/tmp',
    };
}
describe('suggest', () => {
    it('suggests entries matching task keywords', () => {
        const result = suggest(makeIndex(), { task: 'review my pull request' });
        expect(result.length).toBeGreaterThan(0);
        expect(result[0].entry.name).toBe('review-pr');
        expect(result[0].relevance).toBeGreaterThan(0);
    });
    it('ranks by relevance (more tag matches = higher)', () => {
        const result = suggest(makeIndex(), { task: 'git review' });
        expect(result[0].entry.name).toBe('review-pr');
    });
    it('includes reason string', () => {
        const result = suggest(makeIndex(), { task: 'review' });
        expect(result[0].reason).toContain('review');
    });
    it('returns empty for no relevant match', () => {
        const result = suggest(makeIndex(), { task: 'deploy kubernetes' });
        expect(result).toEqual([]);
    });
});
//# sourceMappingURL=suggest.test.js.map