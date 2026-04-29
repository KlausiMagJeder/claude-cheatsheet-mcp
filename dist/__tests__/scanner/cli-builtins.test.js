import { scanCliBuiltins } from '../../scanner/cli-builtins.js';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
describe('scanCliBuiltins', () => {
    it('loads cli builtins from static file', async () => {
        const staticDir = path.resolve(__dirname, '..', 'static');
        const entries = await scanCliBuiltins(staticDir);
        expect(entries.length).toBeGreaterThan(0);
    });
    it('creates correct entry format', async () => {
        const staticDir = path.resolve(__dirname, '..', 'static');
        const entries = await scanCliBuiltins(staticDir);
        const help = entries.find((e) => e.name === '/help');
        expect(help).toBeDefined();
        expect(help.kind).toBe('cli_command');
        expect(help.scope).toBe('global');
        expect(help.id).toBe('cli_command:/help');
    });
    // Regression for M2: malformed JSON must not crash the scanner.
    it('returns empty array on malformed JSON without throwing', async () => {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cheatsheet-cli-malformed-'));
        try {
            fs.writeFileSync(path.join(tmpDir, 'cli-builtins.json'), 'this is not json');
            const entries = await scanCliBuiltins(tmpDir);
            expect(entries).toEqual([]);
        }
        finally {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        }
    });
});
//# sourceMappingURL=cli-builtins.test.js.map