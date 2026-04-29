import { scanMcpTools } from '../../scanner/mcp-tools.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
describe('scanMcpTools', () => {
    let tmpDir;
    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cheatsheet-test-'));
        fs.writeFileSync(path.join(tmpDir, 'settings.json'), JSON.stringify({
            mcpServers: {
                atlassian: {
                    command: 'npx',
                    args: ['-y', '@anthropic/atlassian-mcp'],
                },
                cheatsheet: {
                    command: 'node',
                    args: ['/path/to/dist/index.js'],
                    env: { CLAUDE_PROJECT_PATH: '${workspaceFolder)' },
                },
            },
        }));
    });
    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });
    // ---------------------------------------------------------------------------
    // Legacy-Verhalten (muss bestehen bleiben, solange kein userConfigPath/
    // pluginsPath übergeben wird): scanMcpTools liest `settings.json` aus dem
    // übergebenen Verzeichnis. ACHTUNG: Nach Blocker-1-Fix ist das Lesen von
    // settings.json → mcpServers KEIN autoritativer Pfad mehr (siehe Blocker 1),
    // aber solange keine andere Quelle gesetzt ist, bleibt das Read erlaubt —
    // Primär-Ausstieg ist der neue `userConfigPath`-Parameter unten.
    // ---------------------------------------------------------------------------
    it('reads mcp servers from settings.json (legacy call)', async () => {
        const entries = await scanMcpTools(tmpDir);
        expect(entries.length).toBe(2);
    });
    it('creates correct entry for each server', async () => {
        const entries = await scanMcpTools(tmpDir);
        const atlassian = entries.find((e) => e.name === 'atlassian');
        expect(atlassian).toBeDefined();
        expect(atlassian.kind).toBe('mcp_tool');
        expect(atlassian.metadata.command).toBe('npx');
    });
    it('returns empty array when no settings.json', async () => {
        const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cheatsheet-empty-'));
        const entries = await scanMcpTools(emptyDir);
        expect(entries).toEqual([]);
        fs.rmSync(emptyDir, { recursive: true, force: true });
    });
    // Regression for M2: malformed settings.json must not crash the scanner.
    it('returns empty array on malformed settings.json without throwing', async () => {
        const badDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cheatsheet-mcp-malformed-'));
        try {
            fs.writeFileSync(path.join(badDir, 'settings.json'), '{ broken');
            const entries = await scanMcpTools(badDir);
            expect(entries).toEqual([]);
        }
        finally {
            fs.rmSync(badDir, { recursive: true, force: true });
        }
    });
    // ===========================================================================
    // BLOCKER 1 — neue Tests
    // ===========================================================================
    describe('Blocker 1 — User-MCPs aus ~/.claude.json (autoritative Quelle)', () => {
        it('reads User-MCPs from a user-config JSON file passed via userConfigPath', async () => {
            // Test-Fixture für ~/.claude.json — simuliert die echte Datei
            // (Atlassian, Jira, Cheatsheet als 3 User-MCPs wie im Diagnose-Report).
            const userConfigPath = path.join(tmpDir, '.claude.json');
            fs.writeFileSync(userConfigPath, JSON.stringify({
                mcpServers: {
                    atlassian: { command: 'npx', args: ['-y', '@anthropic/atlassian-mcp'] },
                    jira: {
                        command: 'node',
                        args: ['/path/jira.js'],
                        env: { JIRA_TOKEN: 'redacted' },
                    },
                    cheatsheet: { command: 'node', args: ['/path/cheatsheet.js'] },
                },
            }));
            // Erwartete neue Signatur:
            // scanMcpTools(settingsDir, userConfigPath?, pluginsPath?)
            const entries = await scanMcpTools(tmpDir, userConfigPath);
            const userEntries = entries.filter((e) => e.metadata.mcpScope === 'user');
            expect(userEntries.length).toBe(3);
            expect(userEntries.map((e) => e.name).sort()).toEqual(['atlassian', 'cheatsheet', 'jira']);
        });
        it('marks User-MCPs with metadata.mcpScope = "user"', async () => {
            const userConfigPath = path.join(tmpDir, '.claude.json');
            fs.writeFileSync(userConfigPath, JSON.stringify({
                mcpServers: {
                    atlassian: { command: 'npx', args: [] },
                },
            }));
            const entries = await scanMcpTools(tmpDir, userConfigPath);
            const atlassian = entries.find((e) => e.name === 'atlassian' && e.metadata.mcpScope === 'user');
            expect(atlassian).toBeDefined();
            expect(atlassian.metadata.mcpScope).toBe('user');
            expect(atlassian.scope).toBe('global'); // CatalogEntry.scope unverändert
        });
        it('ignores ~/.claude/settings.json → mcpServers when userConfigPath is provided (non-authoritative)', async () => {
            // settings.json im tmpDir enthält bereits "atlassian" und "cheatsheet" (aus beforeEach).
            // Wenn userConfigPath gesetzt ist, DÜRFEN diese nicht als User-MCPs
            // erfasst werden — settings.json → mcpServers ist nicht-autoritativ
            // (Task-25-Lehre).
            const userConfigPath = path.join(tmpDir, '.claude.json');
            fs.writeFileSync(userConfigPath, JSON.stringify({
                mcpServers: {
                    jira: { command: 'npx', args: [] },
                },
            }));
            const entries = await scanMcpTools(tmpDir, userConfigPath);
            // Nur "jira" sollte als User-MCP erscheinen.
            const userEntries = entries.filter((e) => e.metadata.mcpScope === 'user');
            expect(userEntries.length).toBe(1);
            expect(userEntries[0].name).toBe('jira');
        });
        it('returns empty user-MCP list when userConfigPath file is missing', async () => {
            const entries = await scanMcpTools(tmpDir, path.join(tmpDir, 'nonexistent.json'));
            const userEntries = entries.filter((e) => e.metadata.mcpScope === 'user');
            expect(userEntries).toEqual([]);
        });
        it('returns empty user-MCP list on malformed userConfig JSON', async () => {
            const userConfigPath = path.join(tmpDir, '.claude.json');
            fs.writeFileSync(userConfigPath, '{ not-json');
            const entries = await scanMcpTools(tmpDir, userConfigPath);
            const userEntries = entries.filter((e) => e.metadata.mcpScope === 'user');
            expect(userEntries).toEqual([]);
        });
    });
    describe('Blocker 1 — Plugin-MCPs via .mcp.json im Plugin-Root', () => {
        function makePluginRoot(pluginsRoot, marketplace, plugin, version) {
            const root = path.join(pluginsRoot, 'cache', marketplace, plugin, version);
            fs.mkdirSync(root, { recursive: true });
            return root;
        }
        it('scans Plugin-MCPs from <plugin-root>/.mcp.json', async () => {
            const pluginsRoot = path.join(tmpDir, 'plugins');
            const claudemem = makePluginRoot(pluginsRoot, 'thedotmack', 'claude-mem', '10.6.2');
            fs.writeFileSync(path.join(claudemem, '.mcp.json'), JSON.stringify({
                mcpServers: {
                    'mcp-search': { command: 'node', args: ['/path/mcp-search.js'] },
                },
            }));
            const entries = await scanMcpTools(tmpDir, undefined, pluginsRoot);
            const pluginEntries = entries.filter((e) => e.metadata.mcpScope === 'plugin');
            expect(pluginEntries.length).toBe(1);
            expect(pluginEntries[0].name).toBe('mcp-search');
        });
        it('marks Plugin-MCPs with metadata.mcpScope = "plugin" and plugin context', async () => {
            const pluginsRoot = path.join(tmpDir, 'plugins');
            const claudemem = makePluginRoot(pluginsRoot, 'thedotmack', 'claude-mem', '10.6.2');
            fs.writeFileSync(path.join(claudemem, '.mcp.json'), JSON.stringify({
                mcpServers: {
                    'mcp-search': { command: 'node', args: [] },
                },
            }));
            const entries = await scanMcpTools(tmpDir, undefined, pluginsRoot);
            const mcpSearch = entries.find((e) => e.name === 'mcp-search');
            expect(mcpSearch).toBeDefined();
            expect(mcpSearch.metadata.mcpScope).toBe('plugin');
            expect(mcpSearch.metadata.plugin).toBe('claude-mem');
            expect(mcpSearch.metadata.marketplace).toBe('thedotmack');
            expect(mcpSearch.metadata.version).toBe('10.6.2');
        });
        it('scans Plugin-MCPs from plugin.json → mcpServers (alternative declaration)', async () => {
            const pluginsRoot = path.join(tmpDir, 'plugins');
            const pluginRoot = makePluginRoot(pluginsRoot, 'some-mp', 'some-plugin', '1.0.0');
            const manifestDir = path.join(pluginRoot, '.claude-plugin');
            fs.mkdirSync(manifestDir, { recursive: true });
            fs.writeFileSync(path.join(manifestDir, 'plugin.json'), JSON.stringify({
                name: 'some-plugin',
                version: '1.0.0',
                mcpServers: {
                    'some-server': { command: 'node', args: ['/path/some.js'] },
                },
            }));
            const entries = await scanMcpTools(tmpDir, undefined, pluginsRoot);
            const pluginEntries = entries.filter((e) => e.metadata.mcpScope === 'plugin');
            expect(pluginEntries.map((e) => e.name)).toContain('some-server');
        });
        it('deduplicates MCPs: User-Scope has precedence over settings.json over plugin', async () => {
            // Ein "cheatsheet"-Server steht sowohl in ~/.claude.json (User-autoritativ)
            // als auch in settings.json (nicht-autoritativ, siehe Blocker 1).
            // Zusätzlich existiert ein Plugin-MCP mit demselben Namen.
            const userConfigPath = path.join(tmpDir, '.claude.json');
            fs.writeFileSync(userConfigPath, JSON.stringify({
                mcpServers: {
                    cheatsheet: { command: 'node', args: ['/user/cheatsheet.js'] },
                },
            }));
            const pluginsRoot = path.join(tmpDir, 'plugins');
            const pluginRoot = makePluginRoot(pluginsRoot, 'mp', 'some-plugin', '1.0.0');
            fs.writeFileSync(path.join(pluginRoot, '.mcp.json'), JSON.stringify({
                mcpServers: {
                    cheatsheet: { command: 'node', args: ['/plugin/cheatsheet.js'] },
                },
            }));
            const entries = await scanMcpTools(tmpDir, userConfigPath, pluginsRoot);
            // Pro Name + Scope ein Eintrag — User-Scope gewinnt bei Namenskollision
            // (Plugin-Scope darf aber zusätzlich erfasst sein, da es ein anderer Scope ist).
            const byName = entries.filter((e) => e.name === 'cheatsheet');
            expect(byName.length).toBeGreaterThanOrEqual(1);
            const userEntry = byName.find((e) => e.metadata.mcpScope === 'user');
            expect(userEntry).toBeDefined();
            expect(userEntry.metadata.command).toBe('node');
            // Das "command" muss vom User-Scope stammen (autoritative Quelle),
            // nicht vom Plugin/settings.json.
            const args = userEntry.metadata.args;
            expect(args?.[0]).toBe('/user/cheatsheet.js');
        });
        it('returns no plugin entries when pluginsPath is missing', async () => {
            const entries = await scanMcpTools(tmpDir, undefined, path.join(tmpDir, 'missing-plugins'));
            const pluginEntries = entries.filter((e) => e.metadata.mcpScope === 'plugin');
            expect(pluginEntries).toEqual([]);
        });
        it('does not crash on malformed plugin .mcp.json', async () => {
            const pluginsRoot = path.join(tmpDir, 'plugins');
            const broken = makePluginRoot(pluginsRoot, 'mp', 'broken-plugin', '1.0.0');
            fs.writeFileSync(path.join(broken, '.mcp.json'), '{ not-json');
            const entries = await scanMcpTools(tmpDir, undefined, pluginsRoot);
            // Scanner darf nicht crashen — broken-plugin trägt nur nichts bei.
            const pluginEntries = entries.filter((e) => e.metadata.mcpScope === 'plugin');
            expect(pluginEntries).toEqual([]);
        });
    });
});
//# sourceMappingURL=mcp-tools.test.js.map