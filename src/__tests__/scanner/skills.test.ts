import { scanSkills } from '../../scanner/skills.js';
import type { CatalogEntry } from '../../types.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

describe('scanSkills', () => {
  let tmpDir: string;

  function writeSkill(dir: string, name: string, description: string): void {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'SKILL.md'),
      `---\nname: ${name}\ndescription: ${description}\n---\n\nContent of ${name}.`,
    );
  }

  function writePluginJson(pluginRoot: string, data: object): void {
    const manifestDir = path.join(pluginRoot, '.claude-plugin');
    fs.mkdirSync(manifestDir, { recursive: true });
    fs.writeFileSync(path.join(manifestDir, 'plugin.json'), JSON.stringify(data));
  }

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cheatsheet-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // --- Layout A: Standard, cache/<marketplace>/<plugin>/<version>/skills/<name>/SKILL.md
  it('Layout A: scans skills under cache/<marketplace>/<plugin>/<version>/skills/', async () => {
    const pluginRoot = path.join(
      tmpDir,
      'cache',
      'claude-plugins-official',
      'superpowers',
      '5.0.7',
    );
    writePluginJson(pluginRoot, { name: 'superpowers', version: '5.0.7' });
    writeSkill(path.join(pluginRoot, 'skills', 'brainstorming'), 'brainstorming', 'Explore ideas');

    const entries: CatalogEntry[] = await scanSkills(tmpDir);
    const names = entries.map((e) => e.name);
    expect(names).toContain('brainstorming');
    const skill = entries.find((e) => e.name === 'brainstorming')!;
    expect(skill.kind).toBe('skill');
    expect(skill.scope).toBe('global');
    expect(skill.source).toBe('superpowers');
    expect(skill.metadata.plugin).toBe('superpowers');
    expect(skill.metadata.marketplace).toBe('claude-plugins-official');
    expect(skill.metadata.version).toBe('5.0.7');
    // v0.5.0 — installPath non-null (Plan v1.1 AK A-0-2 + D-9).
    expect(typeof skill.metadata.installPath).toBe('string');
    expect(skill.metadata.installPath).toBe(pluginRoot);
    expect(skill.id).toBe('skill:brainstorming');
  });

  // --- Layout B: .claude/skills + plugin.json deklariert Skills-Pfad
  it('Layout B: follows skills-array from plugin.json pointing to .claude/skills/', async () => {
    const pluginRoot = path.join(tmpDir, 'cache', 'ui-ux-pro-max-skill', 'ui-ux-pro-max', '2.5.0');
    writePluginJson(pluginRoot, {
      name: 'ui-ux-pro-max',
      version: '2.5.0',
      skills: ['./.claude/skills/ui-ux-pro-max'],
    });
    writeSkill(
      path.join(pluginRoot, '.claude', 'skills', 'ui-ux-pro-max'),
      'ui-ux-pro-max',
      'UI/UX helper',
    );

    const entries: CatalogEntry[] = await scanSkills(tmpDir);
    const names = entries.map((e) => e.name);
    expect(names).toContain('ui-ux-pro-max');
  });

  // --- Layout C: commands-only (kein skills/-Ordner) → 0 Skills, kein Fehler
  it('Layout C: skips plugins without skills folder (commands-only)', async () => {
    const pluginRoot = path.join(tmpDir, 'cache', 'claude-hud', 'claude-hud', '0.0.12');
    writePluginJson(pluginRoot, {
      name: 'claude-hud',
      version: '0.0.12',
      commands: ['./commands/setup'],
    });
    fs.mkdirSync(path.join(pluginRoot, 'commands'), { recursive: true });
    fs.writeFileSync(
      path.join(pluginRoot, 'commands', 'setup.md'),
      '---\nname: setup\n---\nSetup.',
    );

    const entries: CatalogEntry[] = await scanSkills(tmpDir);
    expect(entries.length).toBe(0);
  });

  // --- Layout D: metadata-only (nur LICENSE + README) → 0 Skills, kein Fehler
  it('Layout D: handles metadata-only plugins (no .claude-plugin/ at all)', async () => {
    const pluginRoot = path.join(tmpDir, 'cache', 'claude-plugins-official', 'ruby-lsp', '1.0.0');
    fs.mkdirSync(pluginRoot, { recursive: true });
    fs.writeFileSync(path.join(pluginRoot, 'LICENSE'), 'MIT');
    fs.writeFileSync(path.join(pluginRoot, 'README.md'), '# ruby-lsp');

    const entries: CatalogEntry[] = await scanSkills(tmpDir);
    expect(entries.length).toBe(0);
  });

  // --- Version "unknown" als Sonder-Wert
  it("accepts version directory named 'unknown'", async () => {
    const pluginRoot = path.join(
      tmpDir,
      'cache',
      'claude-plugins-official',
      'pr-review-toolkit',
      'unknown',
    );
    writePluginJson(pluginRoot, { name: 'pr-review-toolkit' });
    writeSkill(path.join(pluginRoot, 'skills', 'review-helper'), 'review-helper', 'Helper');

    const entries: CatalogEntry[] = await scanSkills(tmpDir);
    expect(entries.map((e) => e.name)).toContain('review-helper');
    expect(entries[0].metadata.version).toBe('unknown');
  });

  // --- Deprecated-Detection
  it('detects deprecated skills via description', async () => {
    const pluginRoot = path.join(tmpDir, 'cache', 'test-mp', 'test-plugin', '1.0.0');
    writePluginJson(pluginRoot, { name: 'test-plugin' });
    writeSkill(
      path.join(pluginRoot, 'skills', 'old-skill'),
      'old-skill',
      'Deprecated - use new-skill instead',
    );

    const entries: CatalogEntry[] = await scanSkills(tmpDir);
    const old = entries.find((e) => e.name === 'old-skill');
    expect(old?.metadata.deprecated).toBe(true);
  });

  // --- Scoped Packages (defensiv — noch nicht empirisch verifiziert)
  it('defensively handles scoped package paths (@scope/plugin)', async () => {
    const pluginRoot = path.join(tmpDir, 'cache', 'scoped-mp', '@acme', 'tool', '0.1.0');
    writePluginJson(pluginRoot, { name: '@acme/tool', version: '0.1.0' });
    writeSkill(path.join(pluginRoot, 'skills', 'scoped-skill'), 'scoped-skill', 'A scoped skill');

    const entries: CatalogEntry[] = await scanSkills(tmpDir);
    const names = entries.map((e) => e.name);
    expect(names).toContain('scoped-skill');
  });

  // --- Symlink-Zyklen-Resistenz
  it('is resilient against symlink cycles', async () => {
    const pluginRoot = path.join(tmpDir, 'cache', 'mp', 'cycle-plugin', '1.0.0');
    writePluginJson(pluginRoot, { name: 'cycle-plugin' });
    writeSkill(path.join(pluginRoot, 'skills', 'real-skill'), 'real-skill', 'Real');
    // Zyklus: skills/loop -> skills  (zurück in den eigenen Parent)
    try {
      fs.symlinkSync(
        path.join(pluginRoot, 'skills'),
        path.join(pluginRoot, 'skills', 'loop'),
        'dir',
      );
    } catch {
      return; // Symlinks auf der Plattform evtl. nicht möglich (z.B. Windows-CI ohne Admin) — Test überspringen
    }

    const entries: CatalogEntry[] = await scanSkills(tmpDir);
    // Scanner darf nicht hängen, Duplikate durch Zyklus müssen vermieden werden.
    const realSkills = entries.filter((e) => e.name === 'real-skill');
    expect(realSkills.length).toBe(1);
  });

  // --- Path-Traversal-Abwehr: plugin.json.skills darf nicht aus dem
  //     Plugin-Root ausbrechen (Regression für M3).
  it('rejects plugin.json.skills paths that escape the plugin root', async () => {
    const pluginRoot = path.join(tmpDir, 'cache', 'mp', 'evil-plugin', '1.0.0');
    writePluginJson(pluginRoot, {
      name: 'evil-plugin',
      // Boshafter Pfad: bricht drei Ebenen aus dem Plugin-Root heraus,
      // landet im tmpDir oberhalb und würde ohne Whitelist-Check dort
      // nach SKILL.md suchen.
      skills: ['../../../outside-skills'],
    });
    // Eine "lockende" SKILL.md außerhalb des Plugin-Roots:
    const outsideDir = path.join(tmpDir, 'outside-skills', 'leak');
    fs.mkdirSync(outsideDir, { recursive: true });
    fs.writeFileSync(
      path.join(outsideDir, 'SKILL.md'),
      '---\nname: leak\ndescription: should-not-appear\n---\nLeaked.',
    );

    const entries: CatalogEntry[] = await scanSkills(tmpDir);
    expect(entries.find((e) => e.name === 'leak')).toBeUndefined();
  });

  // ===========================================================================
  // MINOR 2 — repos/-Fallback (lokale Dev-Plugins)
  // ===========================================================================

  describe('Minor 2 — repos/-Fallback', () => {
    it('scans skills from ~/.claude/plugins/repos/<plugin>/skills/<name>/SKILL.md', async () => {
      // Kein cache/, nur repos/-Inhalt
      const repoPlugin = path.join(tmpDir, 'repos', 'local-dev-plugin');
      fs.mkdirSync(repoPlugin, { recursive: true });
      writeSkill(
        path.join(repoPlugin, 'skills', 'dev-skill'),
        'dev-skill',
        'Locally developed skill',
      );

      const entries: CatalogEntry[] = await scanSkills(tmpDir);
      const names = entries.map((e) => e.name);
      expect(names).toContain('dev-skill');
    });

    it('annotates repos-skills with marketplace = "local" (or similar)', async () => {
      const repoPlugin = path.join(tmpDir, 'repos', 'my-local-plugin');
      fs.mkdirSync(repoPlugin, { recursive: true });
      writeSkill(path.join(repoPlugin, 'skills', 'my-skill'), 'my-skill', 'Local');

      const entries: CatalogEntry[] = await scanSkills(tmpDir);
      const skill = entries.find((e) => e.name === 'my-skill');
      expect(skill).toBeDefined();
      expect(skill!.metadata.plugin).toBe('my-local-plugin');
    });

    it('still scans cache/ when repos/ is also present', async () => {
      // Plugin im cache/:
      const cacheRoot = path.join(tmpDir, 'cache', 'mp', 'cache-plugin', '1.0.0');
      writePluginJson(cacheRoot, { name: 'cache-plugin' });
      writeSkill(path.join(cacheRoot, 'skills', 'cache-skill'), 'cache-skill', 'From cache');

      // Zusätzlich Plugin im repos/:
      const repoRoot = path.join(tmpDir, 'repos', 'repo-plugin');
      fs.mkdirSync(repoRoot, { recursive: true });
      writeSkill(path.join(repoRoot, 'skills', 'repo-skill'), 'repo-skill', 'From repos');

      const entries: CatalogEntry[] = await scanSkills(tmpDir);
      const names = entries.map((e) => e.name);
      expect(names).toContain('cache-skill');
      expect(names).toContain('repo-skill');
    });
  });

  // --- installed_plugins.json als primäre Quelle
  it('prefers installed_plugins.json when present', async () => {
    const pluginRoot = path.join(tmpDir, 'cache', 'mp-a', 'plugin-a', '1.0.0');
    writePluginJson(pluginRoot, { name: 'plugin-a' });
    writeSkill(path.join(pluginRoot, 'skills', 'ip-skill'), 'ip-skill', 'From installed list');

    // Zweites Plugin existiert auf Disk, ist aber NICHT in installed_plugins.json → darf ignoriert werden,
    // wenn die primäre Quelle genutzt wird.
    const strayRoot = path.join(tmpDir, 'cache', 'mp-b', 'plugin-b', '1.0.0');
    writePluginJson(strayRoot, { name: 'plugin-b' });
    writeSkill(path.join(strayRoot, 'skills', 'stray-skill'), 'stray-skill', 'Should be ignored');

    fs.writeFileSync(
      path.join(tmpDir, 'installed_plugins.json'),
      JSON.stringify({
        'plugin-a@mp-a': { version: '1.0.0', installPath: pluginRoot },
      }),
    );

    const entries: CatalogEntry[] = await scanSkills(tmpDir);
    const names = entries.map((e) => e.name);
    expect(names).toContain('ip-skill');
    expect(names).not.toContain('stray-skill');
  });
});
