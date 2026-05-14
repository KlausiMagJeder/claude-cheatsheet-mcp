import { scanCommands } from '../../scanner/commands.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

describe('scanCommands', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cheatsheet-test-'));

    // Global commands
    const globalCmds = path.join(tmpDir, 'commands');
    fs.mkdirSync(globalCmds, { recursive: true });
    fs.writeFileSync(
      path.join(globalCmds, 'jarvis.md'),
      `---
name: jarvis
description: Starte den Aufgaben-Leiter
---

Jarvis content here.`,
    );

    // Project commands
    const projectCmds = path.join(tmpDir, 'project', '.claude', 'commands');
    fs.mkdirSync(projectCmds, { recursive: true });
    fs.writeFileSync(
      path.join(projectCmds, 'fix-rubocop.md'),
      `---
description: Fix Rubocop offenses in changed PR lines
---

Rubocop fixer content.`,
    );
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('scans global commands', async () => {
    const entries = await scanCommands(tmpDir, undefined);
    expect(entries.length).toBe(1);
    expect(entries[0].name).toBe('/jarvis');
    expect(entries[0].scope).toBe('global');
  });

  it('scans project commands', async () => {
    const projectPath = path.join(tmpDir, 'project');
    const entries = await scanCommands(tmpDir, projectPath);
    const projectCmd = entries.find((e) => e.scope === 'project');
    expect(projectCmd).toBeDefined();
    expect(projectCmd!.name).toBe('/fix-rubocop');
  });

  it('returns both global and project commands', async () => {
    const projectPath = path.join(tmpDir, 'project');
    const entries = await scanCommands(tmpDir, projectPath);
    expect(entries.length).toBe(2);
  });

  // ===========================================================================
  // BLOCKER 2 — Plugin-Commands scannen
  // ===========================================================================

  describe('Blocker 2 — Plugin-Commands', () => {
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

    function writeCommand(dir: string, name: string, description: string): void {
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(
        path.join(dir, `${name}.md`),
        `---\nname: ${name}\ndescription: ${description}\n---\n\nContent of ${name}.`,
      );
    }

    function writePluginJson(pluginRoot: string, data: object): void {
      const manifestDir = path.join(pluginRoot, '.claude-plugin');
      fs.mkdirSync(manifestDir, { recursive: true });
      fs.writeFileSync(path.join(manifestDir, 'plugin.json'), JSON.stringify(data));
    }

    it('scans commands from <plugin-root>/commands/*.md (Layout A)', async () => {
      const pluginsRoot = path.join(tmpDir, 'plugins');
      const superpowers = makePluginRoot(
        pluginsRoot,
        'claude-plugins-official',
        'superpowers',
        '5.0.7',
      );
      writePluginJson(superpowers, { name: 'superpowers', version: '5.0.7' });
      writeCommand(path.join(superpowers, 'commands'), 'brainstorm', 'Brainstorm creatively');
      writeCommand(path.join(superpowers, 'commands'), 'write-plan', 'Write a plan');
      writeCommand(path.join(superpowers, 'commands'), 'execute-plan', 'Execute a plan');

      // Erwartete neue Signatur: scanCommands(globalPath, projectPath?, pluginsPath?)
      const entries = await scanCommands(tmpDir, undefined, pluginsRoot);
      const pluginCmds = entries.filter((e) => e.metadata.plugin === 'superpowers');
      expect(pluginCmds.length).toBe(3);
      const names = pluginCmds.map((e) => e.name).sort();
      expect(names).toEqual(['/brainstorm', '/execute-plan', '/write-plan']);
    });

    it('marks plugin commands with metadata.plugin/marketplace/version', async () => {
      const pluginsRoot = path.join(tmpDir, 'plugins');
      const claudehud = makePluginRoot(pluginsRoot, 'claude-hud', 'claude-hud', '0.0.12');
      writePluginJson(claudehud, { name: 'claude-hud', version: '0.0.12' });
      writeCommand(path.join(claudehud, 'commands'), 'setup', 'Configure statusline');

      const entries = await scanCommands(tmpDir, undefined, pluginsRoot);
      const setup = entries.find((e) => e.name === '/setup');
      expect(setup).toBeDefined();
      expect(setup!.metadata.plugin).toBe('claude-hud');
      expect(setup!.metadata.marketplace).toBe('claude-hud');
      expect(setup!.metadata.version).toBe('0.0.12');
      // v0.5.0 — installPath non-null (Plan v1.1 AK A-0-2 + D-9).
      expect(typeof setup!.metadata.installPath).toBe('string');
      expect(setup!.metadata.installPath).toBe(claudehud);
    });

    it('assigns scope "global" (plugin-scope marked via metadata, not Scope-enum)', async () => {
      const pluginsRoot = path.join(tmpDir, 'plugins');
      const plug = makePluginRoot(pluginsRoot, 'mp', 'plug', '1.0.0');
      writePluginJson(plug, { name: 'plug' });
      writeCommand(path.join(plug, 'commands'), 'hello', 'Greet the user');

      const entries = await scanCommands(tmpDir, undefined, pluginsRoot);
      const hello = entries.find((e) => e.name === '/hello');
      expect(hello).toBeDefined();
      // Plugin-Commands sollen im globalen Kosmos sichtbar sein;
      // Differenzierung erfolgt via metadata.plugin.
      expect(hello!.scope).toBe('global');
    });

    it('prefers plugin.json → commands declaration when present (authoritative)', async () => {
      const pluginsRoot = path.join(tmpDir, 'plugins');
      const plug = makePluginRoot(pluginsRoot, 'mp', 'declared-plugin', '1.0.0');
      writePluginJson(plug, {
        name: 'declared-plugin',
        // plugin.json deklariert EINEN Command explizit — der autoritative Pfad.
        commands: ['./custom-commands/only-one.md'],
      });
      // Deklarierter Command im alternativen Ordner:
      writeCommand(path.join(plug, 'custom-commands'), 'only-one', 'The authoritative one');
      // Zusätzliche Commands im Standard-Ordner, die IGNORIERT werden müssen:
      writeCommand(path.join(plug, 'commands'), 'stray', 'Should be ignored when declared');

      const entries = await scanCommands(tmpDir, undefined, pluginsRoot);
      const pluginCmds = entries.filter((e) => e.metadata.plugin === 'declared-plugin');
      const names = pluginCmds.map((e) => e.name);
      expect(names).toContain('/only-one');
      expect(names).not.toContain('/stray');
    });

    it('handles multiple plugins in parallel', async () => {
      const pluginsRoot = path.join(tmpDir, 'plugins');

      const a = makePluginRoot(pluginsRoot, 'mp-a', 'plugin-a', '1.0.0');
      writePluginJson(a, { name: 'plugin-a' });
      writeCommand(path.join(a, 'commands'), 'cmd-a', 'A');

      const b = makePluginRoot(pluginsRoot, 'mp-b', 'plugin-b', '2.0.0');
      writePluginJson(b, { name: 'plugin-b' });
      writeCommand(path.join(b, 'commands'), 'cmd-b', 'B');

      const entries = await scanCommands(tmpDir, undefined, pluginsRoot);
      const pluginCmds = entries.filter(
        (e) => e.metadata.plugin === 'plugin-a' || e.metadata.plugin === 'plugin-b',
      );
      expect(pluginCmds.length).toBe(2);
    });

    it('returns no plugin commands when pluginsPath is missing', async () => {
      const entries = await scanCommands(tmpDir, undefined, path.join(tmpDir, 'missing-plugins'));
      const pluginCmds = entries.filter((e) => e.metadata.plugin !== undefined);
      expect(pluginCmds).toEqual([]);
    });

    it('does not break existing global+project tests when pluginsPath is undefined', async () => {
      const projectPath = path.join(tmpDir, 'project');
      // Without pluginsPath → behaves like before.
      const entries = await scanCommands(tmpDir, projectPath, undefined);
      expect(entries.length).toBe(2);
    });
  });
});
