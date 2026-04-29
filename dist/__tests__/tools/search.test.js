import { search } from '../../tools/search.js';
function makeIndex() {
    return {
        entries: [
            {
                id: 'skill:brainstorming',
                kind: 'skill',
                name: 'brainstorming',
                description: 'Explore ideas before implementation',
                tags: ['skill', 'planning'],
                scope: 'global',
                source: 'superpowers',
                metadata: {},
            },
            {
                id: 'command:/jira',
                kind: 'command',
                name: '/jira',
                description: 'Analyze Jira tickets',
                tags: ['command', 'jira'],
                scope: 'global',
                source: 'commands',
                metadata: {},
            },
            {
                id: 'agent:Explore',
                kind: 'agent',
                name: 'Explore',
                description: 'Fast codebase search',
                tags: ['agent', 'search'],
                scope: 'global',
                source: 'built-in',
                metadata: {},
            },
        ],
        scannedAt: new Date(),
        globalPath: '/tmp',
    };
}
describe('search', () => {
    it('finds entries by name', () => {
        const result = search(makeIndex(), { query: 'brainstorming' });
        expect(result.length).toBe(1);
        expect(result[0].name).toBe('brainstorming');
    });
    it('finds entries by description', () => {
        const result = search(makeIndex(), { query: 'codebase' });
        expect(result.length).toBe(1);
        expect(result[0].name).toBe('Explore');
    });
    it('finds entries by tags', () => {
        const result = search(makeIndex(), { query: 'jira' });
        expect(result.length).toBe(1);
        expect(result[0].name).toBe('/jira');
    });
    it('filters by kind', () => {
        const result = search(makeIndex(), { query: 'search', kind: 'agent' });
        expect(result.length).toBe(1);
        expect(result[0].kind).toBe('agent');
    });
    it('returns empty for no match', () => {
        const result = search(makeIndex(), { query: 'xyznonexistent' });
        expect(result).toEqual([]);
    });
});
//# sourceMappingURL=search.test.js.map