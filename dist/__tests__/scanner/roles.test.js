import { scanRoles } from '../../scanner/roles.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
describe('scanRoles', () => {
    let tmpDir;
    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cheatsheet-test-'));
        const jarvisDir = path.join(tmpDir, 'jarvis', 'rolls');
        // Create role directory with role file
        const roleDir = path.join(jarvisDir, 'senior-rails-developer');
        fs.mkdirSync(roleDir, { recursive: true });
        fs.writeFileSync(path.join(roleDir, 'senior-rails-developer.md'), `# Senior Rails Developer

**Version:** 2.0

## Rolle
Senior Rails Developer

## Beschreibung
Verantwortlich fuer die Implementierung von Rails-Features.`);
        // Create second role
        const role2Dir = path.join(jarvisDir, 'test-engineer');
        fs.mkdirSync(role2Dir, { recursive: true });
        fs.writeFileSync(path.join(role2Dir, 'test-engineer.md'), `# Test Engineer

## Beschreibung
Verantwortlich fuer Tests und Qualitaetssicherung.`);
        // Create metadata file (not a role)
        fs.writeFileSync(path.join(jarvisDir, 'faehigkeiten-pro-rolle.md'), `# Faehigkeiten pro Rolle\n\nMetadata file.`);
        fs.writeFileSync(path.join(jarvisDir, 'rollenverwaltung.md'), `# Rollenverwaltung\n\nAdmin file.`);
    });
    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });
    it('scans role directories', async () => {
        const entries = await scanRoles(tmpDir);
        expect(entries.length).toBe(2);
    });
    it('creates correct entry', async () => {
        const entries = await scanRoles(tmpDir);
        const rails = entries.find((e) => e.name === 'senior-rails-developer');
        expect(rails).toBeDefined();
        expect(rails.kind).toBe('role');
        expect(rails.scope).toBe('global');
    });
    it('ignores metadata files in rolls root', async () => {
        const entries = await scanRoles(tmpDir);
        const names = entries.map((e) => e.name);
        expect(names).not.toContain('faehigkeiten-pro-rolle');
        expect(names).not.toContain('rollenverwaltung');
    });
});
//# sourceMappingURL=roles.test.js.map