import { scanAgents } from '../../scanner/agents.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
describe('scanAgents', () => {
    it('loads built-in agents from static file', async () => {
        const staticDir = path.resolve(__dirname, '..', 'static');
        const entries = await scanAgents(staticDir);
        expect(entries.length).toBeGreaterThan(0);
    });
    it('includes general-purpose agent', async () => {
        const staticDir = path.resolve(__dirname, '..', 'static');
        const entries = await scanAgents(staticDir);
        const gp = entries.find((e) => e.name === 'general-purpose');
        expect(gp).toBeDefined();
        expect(gp.kind).toBe('agent');
        expect(gp.scope).toBe('global');
    });
    // Regression for M2: malformed JSON must not crash the scanner; the
    // orchestrator relies on an empty-array fallback so Promise.allSettled
    // does not silently drop the whole category on a rejection.
    it('returns empty array on malformed JSON without throwing', async () => {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cheatsheet-agents-malformed-'));
        try {
            fs.writeFileSync(path.join(tmpDir, 'agents-builtin.json'), '{ not valid json');
            const entries = await scanAgents(tmpDir);
            expect(entries).toEqual([]);
        }
        finally {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        }
    });
    // ===========================================================================
    // BLOCKER 3 — Nur 5 echte Built-ins in statischer Datei
    // ===========================================================================
    describe('Blocker 3 — Built-ins sind nur die echten 5', () => {
        it('exposes exactly the 5 real Claude-Code built-ins from agents-builtin.json', async () => {
            const staticDir = path.resolve(__dirname, '..', 'static');
            const entries = await scanAgents(staticDir);
            // Die statische Datei soll NUR noch die echten Built-ins enthalten —
            // Plugin-Agents kommen dynamisch aus dem Plugin-Scan.
            const builtInNames = entries
                .filter((e) => e.metadata.plugin === null || e.metadata.plugin === undefined)
                .map((e) => e.name)
                .sort();
            expect(builtInNames).toEqual(['Explore', 'Plan', 'claude-code-guide', 'general-purpose', 'statusline-setup'].sort());
        });
        it('does not include any plugin-namespaced agents in static file result', async () => {
            const staticDir = path.resolve(__dirname, '..', 'static');
            const entries = await scanAgents(staticDir);
            // Keine alten "pr-review-toolkit:..." oder "skill-creator:..." aus der
            // statischen Datei — die müssen aus dem dynamischen Plugin-Scan kommen.
            const namespaced = entries.filter((e) => e.name.includes(':'));
            expect(namespaced).toEqual([]);
        });
    });
    // ===========================================================================
    // BLOCKER 3 — Dynamischer Plugin-Agent-Scan
    // ===========================================================================
    describe('Blocker 3 — Plugin-Agents dynamisch scannen', () => {
        let tmpDir;
        function makePluginRoot(pluginsRoot, marketplace, plugin, version) {
            const root = path.join(pluginsRoot, 'cache', marketplace, plugin, version);
            fs.mkdirSync(root, { recursive: true });
            return root;
        }
        function writeAgent(dir, name, description, model = 'opus') {
            fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(path.join(dir, `${name}.md`), `---\nname: ${name}\ndescription: ${description}\nmodel: ${model}\n---\n\nAgent ${name} content.`);
        }
        beforeEach(() => {
            tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cheatsheet-agents-plugins-'));
        });
        afterEach(() => {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        });
        it('scans plugin agents from <plugin-root>/agents/*.md', async () => {
            const staticDir = path.resolve(__dirname, '..', 'static');
            const pluginsRoot = path.join(tmpDir, 'plugins');
            const pr = makePluginRoot(pluginsRoot, 'claude-plugins-official', 'pr-review-toolkit', 'unknown');
            writeAgent(path.join(pr, 'agents'), 'code-reviewer', 'Review code against guidelines');
            writeAgent(path.join(pr, 'agents'), 'silent-failure-hunter', 'Finds silent failures');
            writeAgent(path.join(pr, 'agents'), 'code-simplifier', 'Simplifies code');
            // Erwartete neue Signatur: scanAgents(staticDir, pluginsPath?)
            const entries = await scanAgents(staticDir, pluginsRoot);
            const pluginAgents = entries.filter((e) => e.metadata.plugin === 'pr-review-toolkit');
            expect(pluginAgents.length).toBe(3);
            const names = pluginAgents.map((e) => e.name).sort();
            expect(names).toContain('code-reviewer');
            expect(names).toContain('silent-failure-hunter');
            expect(names).toContain('code-simplifier');
        });
        it('scans skill-internal agents (skill-creator special case: skills/<name>/agents/*.md)', async () => {
            const staticDir = path.resolve(__dirname, '..', 'static');
            const pluginsRoot = path.join(tmpDir, 'plugins');
            const sc = makePluginRoot(pluginsRoot, 'claude-plugins-official', 'skill-creator', 'unknown');
            writeAgent(path.join(sc, 'skills', 'skill-creator', 'agents'), 'grader', 'Grades skill performance');
            const entries = await scanAgents(staticDir, pluginsRoot);
            const grader = entries.find((e) => e.name === 'grader' || e.name === 'skill-creator:grader');
            expect(grader).toBeDefined();
            expect(grader.metadata.plugin).toBe('skill-creator');
        });
        it('does not duplicate agents that appear in both /agents/ and skills/<name>/agents/', async () => {
            const staticDir = path.resolve(__dirname, '..', 'static');
            const pluginsRoot = path.join(tmpDir, 'plugins');
            const plug = makePluginRoot(pluginsRoot, 'mp', 'dup-plugin', '1.0.0');
            writeAgent(path.join(plug, 'agents'), 'dup-agent', 'First occurrence');
            writeAgent(path.join(plug, 'skills', 'a-skill', 'agents'), 'dup-agent', 'Second occurrence');
            const entries = await scanAgents(staticDir, pluginsRoot);
            const dups = entries.filter((e) => (e.name === 'dup-agent' || e.name === 'dup-plugin:dup-agent') &&
                e.metadata.plugin === 'dup-plugin');
            // Dedup: exakt 1 Eintrag pro (plugin, agent-name).
            expect(dups.length).toBe(1);
        });
        it('annotates plugin agents with plugin/marketplace/version metadata', async () => {
            const staticDir = path.resolve(__dirname, '..', 'static');
            const pluginsRoot = path.join(tmpDir, 'plugins');
            const plug = makePluginRoot(pluginsRoot, 'my-mp', 'my-plugin', '2.0.0');
            writeAgent(path.join(plug, 'agents'), 'my-agent', 'Does things');
            const entries = await scanAgents(staticDir, pluginsRoot);
            const ma = entries.find((e) => e.metadata.plugin === 'my-plugin');
            expect(ma).toBeDefined();
            expect(ma.metadata.marketplace).toBe('my-mp');
            expect(ma.metadata.version).toBe('2.0.0');
            // v0.5.0 — installPath non-null (siehe Plan v1.1 AK A-0-2 + D-9).
            expect(typeof ma.metadata.installPath).toBe('string');
            expect(ma.metadata.installPath).toBe(plug);
        });
        it('returns only built-ins when pluginsPath is missing/empty', async () => {
            const staticDir = path.resolve(__dirname, '..', 'static');
            const entries = await scanAgents(staticDir, path.join(tmpDir, 'nonexistent'));
            const pluginEntries = entries.filter((e) => e.metadata.plugin !== null && e.metadata.plugin !== undefined);
            expect(pluginEntries).toEqual([]);
        });
        it('handles agents with missing frontmatter gracefully', async () => {
            const staticDir = path.resolve(__dirname, '..', 'static');
            const pluginsRoot = path.join(tmpDir, 'plugins');
            const plug = makePluginRoot(pluginsRoot, 'mp', 'broken', '1.0.0');
            const agentsDir = path.join(plug, 'agents');
            fs.mkdirSync(agentsDir, { recursive: true });
            // Agent ohne Frontmatter:
            fs.writeFileSync(path.join(agentsDir, 'no-frontmatter.md'), '# Just markdown content.');
            // Darf nicht crashen; Eintrag darf fehlen ODER mit Fallback-Namen
            // (Dateiname) auftauchen — beide Verhalten sind zulässig.
            await expect(scanAgents(staticDir, pluginsRoot)).resolves.not.toThrow();
        });
    });
});
//# sourceMappingURL=agents.test.js.map