import { scanHooks } from '../../scanner/hooks.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

describe('scanHooks', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cheatsheet-test-'));
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
          SessionStart: [
            {
              matcher: '',
              hooks: [{ type: 'command', command: 'echo hello' }],
            },
          ],
        },
      }),
    );
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('reads hooks from settings.json', async () => {
    const entries = await scanHooks(tmpDir, undefined);
    expect(entries.length).toBe(2);
  });

  it('creates correct entry with event and matcher', async () => {
    const entries = await scanHooks(tmpDir, undefined);
    const bashHook = entries.find((e) => e.metadata.matcher === 'Bash');
    expect(bashHook).toBeDefined();
    expect(bashHook!.kind).toBe('hook');
    expect(bashHook!.metadata.event).toBe('PreToolUse');
  });

  it('scans project hooks too', async () => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cheatsheet-project-'));
    const projectClaudeDir = path.join(projectDir, '.claude');
    fs.mkdirSync(projectClaudeDir, { recursive: true });
    fs.writeFileSync(
      path.join(projectClaudeDir, 'settings.json'),
      JSON.stringify({
        hooks: {
          PostToolUse: [
            {
              matcher: 'Edit',
              hooks: [{ type: 'command', command: 'rubocop' }],
            },
          ],
        },
      }),
    );

    const entries = await scanHooks(tmpDir, projectDir);
    expect(entries.length).toBe(3);
    const projectHook = entries.find((e) => e.scope === 'project');
    expect(projectHook).toBeDefined();

    fs.rmSync(projectDir, { recursive: true, force: true });
  });

  // ===========================================================================
  // MINOR 1 — User-Hooks aus ~/.claude.json
  // ===========================================================================

  describe('Minor 1 — User-Hooks aus ~/.claude.json', () => {
    it('reads user-scope hooks from ~/.claude.json via userConfigPath', async () => {
      const userConfigPath = path.join(tmpDir, '.claude.json');
      fs.writeFileSync(
        userConfigPath,
        JSON.stringify({
          hooks: {
            UserPromptSubmit: [
              {
                matcher: '',
                hooks: [{ type: 'command', command: 'echo user-prompt' }],
              },
            ],
          },
        }),
      );

      // Erwartete neue Signatur:
      // scanHooks(globalPath, projectPath?, userConfigPath?, pluginsPath?)
      const entries = await scanHooks(tmpDir, undefined, userConfigPath);
      const userHooks = entries.filter((e) => e.metadata.hookScope === 'user');
      expect(userHooks.length).toBe(1);
      expect(userHooks[0].metadata.event).toBe('UserPromptSubmit');
    });

    it('does not crash when ~/.claude.json is missing or malformed', async () => {
      await expect(
        scanHooks(tmpDir, undefined, path.join(tmpDir, 'nonexistent.json')),
      ).resolves.not.toThrow();

      const broken = path.join(tmpDir, 'broken.json');
      fs.writeFileSync(broken, '{ not-json');
      await expect(scanHooks(tmpDir, undefined, broken)).resolves.not.toThrow();
    });

    it('keeps settings.json-hooks working when userConfigPath is also provided', async () => {
      const userConfigPath = path.join(tmpDir, '.claude.json');
      fs.writeFileSync(userConfigPath, JSON.stringify({ hooks: {} }));

      const entries = await scanHooks(tmpDir, undefined, userConfigPath);
      // Existierende 2 aus settings.json müssen weiter enthalten sein.
      expect(entries.length).toBeGreaterThanOrEqual(2);
      const bash = entries.find((e) => e.metadata.matcher === 'Bash');
      expect(bash).toBeDefined();
    });
  });

  // ===========================================================================
  // MINOR 1 — Plugin-Hooks aus hooks/hooks.json
  // ===========================================================================

  describe('Minor 1 — Plugin-Hooks', () => {
    function makePluginRoot(
      pluginsRoot: string,
      marketplace: string,
      plugin: string,
      version: string,
    ): string {
      const root = path.join(pluginsRoot, 'cache', marketplace, plugin, version);
      fs.mkdirSync(root, { recursive: true });
      return root;
    }

    it('scans plugin hooks from <plugin-root>/hooks/hooks.json', async () => {
      const pluginsRoot = path.join(tmpDir, 'plugins');
      const sp = makePluginRoot(pluginsRoot, 'claude-plugins-official', 'superpowers', '5.0.7');
      fs.mkdirSync(path.join(sp, 'hooks'), { recursive: true });
      fs.writeFileSync(
        path.join(sp, 'hooks', 'hooks.json'),
        JSON.stringify({
          hooks: {
            SessionStart: [
              {
                matcher: '',
                hooks: [{ type: 'command', command: 'superpowers-session-start.sh' }],
              },
            ],
          },
        }),
      );

      const cm = makePluginRoot(pluginsRoot, 'thedotmack', 'claude-mem', '10.6.2');
      fs.mkdirSync(path.join(cm, 'hooks'), { recursive: true });
      fs.writeFileSync(
        path.join(cm, 'hooks', 'hooks.json'),
        JSON.stringify({
          hooks: {
            PreCompact: [
              {
                matcher: '',
                hooks: [{ type: 'command', command: 'claude-mem-precompact.sh' }],
              },
            ],
          },
        }),
      );

      const entries = await scanHooks(tmpDir, undefined, undefined, pluginsRoot);
      const pluginHooks = entries.filter((e) => e.metadata.hookScope === 'plugin');
      expect(pluginHooks.length).toBe(2);
      const plugins = pluginHooks.map((e) => e.metadata.plugin).sort();
      expect(plugins).toEqual(['claude-mem', 'superpowers']);
    });

    it('marks plugin hooks with plugin/marketplace/version metadata', async () => {
      const pluginsRoot = path.join(tmpDir, 'plugins');
      const plug = makePluginRoot(pluginsRoot, 'my-mp', 'my-plugin', '1.0.0');
      fs.mkdirSync(path.join(plug, 'hooks'), { recursive: true });
      fs.writeFileSync(
        path.join(plug, 'hooks', 'hooks.json'),
        JSON.stringify({
          hooks: {
            PostToolUse: [
              { matcher: 'Edit', hooks: [{ type: 'command', command: 'my-posttool.sh' }] },
            ],
          },
        }),
      );

      const entries = await scanHooks(tmpDir, undefined, undefined, pluginsRoot);
      const mine = entries.find((e) => e.metadata.plugin === 'my-plugin');
      expect(mine).toBeDefined();
      expect(mine!.metadata.marketplace).toBe('my-mp');
      expect(mine!.metadata.version).toBe('1.0.0');
      expect(mine!.metadata.hookScope).toBe('plugin');
    });

    it('does not crash on malformed plugin hooks.json', async () => {
      const pluginsRoot = path.join(tmpDir, 'plugins');
      const plug = makePluginRoot(pluginsRoot, 'mp', 'broken', '1.0.0');
      fs.mkdirSync(path.join(plug, 'hooks'), { recursive: true });
      fs.writeFileSync(path.join(plug, 'hooks', 'hooks.json'), '{ not-json');

      await expect(scanHooks(tmpDir, undefined, undefined, pluginsRoot)).resolves.not.toThrow();
      const entries = await scanHooks(tmpDir, undefined, undefined, pluginsRoot);
      const pluginHooks = entries.filter((e) => e.metadata.hookScope === 'plugin');
      expect(pluginHooks).toEqual([]);
    });

    it('returns no plugin hooks when pluginsPath is missing', async () => {
      const entries = await scanHooks(
        tmpDir,
        undefined,
        undefined,
        path.join(tmpDir, 'missing-plugins'),
      );
      const pluginHooks = entries.filter((e) => e.metadata.hookScope === 'plugin');
      expect(pluginHooks).toEqual([]);
    });
  });
});
