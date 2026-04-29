import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { CatalogEntry } from '../types.js';
import { createEntryId } from '../types.js';

interface CliBuiltinDefinition {
  name: string;
  description: string;
}

export async function scanCliBuiltins(staticDir: string): Promise<CatalogEntry[]> {
  const filePath = path.join(staticDir, 'cli-builtins.json');

  let content: string;
  try {
    content = await fs.readFile(filePath, 'utf-8');
  } catch {
    return [];
  }

  // WARUM silent []: Konsistent mit installed-plugins.ts/hooks.ts —
  // malformed JSON darf den gesamten Scanner nicht crashen.
  let builtins: CliBuiltinDefinition[];
  try {
    builtins = JSON.parse(content) as CliBuiltinDefinition[];
  } catch {
    return [];
  }

  return builtins.map((cmd) => ({
    id: createEntryId('cli_command', cmd.name),
    kind: 'cli_command' as const,
    name: cmd.name,
    description: cmd.description,
    tags: [],
    scope: 'global' as const,
    source: 'built-in',
    metadata: {},
  }));
}
