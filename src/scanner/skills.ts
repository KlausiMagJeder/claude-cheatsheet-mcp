// Scanner für Skills in Claude-Code-Plugins.
//
// Pfad-Schema (empirisch verifiziert, siehe
// `~/.claude/jarvis/rolls/domain-expert/output/claude-code-platform/knowledge/claude-plugins-dirstruktur.md`):
//
//   <pluginsPath>/cache/<marketplace>/<plugin>/<version>/
//
// Vier beobachtete Plugin-Layouts:
//   A) <plugin-root>/skills/<name>/SKILL.md                         (Standard, z.B. superpowers)
//   B) <plugin-root>/.claude/skills/<name>/SKILL.md                 (z.B. ui-ux-pro-max)
//   C) nur commands/, kein skills/                                  (z.B. claude-hud — keine Skills)
//   D) nur LICENSE + README.md, kein .claude-plugin/                (z.B. ruby-lsp — keine Skills)
//
// Discovery-Strategie:
//   1. Primär: `installed_plugins.json` lesen. Wenn vorhanden → nur die dort
//      aufgelisteten Plugin-Roots scannen.
//   2. Fallback: Glob `cache/*/*/*/` plus defensiv `cache/*/@*/*/*/` für
//      (bislang empirisch unbestätigte) scoped packages.
//
// Innerhalb eines Plugin-Roots:
//   a) `.claude-plugin/plugin.json` lesen. Wenn `"skills"`-Array gesetzt →
//      diese relativen Pfade auflösen und in ihnen nach `SKILL.md` suchen.
//   b) Sonst: Fallback-Suche in `skills/` und `.claude/skills/`.
//
// Symlink-Resistenz: Vor jedem Verarbeiten eines `SKILL.md` wird der reale
// Pfad via `fs.realpath` ermittelt und gegen ein `visited`-Set geprüft, um
// Zyklen zu detektieren.

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { glob } from 'glob';
import matter from 'gray-matter';
import type { CatalogEntry } from '../types.js';
import { createEntryId } from '../types.js';
import { readInstalledPlugins, type InstalledPluginRef } from './installed-plugins.js';

// Begrenzt die Tiefe unterhalb eines Plugin-Roots bei Glob-basierter Skill-Suche,
// um Symlink-Explosionen und tiefe Zyklen abzufangen.
const MAX_SKILL_SEARCH_DEPTH = 10;

// Defensive Obergrenze für eine einzelne SKILL.md — siehe Knowledge-Doc 6.6.
const MAX_SKILL_FILE_BYTES = 1_000_000;

interface PluginContext {
  root: string;
  plugin: string;
  marketplace: string;
  version: string;
  // WARUM in metadata gespiegelt: `get_plugin_detail` (v0.5.0) liest installPath
  // aus metadata, ohne erneuten Disk-I/O. Bei lokalen `repos/`-Plugins fällt der
  // Wert auf den Repo-Root.
  installPath: string;
}

/**
 * Prüft, ob `resolved` innerhalb von `root` liegt (oder identisch ist).
 *
 * Schutz gegen Path-Traversal aus plugin.json: Ein `"../../etc"` in
 * `plugin.json.skills` könnte sonst nach `fs.resolve` außerhalb des
 * Plugin-Roots landen und dort via Glob nach SKILL.md suchen.
 */
function isUnderRoot(resolved: string, root: string): boolean {
  if (resolved === root) return true;
  return resolved.startsWith(root + path.sep);
}

/**
 * Scannt alle Skills der installierten Plugins unter `pluginsPath`.
 *
 * @param pluginsPath Absoluter Pfad zu `~/.claude/plugins/` (injizierbar für Tests).
 * @returns Liste von `CatalogEntry` mit `kind: "skill"`.
 */
export async function scanSkills(pluginsPath: string): Promise<CatalogEntry[]> {
  const contexts = await discoverPluginContexts(pluginsPath);

  const entries: CatalogEntry[] = [];
  const visitedRealPaths = new Set<string>();

  for (const ctx of contexts) {
    const skillFiles = await findSkillFilesForPlugin(ctx);

    for (const skillFile of skillFiles) {
      // Zyklen-Schutz: realen Pfad auflösen und Duplikate verhindern.
      let realPath: string;
      try {
        realPath = await fs.realpath(skillFile);
      } catch {
        continue;
      }

      if (visitedRealPaths.has(realPath)) continue;
      visitedRealPaths.add(realPath);

      const entry = await parseSkillFile(realPath, ctx);
      if (entry) entries.push(entry);
    }
  }

  return entries;
}

/**
 * Leitet die Liste der zu scannenden Plugin-Roots ab — primär aus
 * `installed_plugins.json`, sekundär via Glob. In beiden Fällen wird
 * zusätzlich der lokale `repos/`-Ordner (User-eigene, noch nicht publishte
 * Plugins) gescannt.
 */
async function discoverPluginContexts(pluginsPath: string): Promise<PluginContext[]> {
  const installed = await readInstalledPlugins(pluginsPath);

  const cacheContexts =
    installed !== null
      ? installed.map(refToContext)
      : await discoverPluginContextsViaGlob(pluginsPath);

  const repoContexts = await discoverRepoContexts(pluginsPath);

  return [...cacheContexts, ...repoContexts];
}

/**
 * Findet Plugin-Roots in `<pluginsPath>/repos/<plugin>/` — also lokal
 * entwickelte Plugins, die (noch) nicht über Marketplaces verteilt werden.
 * Das Layout ist flach (kein Marketplace-, kein Version-Unterverzeichnis);
 * siehe Domain-Expert-Knowledge § 3.3.
 */
async function discoverRepoContexts(pluginsPath: string): Promise<PluginContext[]> {
  const reposDir = path.join(pluginsPath, 'repos');

  let entries: string[];
  try {
    entries = await fs.readdir(reposDir);
  } catch {
    return [];
  }

  const contexts: PluginContext[] = [];
  for (const name of entries) {
    const root = path.join(reposDir, name);
    let stat;
    try {
      stat = await fs.stat(root);
    } catch {
      continue;
    }
    if (!stat.isDirectory()) continue;
    contexts.push({
      root,
      plugin: name,
      marketplace: 'local',
      version: 'unknown',
      installPath: root,
    });
  }
  return contexts;
}

function refToContext(ref: InstalledPluginRef): PluginContext {
  return {
    root: ref.installPath,
    plugin: ref.plugin,
    marketplace: ref.marketplace,
    version: ref.version,
    installPath: ref.installPath,
  };
}

/**
 * Glob-Fallback: Findet Plugin-Root-Verzeichnisse direkt im Dateisystem.
 * Deckt Standard-Layout `cache/<market>/<plugin>/<version>/` UND
 * defensiv Scoped-Packages `cache/<market>/@<scope>/<plugin>/<version>/` ab.
 */
async function discoverPluginContextsViaGlob(pluginsPath: string): Promise<PluginContext[]> {
  const cacheDir = path.join(pluginsPath, 'cache');

  const patterns = [
    // Standard: cache/<market>/<plugin>/<version>/
    '*/*/*/',
    // Scoped: cache/<market>/@<scope>/<plugin>/<version>/
    '*/@*/*/*/',
  ];

  const contexts: PluginContext[] = [];
  const seenRoots = new Set<string>();

  for (const pattern of patterns) {
    let matches: string[];
    try {
      matches = await glob(pattern, {
        cwd: cacheDir,
        absolute: true,
        follow: true,
        nodir: false,
      });
    } catch {
      continue;
    }

    for (const match of matches) {
      // glob kann trailing "/" liefern; normalisieren.
      const normalized = path.resolve(match);
      if (seenRoots.has(normalized)) continue;
      seenRoots.add(normalized);

      const ctx = deriveContextFromPath(normalized, cacheDir);
      if (ctx) contexts.push(ctx);
    }
  }

  return contexts;
}

/**
 * Leitet Marketplace/Plugin/Version aus einem absoluten Plugin-Root-Pfad ab.
 *
 * Erwartete Struktur:
 *   <cacheDir>/<marketplace>/<plugin>/<version>/
 * ODER (scoped):
 *   <cacheDir>/<marketplace>/@<scope>/<plugin>/<version>/
 */
function deriveContextFromPath(pluginRoot: string, cacheDir: string): PluginContext | null {
  const rel = path.relative(cacheDir, pluginRoot);
  const segments = rel.split(path.sep).filter((seg) => seg.length > 0);

  if (segments.length === 3) {
    const [marketplace, plugin, version] = segments;
    if (!marketplace || !plugin || !version) return null;
    return { root: pluginRoot, plugin, marketplace, version, installPath: pluginRoot };
  }

  if (segments.length === 4 && segments[1]?.startsWith('@')) {
    const [marketplace, scope, pluginName, version] = segments;
    if (!marketplace || !scope || !pluginName || !version) return null;
    return {
      root: pluginRoot,
      plugin: `${scope}/${pluginName}`,
      marketplace,
      version,
      installPath: pluginRoot,
    };
  }

  return null;
}

/**
 * Findet alle SKILL.md-Dateien innerhalb eines Plugin-Roots.
 *
 * Reihenfolge der Strategien:
 *   1. `plugin.json` → `skills`-Array (explizite Deklaration, autoritativ)
 *   2. Fallback: `skills/` und `.claude/skills/`
 */
async function findSkillFilesForPlugin(ctx: PluginContext): Promise<string[]> {
  const declared = await readDeclaredSkillPaths(ctx.root);

  const searchDirs: string[] = [];
  if (declared !== null && declared.length > 0) {
    // Explizit deklarierte Skill-Pfade → relativ zum Plugin-Root auflösen.
    // WARUM Whitelist-Check: Eine kompromittierte oder boshafte plugin.json
    // könnte mit "../.." aus dem Plugin-Root ausbrechen (Information
    // Disclosure über den CatalogEntry.filePath). Daher jeden aufgelösten
    // Pfad gegen ctx.root validieren und außerhalb liegende Pfade silent
    // verwerfen.
    for (const rel of declared) {
      const resolved = path.resolve(ctx.root, rel);
      if (!isUnderRoot(resolved, ctx.root)) continue;
      searchDirs.push(resolved);
    }
  } else {
    // Fallback: konventionelle Pfade. Layout A und B gleichzeitig probieren —
    // der Scanner kann nicht wissen, welches Layout das Plugin nutzt, solange
    // kein plugin.json-Hinweis vorliegt.
    searchDirs.push(path.join(ctx.root, 'skills'));
    searchDirs.push(path.join(ctx.root, '.claude', 'skills'));
  }

  const results: string[] = [];
  for (const dir of searchDirs) {
    const found = await globSkillMd(dir);
    results.push(...found);
  }

  return results;
}

/**
 * Glob nach `SKILL.md` unterhalb eines Skill-Suchordners mit
 * Symlink-follow und begrenzter Tiefe.
 */
async function globSkillMd(searchDir: string): Promise<string[]> {
  let exists = false;
  try {
    const st = await fs.stat(searchDir);
    exists = st.isDirectory();
  } catch {
    exists = false;
  }
  if (!exists) return [];

  // Ein `SKILL.md` kann in `<searchDir>/<name>/SKILL.md` liegen (Standard)
  // oder direkt in `<searchDir>/SKILL.md` (wenn plugin.json auf den
  // konkreten Skill-Ordner zeigt, wie bei Layout B:
  // "./.claude/skills/ui-ux-pro-max"). Beide Fälle abdecken.
  try {
    const matches = await glob('**/SKILL.md', {
      cwd: searchDir,
      absolute: true,
      follow: true,
      maxDepth: MAX_SKILL_SEARCH_DEPTH,
      nodir: true,
    });
    return matches;
  } catch {
    return [];
  }
}

/**
 * Liest `<pluginRoot>/.claude-plugin/plugin.json` und gibt das
 * `skills`-Array zurück (Strings), falls vorhanden. Sonst `null`.
 * Defensive: Bei I/O- oder Parse-Fehlern → `null`.
 */
async function readDeclaredSkillPaths(pluginRoot: string): Promise<string[] | null> {
  const manifestPath = path.join(pluginRoot, '.claude-plugin', 'plugin.json');

  let raw: string;
  try {
    raw = await fs.readFile(manifestPath, 'utf-8');
  } catch {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== 'object') return null;
  const skills = (parsed as { skills?: unknown }).skills;
  if (!Array.isArray(skills)) return null;

  return skills.filter((item): item is string => typeof item === 'string');
}

/**
 * Parst eine einzelne `SKILL.md` in einen `CatalogEntry`.
 */
async function parseSkillFile(filePath: string, ctx: PluginContext): Promise<CatalogEntry | null> {
  let stat;
  try {
    stat = await fs.stat(filePath);
  } catch {
    return null;
  }

  if (stat.size > MAX_SKILL_FILE_BYTES) {
    // Überspringen, aber nicht crashen — siehe Knowledge-Doc 6.6.
    return null;
  }

  let raw: string;
  try {
    raw = await fs.readFile(filePath, 'utf-8');
  } catch {
    return null;
  }

  let parsed: matter.GrayMatterFile<string>;
  try {
    parsed = matter(raw);
  } catch {
    return null;
  }

  const data = parsed.data as Record<string, unknown>;

  // Skill-Name: Frontmatter bevorzugt, sonst Ordnername (eine Ebene über SKILL.md).
  const frontmatterName = typeof data.name === 'string' ? data.name.trim() : '';
  const folderName = path.basename(path.dirname(filePath));
  const name = frontmatterName.length > 0 ? frontmatterName : folderName;
  if (name.length === 0) return null;

  const description = typeof data.description === 'string' ? data.description.trim() : '';

  const deprecatedFrontmatter = data.deprecated === true;
  const deprecatedInText =
    description.toLowerCase().includes('deprecated') ||
    parsed.content.toLowerCase().includes('deprecated');
  const deprecated = deprecatedFrontmatter || deprecatedInText;

  const trigger = typeof data.trigger === 'string' ? data.trigger : undefined;
  const redirectsTo = typeof data.redirectsTo === 'string' ? data.redirectsTo : undefined;

  const tags = Array.isArray(data.tags)
    ? data.tags.filter((t): t is string => typeof t === 'string')
    : [];

  const metadata: Record<string, unknown> = {
    plugin: ctx.plugin,
    marketplace: ctx.marketplace,
    version: ctx.version,
    installPath: ctx.installPath,
    deprecated,
  };
  if (trigger !== undefined) metadata.trigger = trigger;
  if (redirectsTo !== undefined) metadata.redirectsTo = redirectsTo;

  return {
    id: createEntryId('skill', name),
    kind: 'skill',
    name,
    description,
    tags,
    scope: 'global',
    source: ctx.plugin,
    filePath,
    metadata,
  };
}
