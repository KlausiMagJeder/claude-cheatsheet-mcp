import { buildIndex } from '../../scanner/index.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

describe('buildIndex', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cheatsheet-test-'));

    // Minimal structure: just commands + settings
    const cmdsDir = path.join(tmpDir, 'commands');
    fs.mkdirSync(cmdsDir, { recursive: true });
    fs.writeFileSync(
      path.join(cmdsDir, 'test-cmd.md'),
      '---\ndescription: A test command\n---\nContent.',
    );

    fs.writeFileSync(
      path.join(tmpDir, 'settings.json'),
      JSON.stringify({ hooks: {}, mcpServers: {} }),
    );
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('builds an index with entries from all scanners', async () => {
    const index = await buildIndex(tmpDir, undefined);
    expect(index.entries.length).toBeGreaterThan(0);
    expect(index.scannedAt).toBeInstanceOf(Date);
    expect(index.globalPath).toBe(tmpDir);
  });

  it('entries have tags after tagger runs', async () => {
    const index = await buildIndex(tmpDir, undefined);
    const command = index.entries.find((e) => e.kind === 'command');
    expect(command).toBeDefined();
    expect(command!.tags).toContain('command');
  });

  it('includes builtin agents and cli commands', async () => {
    const index = await buildIndex(tmpDir, undefined);
    const kinds = new Set(index.entries.map((e) => e.kind));
    expect(kinds.has('agent')).toBe(true);
    expect(kinds.has('cli_command')).toBe(true);
  });

  // Regression for M1: Pre-existing scanner tags (e.g. Hooks-Scanner sets
  // an event tag like "pretooluse") must not be overwritten by generateTags.
  it('preserves scanner-provided tags when applying generateTags', async () => {
    // Overwrite settings.json with a PreToolUse hook so scanHooks yields
    // an entry pre-tagged with ["hook", "pretooluse"].
    fs.writeFileSync(
      path.join(tmpDir, 'settings.json'),
      JSON.stringify({
        hooks: {
          PreToolUse: [
            {
              matcher: 'Bash',
              hooks: [{ type: 'command', command: 'echo blocked' }],
            },
          ],
        },
        mcpServers: {},
      }),
    );

    const index = await buildIndex(tmpDir, undefined);
    const hook = index.entries.find((e) => e.kind === 'hook');
    expect(hook).toBeDefined();
    // Pre-existing event tag from hooks-scanner must survive the merge.
    expect(hook!.tags).toContain('pretooluse');
    // Auto-generated kind tag must also be present.
    expect(hook!.tags).toContain('hook');
  });
});
