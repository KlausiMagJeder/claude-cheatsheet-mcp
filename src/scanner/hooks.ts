// Scanner für Hook-Definitionen aus vier Quellen:
//   1. <globalPath>/settings.json → hooks           (scope: "global")
//   2. <projectPath>/.claude/settings.json → hooks  (scope: "project")
//   3. <userConfigPath> (~/.claude.json) → hooks    (metadata.hookScope = "user")
//   4. <pluginsPath>/cache/<mp>/<plugin>/<version>/hooks/hooks.json
//                                                   (metadata.hookScope = "plugin")

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { glob } from 'glob';
import type { CatalogEntry, Scope } from '../types.js';
import { createEntryId } from '../types.js';

/** Shape of a single hook entry inside a hook-event group in settings.json */
interface HookEntry {
  type: string;
  command?: string;
}

/** Shape of one matcher block inside a hook-event array in settings.json */
interface HookMatcher {
  matcher: string;
  hooks: HookEntry[];
}

/** Shape of the `hooks` section in settings.json */
type HooksSection = Record<string, HookMatcher[]>;

/** Shape of settings.json (only the parts we care about) */
interface SettingsJson {
  hooks?: HooksSection;
}

interface PluginCtx {
  plugin: string;
  marketplace: string;
  version: string;
  // WARUM in metadata gespiegelt: `get_plugin_detail` (v0.5.0) liest installPath
  // aus metadata, ohne erneuten Disk-I/O.
  installPath: string;
}

type HookScopeMeta = 'user' | 'plugin';

interface SettingsFileOptions {
  scope: Scope;
  hookScope?: HookScopeMeta;
  pluginCtx?: PluginCtx;
  idPrefix: string;
}

/**
 * Reads `hooks` from a settings-like JSON file and returns one CatalogEntry
 * per matcher block.
 */
async function scanSettingsFile(
  settingsPath: string,
  options: SettingsFileOptions,
): Promise<CatalogEntry[]> {
  let raw: string;
  try {
    raw = await fs.readFile(settingsPath, 'utf-8');
  } catch {
    return [];
  }

  let parsed: SettingsJson;
  try {
    parsed = JSON.parse(raw) as SettingsJson;
  } catch {
    return [];
  }

  const hooks = parsed.hooks;
  if (!hooks) return [];

  const entries: CatalogEntry[] = [];

  for (const [event, matcherBlocks] of Object.entries(hooks)) {
    if (!Array.isArray(matcherBlocks)) continue;

    for (const block of matcherBlocks) {
      const matcher: string = block.matcher ?? '';
      const name = matcher !== '' ? `${event}:${matcher}` : event;

      const metadata: Record<string, unknown> = {
        event,
        matcher,
        hooks: block.hooks,
      };
      if (options.hookScope !== undefined) metadata.hookScope = options.hookScope;
      if (options.pluginCtx !== undefined) {
        metadata.plugin = options.pluginCtx.plugin;
        metadata.marketplace = options.pluginCtx.marketplace;
        metadata.version = options.pluginCtx.version;
        metadata.installPath = options.pluginCtx.installPath;
      }

      entries.push({
        id: createEntryId('hook', `${options.idPrefix}:${name}`),
        kind: 'hook',
        name,
        description: `Hook for ${event}${matcher ? ` matching "${matcher}"` : ''}`,
        tags: ['hook', event.toLowerCase()],
        scope: options.scope,
        source: settingsPath,
        filePath: settingsPath,
        metadata,
      });
    }
  }

  return entries;
}

/**
 * Scans hooks from global, project, user-config and plugin sources.
 *
 * @param globalPath     Path to the global `.claude` directory (contains settings.json)
 * @param projectPath    Optional path to project root (`.claude/settings.json` inside)
 * @param userConfigPath Optional path to `~/.claude.json` (user-scope hooks)
 * @param pluginsPath    Optional path to `~/.claude/plugins/` (plugin-scope hooks)
 */
export async function scanHooks(
  globalPath: string,
  projectPath?: string,
  userConfigPath?: string,
  pluginsPath?: string,
): Promise<CatalogEntry[]> {
  const entries: CatalogEntry[] = [];

  // 1. Global hooks
  const globalSettings = path.join(globalPath, 'settings.json');
  entries.push(
    ...(await scanSettingsFile(globalSettings, { scope: 'global', idPrefix: 'global' })),
  );

  // 2. Project hooks
  if (projectPath !== undefined) {
    const projectSettings = path.join(projectPath, '.claude', 'settings.json');
    entries.push(
      ...(await scanSettingsFile(projectSettings, { scope: 'project', idPrefix: 'project' })),
    );
  }

  // 3. User-scope hooks (~/.claude.json)
  if (userConfigPath !== undefined) {
    entries.push(
      ...(await scanSettingsFile(userConfigPath, {
        scope: 'global',
        hookScope: 'user',
        idPrefix: 'user',
      })),
    );
  }

  // 4. Plugin hooks
  if (pluginsPath !== undefined) {
    entries.push(...(await scanPluginHooks(pluginsPath)));
  }

  return entries;
}

async function scanPluginHooks(pluginsPath: string): Promise<CatalogEntry[]> {
  const cacheDir = path.join(pluginsPath, 'cache');

  let exists = false;
  try {
    const st = await fs.stat(cacheDir);
    exists = st.isDirectory();
  } catch {
    return [];
  }
  if (!exists) return [];

  const patterns = ['*/*/*/', '*/@*/*/*/'];
  const rootSet = new Set<string>();
  for (const pattern of patterns) {
    let matches: string[];
    try {
      matches = await glob(pattern, { cwd: cacheDir, absolute: true, follow: true, nodir: false });
    } catch {
      continue;
    }
    for (const m of matches) rootSet.add(path.resolve(m));
  }

  const entries: CatalogEntry[] = [];
  for (const root of rootSet) {
    const ctx = deriveCtxFromPath(root, cacheDir);
    if (!ctx) continue;

    const hooksFile = path.join(root, 'hooks', 'hooks.json');
    try {
      await fs.stat(hooksFile);
    } catch {
      continue;
    }

    entries.push(
      ...(await scanSettingsFile(hooksFile, {
        scope: 'global',
        hookScope: 'plugin',
        pluginCtx: ctx,
        idPrefix: `plugin:${ctx.plugin}`,
      })),
    );
  }

  return entries;
}

function deriveCtxFromPath(pluginRoot: string, cacheDir: string): PluginCtx | null {
  const rel = path.relative(cacheDir, pluginRoot);
  const segments = rel.split(path.sep).filter((s) => s.length > 0);

  if (segments.length === 3) {
    const [marketplace, plugin, version] = segments;
    if (!marketplace || !plugin || !version) return null;
    return { plugin, marketplace, version, installPath: pluginRoot };
  }
  if (segments.length === 4 && segments[1]?.startsWith('@')) {
    const [marketplace, scope, pluginName, version] = segments;
    if (!marketplace || !scope || !pluginName || !version) return null;
    return {
      plugin: `${scope}/${pluginName}`,
      marketplace,
      version,
      installPath: pluginRoot,
    };
  }
  return null;
}
