import { getDetail } from '../../tools/get-detail.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
describe('getDetail', () => {
    let tmpDir;
    let testFilePath;
    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cheatsheet-test-'));
        testFilePath = path.join(tmpDir, 'test-skill.md');
        fs.writeFileSync(testFilePath, '# Test Skill\n\nFull content here.');
    });
    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });
    function makeIndex() {
        return {
            entries: [
                {
                    id: 'skill:test-skill',
                    kind: 'skill',
                    name: 'test-skill',
                    description: 'A test skill',
                    tags: ['skill', 'testing'],
                    scope: 'global',
                    source: 'test-plugin',
                    filePath: testFilePath,
                    metadata: { plugin: 'test-plugin' },
                },
                {
                    id: 'cli_command:/help',
                    kind: 'cli_command',
                    name: '/help',
                    description: 'Show help',
                    tags: ['cli_command'],
                    scope: 'global',
                    source: 'built-in',
                    metadata: {},
                },
            ],
            scannedAt: new Date(),
            globalPath: tmpDir,
        };
    }
    it('returns full entry with file content', async () => {
        const result = await getDetail(makeIndex(), { id: 'skill:test-skill' });
        expect(result).toBeDefined();
        expect(result.entry.name).toBe('test-skill');
        expect(result.content).toContain('Full content here.');
    });
    it('returns entry without content for static entries', async () => {
        const result = await getDetail(makeIndex(), { id: 'cli_command:/help' });
        expect(result).toBeDefined();
        expect(result.content).toBeUndefined();
    });
    it('returns null for unknown id', async () => {
        const result = await getDetail(makeIndex(), { id: 'skill:nonexistent' });
        expect(result).toBeNull();
    });
});
//# sourceMappingURL=get-detail.test.js.map