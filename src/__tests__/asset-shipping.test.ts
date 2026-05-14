/**
 * Static validation tests for the shipped plugin assets (skill + slash commands)
 * and the 4-location version-sync invariant.
 *
 * These tests parse the on-disk skill and command markdown files (plus the
 * 4 manifests that carry a version string) and assert their structural
 * correctness against the conventions agreed in
 * `.claude/plans/idee-21-variante-d-cheatsheet-wrappers.md` Phase C.
 *
 * gray-matter: Variante 1 (`import matter from 'gray-matter'`) — verifiziert in
 * Anhang C-Sandbox des Plans (default-import, ts-jest/ESM-kompatibel,
 * `npx tsc --noEmit` ohne Fehler).
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..', '..');

const SKILL_PATH = join(REPO_ROOT, 'skills', 'cheatsheet', 'SKILL.md');
const COMMANDS_DIR = join(REPO_ROOT, 'commands');

const PACKAGE_JSON_PATH = join(REPO_ROOT, 'package.json');
const PLUGIN_JSON_PATH = join(REPO_ROOT, '.claude-plugin', 'plugin.json');
const MARKETPLACE_JSON_PATH = join(REPO_ROOT, '.claude-plugin', 'marketplace.json');
const README_PATH = join(REPO_ROOT, 'README.md');

// WARUM: Wort-Grenze + mcp__ + Kleinbuchstabe — matched nur die tatsächliche
// Tool-Notation (`mcp__server__tool`), NICHT erklärende Backticks oder Doc-Beispiele
// wie "the `mcp__` prefix in older patterns" (kein Buchstabe direkt nach __).
const MCP_NOTATION_REGEX = /\bmcp__[a-z]/;

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
}

describe('shipped plugin assets — skills/cheatsheet/SKILL.md', () => {
  let data: Record<string, unknown>;
  let content: string;

  beforeAll(() => {
    expect(existsSync(SKILL_PATH)).toBe(true);
    const parsed = matter(readFileSync(SKILL_PATH, 'utf8'));
    data = parsed.data;
    content = parsed.content;
  });

  it('has frontmatter field name exactly equal to "cheatsheet"', () => {
    expect(data.name).toBe('cheatsheet');
  });

  it('has a non-empty description >= 100 characters', () => {
    expect(typeof data.description).toBe('string');
    const description = data.description as string;
    expect(description.length).toBeGreaterThanOrEqual(100);
  });

  it('description carries the domain anchor (substring "cheatsheet" + "catalog")', () => {
    const description = data.description as string;
    // WARUM backtick-tolerant: Plan AK A-6 sagt "cheatsheet catalog", die
    // tatsächliche Description schreibt `cheatsheet` catalog (Backticks um
    // cheatsheet). Test toleriert beides via Regex mit optionalen Zeichen
    // zwischen den beiden Ankern.
    expect(description).toMatch(/cheatsheet[\s`]{0,5}catalog/);
  });

  it('body contains all 5 mandatory section headings', () => {
    const requiredHeadings = [
      '## When to Use',
      '## When NOT to Use',
      '## Tool Routing',
      '## Output Format',
      '## Edge Cases',
    ];
    for (const heading of requiredHeadings) {
      expect(content).toContain(heading);
    }
  });

  it('body mentions at least 5 of the cheatsheet MCP tools', () => {
    const expectedTools = ['suggest', 'search', 'get_stats', 'list_skills', 'get_detail'];
    for (const tool of expectedTools) {
      // Word-boundary match so `search` does not collide with `research` etc.
      const re = new RegExp(`\\b${tool}\\b`);
      expect(content).toMatch(re);
    }
  });

  it('body does NOT contain the mcp__-notation prefix', () => {
    expect(content).not.toMatch(MCP_NOTATION_REGEX);
  });
});

describe('shipped plugin assets — commands/*.md (4 files)', () => {
  const COMMANDS = [
    { file: 'cheatsheet.md', tool: 'suggest', hasArg: true },
    { file: 'cs-search.md', tool: 'search', hasArg: true },
    { file: 'cs-suggest.md', tool: 'suggest', hasArg: true },
    { file: 'cs-stats.md', tool: 'get_stats', hasArg: false },
  ];

  it.each(COMMANDS)(
    '%s exists with valid frontmatter, expected body content, and no mcp__-notation',
    ({ file, tool, hasArg }) => {
      const filePath = join(COMMANDS_DIR, file);
      expect(existsSync(filePath)).toBe(true);

      const parsed = matter(readFileSync(filePath, 'utf8'));
      const data = parsed.data;
      const content = parsed.content;

      // Frontmatter: description non-empty, allowed-tools NOT set.
      expect(typeof data.description).toBe('string');
      expect((data.description as string).length).toBeGreaterThan(0);
      expect(data['allowed-tools']).toBeUndefined();

      // argument-hint gesetzt iff hasArg === true.
      if (hasArg) {
        expect(typeof data['argument-hint']).toBe('string');
        expect((data['argument-hint'] as string).length).toBeGreaterThan(0);
      } else {
        expect(data['argument-hint']).toBeUndefined();
      }

      // Body enthält den Tool-Namen.
      expect(content.toLowerCase()).toContain(tool.toLowerCase());

      // hasArg ⇒ Body enthält das Empty-Args-Guard-Pattern.
      if (hasArg) {
        expect(content).toContain('If `$ARGUMENTS` is empty');
      }

      // Keine mcp__-Notation im Body.
      expect(content).not.toMatch(MCP_NOTATION_REGEX);
    },
  );
});

describe('shipped plugin assets — cross-asset consistency', () => {
  // WARUM: Die SKILL.md "Output Format"-Sektion definiert das Format für
  // Catalog-Listings. Alle 3 argument-tragenden Commands (cheatsheet,
  // cs-search, cs-suggest) MÜSSEN denselben Output-Format-Block tragen
  // (cs-stats hat keinen — er rendert eine andere Daten-Struktur).
  function extractOutputFormatSection(body: string): string {
    // Greife die "Output Format"-Sektion bis zur nächsten ##-Heading
    // oder bis zum Ende des Dokuments.
    const match = body.match(/##\s+Output Format\s*\n([\s\S]*?)(?=\n##\s+|$)/);
    if (!match) {
      throw new Error('No "Output Format" section found in SKILL.md body.');
    }
    return match[1].trim();
  }

  it('SKILL.md "Output Format" section is reused verbatim in argument-bearing commands', () => {
    const skillBody = matter(readFileSync(SKILL_PATH, 'utf8')).content;
    const skillOutputFormat = extractOutputFormatSection(skillBody);

    // Identifizierende Substrings aus dem Output-Format-Block. Wir prüfen
    // mehrere Anker statt eines literalen Block-Vergleichs — robust gegen
    // harmlose Whitespace-/Reihenfolge-Variationen, aber strikt genug,
    // um Drift zu fangen.
    const formatAnchors = [
      '**<name>** (<kind>)',
      'Max 10 entries per response.',
      'Use `get_detail(id=...)`',
    ];

    // Sanity: alle Anker MÜSSEN in der extrahierten SKILL-Sektion vorkommen,
    // sonst ist der Test gegen die Realität gedriftet.
    for (const anchor of formatAnchors) {
      expect(skillOutputFormat).toContain(anchor);
    }

    const argumentBearingCommands = ['cheatsheet.md', 'cs-search.md', 'cs-suggest.md'];
    for (const file of argumentBearingCommands) {
      const commandBody = matter(readFileSync(join(COMMANDS_DIR, file), 'utf8')).content;
      for (const anchor of formatAnchors) {
        expect(commandBody).toContain(anchor);
      }
    }
  });
});

describe('version sync across 5 locations', () => {
  // WARUM: CLAUDE.md mahnt diese Disziplin explizit an
  // ("plugin-manifests.test.ts does not yet enforce this, so the discipline
  // is on you"). plugin-manifests.test.ts prüft nur 2 von 5 Stellen
  // (package.json + plugin.json). Dieser Block schließt die Lücke.
  // Wichtig: marketplace.json trägt die Version unter `metadata.version`,
  // NICHT `plugins[0].version`. Die 5. Stelle ist der McpServer-Konstruktor
  // in src/index.ts (seit v0.4.0 dormant bug — siehe Plan v1.1 §D.2).

  const INDEX_TS_PATH = join(REPO_ROOT, 'src', 'index.ts');

  it('package.json, plugin.json, marketplace.json (metadata.version), README badge, and src/index.ts (McpServer ctor) all match', () => {
    const pkg = readJson(PACKAGE_JSON_PATH);
    const plugin = readJson(PLUGIN_JSON_PATH);
    const marketplace = readJson(MARKETPLACE_JSON_PATH);
    const readme = readFileSync(README_PATH, 'utf8');
    const indexTs = readFileSync(INDEX_TS_PATH, 'utf8');

    const packageVersion = pkg.version;
    const pluginVersion = plugin.version;
    const metadata = marketplace.metadata as Record<string, unknown> | undefined;
    const marketplaceVersion = metadata?.version;
    const readmeBadgeMatch = readme.match(/version-(\d+\.\d+\.\d+)-blue/);
    const readmeVersion = readmeBadgeMatch ? readmeBadgeMatch[1] : undefined;
    // WARUM Regex statt ts-AST: kein zusätzliches Dep, die Stelle ist
    // eindeutig in ~50 Zeilen (`new McpServer({ name: '...', version: '...' }, ...)`).
    // Match die erste `version: '...'`-Stelle innerhalb des McpServer-Aufrufs.
    const indexTsMatch = indexTs.match(/new McpServer\(\s*\{[^}]*version:\s*['"]([\d.]+)['"]/);
    const indexTsVersion = indexTsMatch ? indexTsMatch[1] : undefined;

    const versionsByLocation = {
      'package.json': packageVersion,
      '.claude-plugin/plugin.json': pluginVersion,
      '.claude-plugin/marketplace.json (metadata.version)': marketplaceVersion,
      'README.md (version-...-blue badge)': readmeVersion,
      'src/index.ts (McpServer ctor)': indexTsVersion,
    };

    // Sanity: alle 5 Stellen müssen einen non-empty String tragen — sonst
    // ist die Assertion auf string-equal nicht aussagekräftig.
    for (const [where, value] of Object.entries(versionsByLocation)) {
      if (typeof value !== 'string' || value.length === 0) {
        throw new Error(
          `Version missing or non-string at ${where}. Got: ${JSON.stringify(value)}\n` +
            `All locations: ${JSON.stringify(versionsByLocation, null, 2)}`,
        );
      }
    }

    // Hauptassertion: alle 5 strikt gleich. Bei Fehlschlag wird das
    // versionsByLocation-Objekt mit allen 5 Werten in der Diff-Message
    // sichtbar — Jest gibt actual/expected aus.
    //
    // HINWEIS: dieser Test ist im Working-Tree von Phase D ERWARTET ROT,
    // solange `src/index.ts` Z.45 noch '0.3.2' trägt und package.json
    // bereits auf '0.4.0' (oder höher) bumped wurde. Wird in Phase E grün,
    // wenn der Configuration Engineer alle 5 Stellen auf die neue Version
    // synchronisiert (Plan v1.1 §D.2 + AK E-2-NEU).
    expect(versionsByLocation).toEqual({
      'package.json': packageVersion,
      '.claude-plugin/plugin.json': packageVersion,
      '.claude-plugin/marketplace.json (metadata.version)': packageVersion,
      'README.md (version-...-blue badge)': packageVersion,
      'src/index.ts (McpServer ctor)': packageVersion,
    });
  });
});

describe('dashboard.html — v0.5.0 frontend smoke checks', () => {
  // WARUM Substring-Smoke statt DOM-Parsing: Frontend-DOM-Tests (jsdom) sind
  // explizit out of scope für diese Rolle (Verbot 5). Wir prüfen nur, dass
  // die in Phase B/C eingeführten Strings, Klassen und IDs im Asset
  // tatsächlich vorhanden sind — als Schutz gegen unbeabsichtigten Rückbau.
  const DASHBOARD_PATH = join(REPO_ROOT, 'src', 'web', 'dashboard.html');
  let content: string;

  beforeAll(() => {
    expect(existsSync(DASHBOARD_PATH)).toBe(true);
    content = readFileSync(DASHBOARD_PATH, 'utf8');
  });

  // #6 — Favoriten + Recent (localStorage)
  it('contains favorites localStorage key "cheatsheet:favorites:v1"', () => {
    expect(content).toContain('cheatsheet:favorites:v1');
  });

  it('contains recent localStorage key "cheatsheet:recent:v1"', () => {
    expect(content).toContain('cheatsheet:recent:v1');
  });

  it('contains favorites + recent section markers', () => {
    expect(content).toContain('favorites-section');
    expect(content).toContain('recent-section');
  });

  it('contains the favorite-btn class (star toggle)', () => {
    expect(content).toContain('favorite-btn');
  });

  // #7 — Light-Mode (Theme + No-Flash-Pattern)
  it('contains theme localStorage key "cheatsheet:theme:v1"', () => {
    expect(content).toContain('cheatsheet:theme:v1');
  });

  it('contains the light-mode CSS selector [data-theme="light"]', () => {
    expect(content).toContain('[data-theme="light"]');
  });

  it('contains the theme-toggle button id', () => {
    expect(content).toContain('theme-toggle');
  });

  // #7 — Empty-State-Container
  it('contains the empty-state container class', () => {
    expect(content).toContain('empty-state');
  });

  // Mindestens 3 deutsche UI-Strings (Phase C-1 — DE-Texte, EN-Migration F-5 später)
  it('contains the German UI strings "Favoriten" / "Helles Design aktivieren" / "Keine Treffer"', () => {
    expect(content).toContain('Favoriten');
    expect(content).toContain('Helles Design aktivieren');
    expect(content).toContain('Keine Treffer');
  });

  it('contains at least one v0.5.0 empty-state CTA marker', () => {
    // WARUM disjunktive Liste: die Empty-State-Sektionen tragen unterschiedliche
    // CTAs je nach Kontext (leerer Katalog vs. leere Suche vs. Filter). Mindestens
    // einer muss vorhanden sein — Plan v1.1 Phase C-1.
    const ctaMarkers = [
      '/plugin install',
      'Keine Treffer fuer',
      'Probier einen anderen',
      'Dein Katalog ist leer',
    ];
    const found = ctaMarkers.some((m) => content.includes(m));
    expect(found).toBe(true);
  });
});
