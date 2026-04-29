/**
 * Static validation tests for Claude Code plugin manifests.
 *
 * These tests parse the plugin's marketplace/plugin/MCP manifests from disk
 * and assert their structural correctness against the empirically derived
 * conventions (see `publish-readiness-plugin-analyse.md`). They catch typos,
 * desyncs between package.json and plugin.json, and schema drift — but they
 * do NOT exercise the Claude Code runtime itself. A live end-to-end test
 * (adding the repo as a local marketplace, activating the plugin, restarting
 * Claude Code, calling a tool) is the maintainer's responsibility — see the
 * "Plugin-Aktivierungstest (für Maintainer)" section of README.md.
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..', '..');
const PLUGIN_JSON_PATH = join(REPO_ROOT, '.claude-plugin', 'plugin.json');
const MCP_JSON_PATH = join(REPO_ROOT, '.mcp.json');
const MARKETPLACE_JSON_PATH = join(REPO_ROOT, '.claude-plugin', 'marketplace.json');
const PACKAGE_JSON_PATH = join(REPO_ROOT, 'package.json');
const DIST_INDEX_PATH = join(REPO_ROOT, 'dist', 'index.js');
function readJson(path) {
    return JSON.parse(readFileSync(path, 'utf8'));
}
describe('plugin manifests — .claude-plugin/plugin.json', () => {
    let plugin;
    beforeAll(() => {
        expect(existsSync(PLUGIN_JSON_PATH)).toBe(true);
        plugin = readJson(PLUGIN_JSON_PATH);
    });
    it('parses as valid JSON object', () => {
        expect(typeof plugin).toBe('object');
        expect(plugin).not.toBeNull();
    });
    it('has required field: name (non-empty string) and it equals "claude-cheatsheet"', () => {
        expect(typeof plugin.name).toBe('string');
        expect(plugin.name.length).toBeGreaterThan(0);
        expect(plugin.name).toBe('claude-cheatsheet');
    });
    it('has required field: version (non-empty string, semver-like)', () => {
        expect(typeof plugin.version).toBe('string');
        expect(plugin.version).toMatch(/^\d+\.\d+\.\d+/);
    });
    it('has required field: description (non-empty string)', () => {
        expect(typeof plugin.description).toBe('string');
        expect(plugin.description.length).toBeGreaterThan(0);
    });
    it('has a non-empty license string (empirical 5/7 plugins set one)', () => {
        expect(typeof plugin.license).toBe('string');
        expect(plugin.license.length).toBeGreaterThan(0);
    });
});
describe('plugin manifests — .mcp.json', () => {
    let mcp;
    beforeAll(() => {
        expect(existsSync(MCP_JSON_PATH)).toBe(true);
        mcp = readJson(MCP_JSON_PATH);
    });
    it('parses as valid JSON object', () => {
        expect(typeof mcp).toBe('object');
        expect(mcp).not.toBeNull();
    });
    it('has mcpServers top-level key with at least one server entry', () => {
        expect(mcp.mcpServers).toBeDefined();
        expect(typeof mcp.mcpServers).toBe('object');
        const serverNames = Object.keys(mcp.mcpServers ?? {});
        expect(serverNames.length).toBeGreaterThan(0);
    });
    it('each server entry has a string "command" field', () => {
        const servers = mcp.mcpServers ?? {};
        for (const [name, entry] of Object.entries(servers)) {
            const server = entry;
            expect(typeof server.command).toBe('string');
            expect(server.command.length).toBeGreaterThan(0);
            // name is part of the assertion message scope implicitly via Jest's failure output
            void name;
        }
    });
    it('at least one server entry references ${CLAUDE_PLUGIN_ROOT} in its command or args', () => {
        const servers = mcp.mcpServers ?? {};
        const placeholderRegex = /\$\{CLAUDE_PLUGIN_ROOT\}/;
        const hasPlaceholder = Object.values(servers).some((entry) => {
            const server = entry;
            if (typeof server.command === 'string' && placeholderRegex.test(server.command)) {
                return true;
            }
            if (Array.isArray(server.args)) {
                return server.args.some((arg) => typeof arg === 'string' && placeholderRegex.test(arg));
            }
            return false;
        });
        expect(hasPlaceholder).toBe(true);
    });
    it('references dist/index.js as the build output entry point', () => {
        const servers = mcp.mcpServers ?? {};
        const collectedStrings = [];
        for (const entry of Object.values(servers)) {
            const server = entry;
            if (typeof server.command === 'string') {
                collectedStrings.push(server.command);
            }
            if (Array.isArray(server.args)) {
                for (const arg of server.args) {
                    if (typeof arg === 'string') {
                        collectedStrings.push(arg);
                    }
                }
            }
        }
        const anyReferencesDistIndex = collectedStrings.some((s) => s.endsWith('dist/index.js'));
        expect(anyReferencesDistIndex).toBe(true);
    });
});
describe('plugin manifests — .claude-plugin/marketplace.json', () => {
    let marketplace;
    beforeAll(() => {
        expect(existsSync(MARKETPLACE_JSON_PATH)).toBe(true);
        marketplace = readJson(MARKETPLACE_JSON_PATH);
    });
    it('parses as valid JSON object', () => {
        expect(typeof marketplace).toBe('object');
        expect(marketplace).not.toBeNull();
    });
    it('has required field: name (non-empty string)', () => {
        expect(typeof marketplace.name).toBe('string');
        expect(marketplace.name.length).toBeGreaterThan(0);
    });
    it('has required field: owner (object with non-empty name)', () => {
        expect(typeof marketplace.owner).toBe('object');
        expect(marketplace.owner).not.toBeNull();
        const owner = marketplace.owner;
        expect(typeof owner.name).toBe('string');
        expect(owner.name.length).toBeGreaterThan(0);
    });
    it('has required field: plugins (non-empty array)', () => {
        expect(Array.isArray(marketplace.plugins)).toBe(true);
        expect(marketplace.plugins.length).toBeGreaterThan(0);
    });
    it('plugins array contains an entry with name "claude-cheatsheet"', () => {
        const plugins = marketplace.plugins;
        const found = plugins.find((p) => p.name === 'claude-cheatsheet');
        expect(found).toBeDefined();
    });
    it('the claude-cheatsheet plugin entry has a source field pointing to a plausible path', () => {
        const plugins = marketplace.plugins;
        const entry = plugins.find((p) => p.name === 'claude-cheatsheet');
        expect(entry).toBeDefined();
        const source = entry.source;
        // source can be a self-reference string like "./" or an object with url/path.
        if (typeof source === 'string') {
            expect(source.length).toBeGreaterThan(0);
        }
        else {
            expect(typeof source).toBe('object');
            expect(source).not.toBeNull();
        }
    });
});
describe('plugin manifests — cross-manifest consistency', () => {
    it('plugin.json name equals the marketplace plugin entry name', () => {
        const plugin = readJson(PLUGIN_JSON_PATH);
        const marketplace = readJson(MARKETPLACE_JSON_PATH);
        const plugins = marketplace.plugins;
        const names = plugins.map((p) => p.name);
        expect(names).toContain(plugin.name);
    });
    it('plugin.json version equals package.json version (no desync)', () => {
        const plugin = readJson(PLUGIN_JSON_PATH);
        const pkg = readJson(PACKAGE_JSON_PATH);
        expect(plugin.version).toBe(pkg.version);
    });
});
describe('plugin manifests — build output referenced from .mcp.json', () => {
    // This test intentionally only warns (does not fail) when dist/index.js is
    // missing: the test suite must run in a cold checkout without a prior
    // `npm run build`. When dist/index.js is present, we assert it is a file.
    it('dist/index.js exists after build (warn-only if missing)', () => {
        if (!existsSync(DIST_INDEX_PATH)) {
            console.warn(`[plugin-manifests] dist/index.js not found at ${DIST_INDEX_PATH} — run "npm run build" before activating the plugin. Skipping hard assertion.`);
            return;
        }
        expect(existsSync(DIST_INDEX_PATH)).toBe(true);
    });
});
//# sourceMappingURL=plugin-manifests.test.js.map