import { readInstalledPlugins } from '../../scanner/installed-plugins.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

describe('readInstalledPlugins', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cheatsheet-ip-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns null when installed_plugins.json is missing', async () => {
    const result = await readInstalledPlugins(tmpDir);
    expect(result).toBeNull();
  });

  it('parses a minimal installed_plugins.json and yields plugin roots', async () => {
    const ip = {
      'superpowers@claude-plugins-official': {
        version: '5.0.7',
        installPath: path.join(tmpDir, 'cache', 'claude-plugins-official', 'superpowers', '5.0.7'),
      },
    };
    fs.writeFileSync(path.join(tmpDir, 'installed_plugins.json'), JSON.stringify(ip));

    const result = await readInstalledPlugins(tmpDir);
    expect(result).not.toBeNull();
    expect(result!.length).toBe(1);
    expect(result![0].plugin).toBe('superpowers');
    expect(result![0].marketplace).toBe('claude-plugins-official');
    expect(result![0].version).toBe('5.0.7');
  });

  it('returns null (not throws) on malformed JSON so caller falls back to glob', async () => {
    fs.writeFileSync(path.join(tmpDir, 'installed_plugins.json'), '{ not json');
    const result = await readInstalledPlugins(tmpDir);
    expect(result).toBeNull();
  });

  it('parses v2 schema correctly', async () => {
    const ip = {
      version: 2,
      plugins: {
        'superpowers@claude-plugins-official': [
          {
            scope: 'user',
            installPath: path.join(
              tmpDir,
              'cache',
              'claude-plugins-official',
              'superpowers',
              '5.0.7',
            ),
            version: '5.0.7',
            installedAt: '2026-03-27T09:03:48.206Z',
            lastUpdated: '2026-04-01T06:36:14.903Z',
            gitCommitSha: 'eafe962b18f6c5dc70fb7c8cc7e83e61f4cdde06',
          },
        ],
        'claude-hud@claude-hud': [
          {
            scope: 'user',
            installPath: path.join(tmpDir, 'cache', 'claude-hud', 'claude-hud', '0.0.12'),
            version: '0.0.12',
            installedAt: '2026-04-16T10:00:23.318Z',
            lastUpdated: '2026-04-16T10:00:23.318Z',
            gitCommitSha: 'bfde7cfd9689faa35fca1aacb08960de3c837ffc',
          },
        ],
      },
    };
    fs.writeFileSync(path.join(tmpDir, 'installed_plugins.json'), JSON.stringify(ip));

    const result = await readInstalledPlugins(tmpDir);
    expect(result).not.toBeNull();
    expect(result!.length).toBe(2);

    const superpowers = result!.find((r) => r.plugin === 'superpowers');
    expect(superpowers).toBeDefined();
    expect(superpowers!.marketplace).toBe('claude-plugins-official');
    expect(superpowers!.version).toBe('5.0.7');
    expect(superpowers!.installPath).toContain('superpowers/5.0.7');

    const hud = result!.find((r) => r.plugin === 'claude-hud');
    expect(hud).toBeDefined();
    expect(hud!.marketplace).toBe('claude-hud');
    expect(hud!.version).toBe('0.0.12');
  });

  it('v1 schema still works (backward compatibility)', async () => {
    const ip = {
      'plugin-a@mp-one': {
        version: '1.0.0',
        installPath: path.join(tmpDir, 'cache', 'mp-one', 'plugin-a', '1.0.0'),
      },
      'plugin-b@mp-two': {
        version: '2.5.0',
        installPath: path.join(tmpDir, 'cache', 'mp-two', 'plugin-b', '2.5.0'),
      },
    };
    fs.writeFileSync(path.join(tmpDir, 'installed_plugins.json'), JSON.stringify(ip));

    const result = await readInstalledPlugins(tmpDir);
    expect(result).not.toBeNull();
    expect(result!.length).toBe(2);
    const names = result!.map((r) => r.plugin).sort();
    expect(names).toEqual(['plugin-a', 'plugin-b']);
  });

  it('returns null for unrecognized schema (v2 marker without plugins object)', async () => {
    const ip = {
      version: 2,
      // `plugins` fehlt oder ist kein Object
      foo: 'bar',
    };
    fs.writeFileSync(path.join(tmpDir, 'installed_plugins.json'), JSON.stringify(ip));

    const result = await readInstalledPlugins(tmpDir);
    expect(result).toBeNull();
  });

  it('empty plugins object in v2 returns empty array', async () => {
    const ip = {
      version: 2,
      plugins: {},
    };
    fs.writeFileSync(path.join(tmpDir, 'installed_plugins.json'), JSON.stringify(ip));

    const result = await readInstalledPlugins(tmpDir);
    expect(result).not.toBeNull();
    expect(result).toEqual([]);
  });
});
