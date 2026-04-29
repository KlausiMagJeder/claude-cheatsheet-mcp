#!/usr/bin/env node
/**
 * Copy non-TS build artifacts from src/ to dist/.
 *
 * WHY a Node-Script statt `cp -r`:
 *   - Cross-Platform (Windows kennt `cp` nicht; engines.node >=20 ist garantiert).
 *   - Explizite Fehler mit klarem Pfad, falls eine Asset-Datei fehlt, statt
 *     stiller Teil-Kopie wie bei `cp` + Shell-Globs.
 *   - Regressionsschutz: Fehlende Assets brechen den Build statt später den
 *     Runtime-HTTP-Server mit 404 zu belasten (siehe Bug: dashboard.html
 *     nicht in dist/web/ gelandet, Task 23 Step 2).
 *
 * Assets:
 *   - src/static/        -> dist/static/        (workflows.yaml, cli-commands.yaml)
 *   - src/web/dashboard.html -> dist/web/dashboard.html
 *
 * Ausführung: `node scripts/copy-assets.mjs` nach `tsc`.
 */

import { cp, mkdir, access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

/** @type {Array<{ src: string; dest: string; recursive: boolean }>} */
const ASSETS = [
  {
    src: resolve(ROOT, 'src/static'),
    dest: resolve(ROOT, 'dist/static'),
    recursive: true,
  },
  {
    src: resolve(ROOT, 'src/web/dashboard.html'),
    dest: resolve(ROOT, 'dist/web/dashboard.html'),
    recursive: false,
  },
];

async function ensureParent(p) {
  await mkdir(dirname(p), { recursive: true });
}

async function copyAsset(asset) {
  try {
    await access(asset.src);
  } catch {
    throw new Error(`[copy-assets] source missing: ${asset.src}`);
  }
  await ensureParent(asset.dest);
  await cp(asset.src, asset.dest, {
    recursive: asset.recursive,
    force: true,
  });
  process.stdout.write(`[copy-assets] ${asset.src} -> ${asset.dest}\n`);
}

async function main() {
  for (const asset of ASSETS) {
    await copyAsset(asset);
  }
}

main().catch((err) => {
  process.stderr.write(`[copy-assets] FAILED: ${err.message}\n`);
  process.exit(1);
});
