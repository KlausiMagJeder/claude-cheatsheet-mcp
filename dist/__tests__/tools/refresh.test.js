import { createRefreshHandler } from '../../tools/refresh.js';
describe('createRefreshHandler', () => {
    it('calls buildIndex with current paths and updates reference', async () => {
        let capturedGlobal = '';
        let capturedProject = '';
        const mockBuild = async (g, p) => {
            capturedGlobal = g;
            capturedProject = p ?? '';
            return {
                entries: [
                    {
                        id: 'skill:x',
                        kind: 'skill',
                        name: 'x',
                        description: '',
                        tags: [],
                        scope: 'global',
                        source: '',
                        metadata: {},
                    },
                ],
                scannedAt: new Date(),
                globalPath: g,
                projectPath: p,
            };
        };
        const state = {
            index: {
                entries: [],
                scannedAt: new Date(),
                globalPath: '/global',
                projectPath: '/project',
            },
        };
        const handler = createRefreshHandler(mockBuild, state);
        const result = await handler({});
        expect(capturedGlobal).toBe('/global');
        expect(capturedProject).toBe('/project');
        expect(state.index.entries.length).toBe(1);
        expect(result.totalEntries).toBe(1);
        expect(typeof result.scannedAt).toBe('string');
    });
    it('uses provided projectPath override', async () => {
        let capturedProject = '';
        const mockBuild = async (g, p) => {
            capturedProject = p ?? '';
            return {
                entries: [],
                scannedAt: new Date(),
                globalPath: g,
                projectPath: p,
            };
        };
        const state = {
            index: {
                entries: [],
                scannedAt: new Date(),
                globalPath: '/global',
                projectPath: '/old-project',
            },
        };
        const handler = createRefreshHandler(mockBuild, state);
        await handler({ projectPath: '/new-project' });
        expect(capturedProject).toBe('/new-project');
    });
});
//# sourceMappingURL=refresh.test.js.map