/**
 * Unit-Tests für `getPluginDetail` — pure Function über `CatalogIndex`.
 *
 * Test-Plan: Phase D / Plan v1.1 §Test-Plan #4 (idee-1-4-5-quickwin-v0.5.0.md).
 *
 * WARUM Factories statt Fixtures: deterministische, in-code-gebaute
 * CatalogEntries — keine Filesystem-Reads, kein Scanner-Lauf. Wir testen
 * ausschließlich die Filter-/Group-/Metadata-Lift-Logik der Pure Function.
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPluginDetail } from '../../tools/get-plugin-detail.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..', '..', '..');
function makeEntry(overrides) {
    const kind = overrides.kind;
    const name = overrides.name ?? 'dummy';
    const defaults = {
        id: `${kind}:${name}`,
        kind,
        name,
        description: '',
        tags: [],
        scope: 'global',
        source: 'test',
        metadata: {},
    };
    return { ...defaults, ...overrides };
}
function makeIndex(entries) {
    return {
        entries,
        scannedAt: new Date('2026-05-13T00:00:00Z'),
        globalPath: '/tmp/.claude',
    };
}
describe('getPluginDetail — happy path', () => {
    it('groups entries across all 5 plugin-scoped kinds for given pluginName', () => {
        // WARUM: Plan AK A-5 — die 5 plugin-scoped Kinds sind
        // skill, command, agent, hook, mcp_tool. Wir setzen pro Kind genau 1
        // Match-Entry + 1 anderes-Plugin-Entry, um Filter + Gruppierung zu prüfen.
        const index = makeIndex([
            makeEntry({
                id: 'skill:a',
                kind: 'skill',
                name: 'a',
                metadata: {
                    plugin: 'super',
                    version: '1.2.3',
                    marketplace: 'official',
                    installPath: '/home/u/.claude/plugins/cache/official/super/1.2.3',
                },
            }),
            makeEntry({
                id: 'command:/b',
                kind: 'command',
                name: '/b',
                metadata: { plugin: 'super' },
            }),
            makeEntry({ id: 'agent:c', kind: 'agent', name: 'c', metadata: { plugin: 'super' } }),
            makeEntry({ id: 'hook:d', kind: 'hook', name: 'd', metadata: { plugin: 'super' } }),
            makeEntry({
                id: 'mcp_tool:e',
                kind: 'mcp_tool',
                name: 'e',
                metadata: { plugin: 'super' },
            }),
            // Andere Plugins / kein Plugin — dürfen nicht reinrutschen.
            makeEntry({
                id: 'skill:other',
                kind: 'skill',
                name: 'other',
                metadata: { plugin: 'someone-else' },
            }),
            makeEntry({ id: 'skill:nometa', kind: 'skill', name: 'nometa' }),
        ]);
        const result = getPluginDetail(index, { pluginName: 'super' });
        expect(result.found).toBe(true);
        expect(result.pluginName).toBe('super');
        expect(result.totals).toEqual({
            skills: 1,
            commands: 1,
            agents: 1,
            hooks: 1,
            mcp_tools: 1,
        });
        expect(result.entries.skills.map((e) => e.id)).toEqual(['skill:a']);
        expect(result.entries.commands.map((e) => e.id)).toEqual(['command:/b']);
        expect(result.entries.agents.map((e) => e.id)).toEqual(['agent:c']);
        expect(result.entries.hooks.map((e) => e.id)).toEqual(['hook:d']);
        expect(result.entries.mcp_tools.map((e) => e.id)).toEqual(['mcp_tool:e']);
    });
    it('lifts version/marketplace/installPath from first matching entry into the result', () => {
        const index = makeIndex([
            makeEntry({
                id: 'skill:a',
                kind: 'skill',
                name: 'a',
                metadata: {
                    plugin: 'super',
                    version: '1.2.3',
                    marketplace: 'official',
                    installPath: '/path/to/cache/official/super/1.2.3',
                },
            }),
            // Zweites Entry mit anderen Metadaten — darf NICHT die Result-Felder
            // überschreiben (Plan: "erstes Element"-Konvention seit v0.3.1).
            makeEntry({
                id: 'command:/b',
                kind: 'command',
                name: '/b',
                metadata: {
                    plugin: 'super',
                    version: '9.9.9',
                    marketplace: 'rogue',
                    installPath: '/wrong/path',
                },
            }),
        ]);
        const result = getPluginDetail(index, { pluginName: 'super' });
        expect(result.version).toBe('1.2.3');
        expect(result.marketplace).toBe('official');
        expect(result.installPath).toBe('/path/to/cache/official/super/1.2.3');
    });
    it('returns short entries (no filePath, no metadata leak)', () => {
        const index = makeIndex([
            makeEntry({
                id: 'skill:a',
                kind: 'skill',
                name: 'a',
                description: 'Some skill',
                tags: ['t1', 't2'],
                filePath: '/should/not/leak.md',
                metadata: { plugin: 'super', version: '1.0.0', secret: 'do-not-leak' },
            }),
        ]);
        const result = getPluginDetail(index, { pluginName: 'super' });
        expect(result.entries.skills).toHaveLength(1);
        const short = result.entries.skills[0];
        // EntryShort: nur id, name, description, tags, scope — kein filePath, keine metadata.
        expect(short).toEqual({
            id: 'skill:a',
            name: 'a',
            description: 'Some skill',
            tags: ['t1', 't2'],
            scope: 'global',
        });
        expect(short.filePath).toBeUndefined();
        expect(short.metadata).toBeUndefined();
    });
});
describe('getPluginDetail — unknown plugin', () => {
    it('returns found=false with all-zero totals and empty buckets, no throw', () => {
        const index = makeIndex([
            makeEntry({ id: 'skill:a', kind: 'skill', name: 'a', metadata: { plugin: 'existing' } }),
        ]);
        const result = getPluginDetail(index, { pluginName: 'nonexistent' });
        expect(result.found).toBe(false);
        expect(result.pluginName).toBe('nonexistent');
        expect(result.version).toBeNull();
        expect(result.marketplace).toBeNull();
        expect(result.installPath).toBeNull();
        expect(result.totals).toEqual({
            skills: 0,
            commands: 0,
            agents: 0,
            hooks: 0,
            mcp_tools: 0,
        });
        expect(result.entries).toEqual({
            skills: [],
            commands: [],
            agents: [],
            hooks: [],
            mcp_tools: [],
        });
    });
    it('also returns found=false on a completely empty index', () => {
        const result = getPluginDetail(makeIndex([]), { pluginName: 'anything' });
        expect(result.found).toBe(false);
        expect(result.totals.skills).toBe(0);
        expect(result.entries.skills).toEqual([]);
    });
});
describe('getPluginDetail — plugin-scoped kinds only', () => {
    it('excludes role and cli_command entries even if synthetically tagged with metadata.plugin', () => {
        // WARUM synthetisch: Roles und CLI-Builtins haben in der Realität KEIN
        // metadata.plugin — wir setzen es hier künstlich, um die Filter-Logik
        // explizit zu prüfen. Erwartung: trotz Match auf pluginName werden
        // role/cli_command NICHT aufgenommen.
        const index = makeIndex([
            makeEntry({ id: 'skill:a', kind: 'skill', name: 'a', metadata: { plugin: 'x' } }),
            makeEntry({ id: 'role:b', kind: 'role', name: 'b', metadata: { plugin: 'x' } }),
            makeEntry({
                id: 'cli_command:/c',
                kind: 'cli_command',
                name: '/c',
                metadata: { plugin: 'x' },
            }),
        ]);
        const result = getPluginDetail(index, { pluginName: 'x' });
        // Nur das skill-Entry zählt.
        expect(result.totals).toEqual({
            skills: 1,
            commands: 0,
            agents: 0,
            hooks: 0,
            mcp_tools: 0,
        });
        expect(result.entries.skills.map((e) => e.id)).toEqual(['skill:a']);
        // Response-Shape darf KEINE roles-/cli_commands-Buckets enthalten.
        const entriesRecord = result.entries;
        expect(entriesRecord.roles).toBeUndefined();
        expect(entriesRecord.cli_commands).toBeUndefined();
        expect(entriesRecord.role).toBeUndefined();
        expect(entriesRecord.cli_command).toBeUndefined();
        const totalsRecord = result.totals;
        expect(totalsRecord.roles).toBeUndefined();
        expect(totalsRecord.cli_commands).toBeUndefined();
    });
});
describe('getPluginDetail — scoped plugin names', () => {
    it('matches scoped plugin names like "@scope/name" exactly (case-sensitive)', () => {
        const index = makeIndex([
            makeEntry({
                id: 'skill:a',
                kind: 'skill',
                name: 'a',
                metadata: { plugin: '@anthropic/superpowers' },
            }),
            makeEntry({
                id: 'skill:b',
                kind: 'skill',
                name: 'b',
                metadata: { plugin: 'superpowers' },
            }),
        ]);
        const scoped = getPluginDetail(index, { pluginName: '@anthropic/superpowers' });
        expect(scoped.found).toBe(true);
        expect(scoped.totals.skills).toBe(1);
        expect(scoped.entries.skills.map((e) => e.id)).toEqual(['skill:a']);
        // Substring-Match darf NICHT greifen.
        const unscoped = getPluginDetail(index, { pluginName: 'superpowers' });
        expect(unscoped.found).toBe(true);
        expect(unscoped.totals.skills).toBe(1);
        expect(unscoped.entries.skills.map((e) => e.id)).toEqual(['skill:b']);
    });
    it('is case-sensitive — "SuperPowers" does not match "superpowers"', () => {
        const index = makeIndex([
            makeEntry({
                id: 'skill:a',
                kind: 'skill',
                name: 'a',
                metadata: { plugin: 'SuperPowers' },
            }),
        ]);
        expect(getPluginDetail(index, { pluginName: 'superpowers' }).found).toBe(false);
        expect(getPluginDetail(index, { pluginName: 'SuperPowers' }).found).toBe(true);
    });
    it('returns null metadata fields when first matching entry lacks version/marketplace/installPath', () => {
        const index = makeIndex([
            makeEntry({ id: 'skill:a', kind: 'skill', name: 'a', metadata: { plugin: 'x' } }),
        ]);
        const result = getPluginDetail(index, { pluginName: 'x' });
        expect(result.found).toBe(true);
        expect(result.version).toBeNull();
        expect(result.marketplace).toBeNull();
        expect(result.installPath).toBeNull();
    });
});
describe('getPluginDetail — registration in src/index.ts', () => {
    // WARUM Quell-Datei statt Runtime: dist/ ist build-abhängig. Wir prüfen
    // analog plugin-manifests.test.ts gegen die Source-Datei.
    it('is wired as MCP tool "get_plugin_detail" via server.registerTool(...)', () => {
        const indexTsPath = join(REPO_ROOT, 'src', 'index.ts');
        const source = readFileSync(indexTsPath, 'utf8');
        // Pattern: registerTool(\n  'get_plugin_detail', ...
        // WARUM tolerant zu Whitespace: Prettier-Formatierung kann Argumente
        // umbrechen. Wir matchen registerTool + Tool-Name in jeder Reihenfolge
        // mit beliebigem Whitespace dazwischen.
        const registerPattern = /registerTool\s*\(\s*['"]get_plugin_detail['"]/;
        expect(source).toMatch(registerPattern);
        // Sanity: getPluginDetail wird auch importiert.
        expect(source).toMatch(/getPluginDetail/);
    });
});
//# sourceMappingURL=get-plugin-detail.test.js.map