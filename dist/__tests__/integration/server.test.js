/**
 * Integration test: MCP stdio-server lifecycle and protocol conformance.
 *
 * Prerequisites: `npm run build` must have been executed before this suite runs.
 * The beforeAll() guard verifies dist/index.js exists and aborts with a clear
 * error message when the build is stale or missing.
 *
 * Communication model:
 *   - JSON-RPC 2.0 frames are newline-delimited JSON sent to the server's stdin.
 *   - The server replies on stdout with newline-delimited JSON.
 *   - All server-internal logs go to stderr (stdio-cleanliness invariant).
 */
import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_ENTRY = path.resolve(__dirname, '../../../dist/index.js');
/** The 14 tool names registered in src/index.ts — ground truth for regression. */
const EXPECTED_TOOL_NAMES = [
    'list_skills',
    'list_commands',
    'list_agents',
    'list_mcp_tools',
    'list_cli_commands',
    'list_hooks',
    'list_roles',
    'get_detail',
    'get_plugin_detail',
    'get_stats',
    'get_workflows',
    'search',
    'suggest',
    'refresh',
];
/** Serialize a JSON-RPC 2.0 request as a newline-terminated frame. */
function frame(req) {
    return JSON.stringify(req) + '\n';
}
/**
 * Wait for the first line on stdout that parses as JSON.
 * Rejects with a timeout error if no valid JSON line arrives within `timeoutMs`.
 */
function waitForJsonLine(proc, timeoutMs) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error(`Timed out waiting for JSON line after ${timeoutMs} ms`));
        }, timeoutMs);
        let buffer = '';
        const onData = (chunk) => {
            buffer += chunk.toString();
            const lines = buffer.split('\n');
            // Keep the incomplete last fragment in the buffer.
            buffer = lines.pop() ?? '';
            for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed.length === 0)
                    continue;
                try {
                    const parsed = JSON.parse(trimmed);
                    clearTimeout(timer);
                    proc.stdout?.off('data', onData);
                    resolve(parsed);
                    return;
                }
                catch {
                    // Non-JSON on stdout is itself a test failure — collected and
                    // asserted in the stdout-purity test.
                }
            }
        };
        proc.stdout?.on('data', onData);
    });
}
/**
 * Collect all stdout lines for `durationMs` milliseconds, then resolve.
 * Used for the stdout-purity test where we need to observe the full output
 * window without hanging forever.
 */
function collectStdoutLines(proc, durationMs) {
    return new Promise((resolve) => {
        const lines = [];
        let buffer = '';
        const onData = (chunk) => {
            buffer += chunk.toString();
            const parts = buffer.split('\n');
            buffer = parts.pop() ?? '';
            for (const l of parts) {
                if (l.trim().length > 0)
                    lines.push(l.trim());
            }
        };
        proc.stdout?.on('data', onData);
        setTimeout(() => {
            proc.stdout?.off('data', onData);
            // Flush remaining buffer.
            if (buffer.trim().length > 0)
                lines.push(buffer.trim());
            resolve(lines);
        }, durationMs);
    });
}
/** Spawn the MCP server and return the child process. */
function spawnServer() {
    return spawn('node', [DIST_ENTRY], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env },
    });
}
// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------
beforeAll(() => {
    if (!fs.existsSync(DIST_ENTRY)) {
        throw new Error(`dist/index.js not found at ${DIST_ENTRY}. ` +
            'Run `npm run build` before executing the integration tests.');
    }
});
describe('MCP server integration', () => {
    // -------------------------------------------------------------------------
    // Scenario 1 — Initialize handshake
    // -------------------------------------------------------------------------
    describe('initialize handshake', () => {
        let proc;
        afterEach(() => {
            proc.kill('SIGTERM');
        });
        it('responds to initialize with a valid JSON-RPC result', async () => {
            proc = spawnServer();
            const req = {
                jsonrpc: '2.0',
                id: 1,
                method: 'initialize',
                params: {
                    protocolVersion: '2024-11-05',
                    capabilities: {},
                    clientInfo: { name: 'test-client', version: '0.0.1' },
                },
            };
            proc.stdin?.write(frame(req));
            const response = await waitForJsonLine(proc, 5_000);
            // Must be a well-formed JSON-RPC 2.0 response.
            expect(response.jsonrpc).toBe('2.0');
            expect(response.id).toBe(1);
            expect(response.error).toBeUndefined();
            const result = response.result;
            // protocolVersion must be present and non-empty.
            expect(typeof result['protocolVersion']).toBe('string');
            expect(result['protocolVersion'].length).toBeGreaterThan(0);
            // serverInfo must carry name and version.
            const serverInfo = result['serverInfo'];
            expect(serverInfo).toBeDefined();
            expect(serverInfo['name']).toBe('claude-cheatsheet-mcp');
            expect(typeof serverInfo['version']).toBe('string');
            // capabilities.tools must be present (server declared tools capability).
            const capabilities = result['capabilities'];
            expect(capabilities).toBeDefined();
            expect(capabilities['tools']).toBeDefined();
        });
    });
    // -------------------------------------------------------------------------
    // Scenario 2 — tools/list
    // -------------------------------------------------------------------------
    describe('tools/list', () => {
        let proc;
        afterEach(() => {
            proc.kill('SIGTERM');
        });
        it('returns exactly 14 tools with the correct names', async () => {
            proc = spawnServer();
            // MCP requires an initialize before tools/list.
            const initReq = {
                jsonrpc: '2.0',
                id: 1,
                method: 'initialize',
                params: {
                    protocolVersion: '2024-11-05',
                    capabilities: {},
                    clientInfo: { name: 'test-client', version: '0.0.1' },
                },
            };
            proc.stdin?.write(frame(initReq));
            // Wait for initialize response before sending tools/list.
            await waitForJsonLine(proc, 5_000);
            // Send notifications/initialized (required by MCP spec after initialize).
            proc.stdin?.write(JSON.stringify({
                jsonrpc: '2.0',
                method: 'notifications/initialized',
                params: {},
            }) + '\n');
            const listReq = {
                jsonrpc: '2.0',
                id: 2,
                method: 'tools/list',
                params: {},
            };
            proc.stdin?.write(frame(listReq));
            const response = await waitForJsonLine(proc, 5_000);
            expect(response.jsonrpc).toBe('2.0');
            expect(response.id).toBe(2);
            expect(response.error).toBeUndefined();
            const tools = response.result['tools'];
            expect(Array.isArray(tools)).toBe(true);
            expect(tools).toHaveLength(EXPECTED_TOOL_NAMES.length);
            const returnedNames = tools.map((t) => t.name).sort();
            const expectedSorted = [...EXPECTED_TOOL_NAMES].sort();
            expect(returnedNames).toEqual(expectedSorted);
        });
    });
    // -------------------------------------------------------------------------
    // Scenario 3 — stdout purity
    // -------------------------------------------------------------------------
    describe('stdout purity', () => {
        let proc;
        afterEach(() => {
            proc.kill('SIGTERM');
        });
        it('emits only valid JSON lines on stdout', async () => {
            proc = spawnServer();
            // Trigger initialize so the server emits at least one response.
            const initReq = {
                jsonrpc: '2.0',
                id: 1,
                method: 'initialize',
                params: {
                    protocolVersion: '2024-11-05',
                    capabilities: {},
                    clientInfo: { name: 'test-client', version: '0.0.1' },
                },
            };
            proc.stdin?.write(frame(initReq));
            // Collect stdout lines for 1 500 ms — enough for initialize response.
            const lines = await collectStdoutLines(proc, 1_500);
            // There must be at least the initialize response.
            expect(lines.length).toBeGreaterThan(0);
            // Every line on stdout must be valid JSON — no stray log messages.
            for (const line of lines) {
                let parsed;
                // Using try/catch to produce a clear failure message when a non-JSON
                // line appears (Jest's expect().not.toThrow() doesn't accept a custom
                // message as a second argument in this version).
                try {
                    parsed = JSON.parse(line);
                }
                catch {
                    throw new Error(`Non-JSON line on stdout: ${line}`);
                }
                // Must be an object (not an array/primitive at top level).
                expect(typeof parsed).toBe('object');
                expect(parsed).not.toBeNull();
            }
        });
    });
    // -------------------------------------------------------------------------
    // Scenario 4 — graceful shutdown
    // -------------------------------------------------------------------------
    describe('graceful shutdown', () => {
        it('exits with code 0 after SIGTERM', async () => {
            const proc = spawnServer();
            // Let the server start up by sending initialize and waiting for the response.
            const initReq = {
                jsonrpc: '2.0',
                id: 1,
                method: 'initialize',
                params: {
                    protocolVersion: '2024-11-05',
                    capabilities: {},
                    clientInfo: { name: 'test-client', version: '0.0.1' },
                },
            };
            proc.stdin?.write(frame(initReq));
            await waitForJsonLine(proc, 5_000);
            // Now signal shutdown and wait for the process to exit.
            const exitCode = await new Promise((resolve, reject) => {
                const timer = setTimeout(() => {
                    proc.kill('SIGKILL');
                    reject(new Error('Server did not exit within 3 000 ms after SIGTERM'));
                }, 3_000);
                proc.on('exit', (code) => {
                    clearTimeout(timer);
                    resolve(code);
                });
                proc.kill('SIGTERM');
            });
            expect(exitCode).toBe(0);
        });
    });
});
//# sourceMappingURL=server.test.js.map