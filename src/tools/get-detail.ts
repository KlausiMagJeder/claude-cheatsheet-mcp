import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import type { CatalogEntry, CatalogIndex } from '../types.js';

interface GetDetailParams {
  id: string;
}

interface DetailResult {
  entry: CatalogEntry;
  content?: string;
}

const CLAUDE_HOME = path.join(os.homedir(), '.claude');

function isAllowedPath(filePath: string, index: CatalogIndex): boolean {
  const isUnder = (base: string): boolean =>
    filePath === base || filePath.startsWith(base + path.sep);

  if (isUnder(CLAUDE_HOME)) return true;
  if (isUnder(index.globalPath)) return true;
  if (index.projectPath && isUnder(index.projectPath)) return true;
  return false;
}

export async function getDetail(
  index: CatalogIndex,
  params: GetDetailParams,
): Promise<DetailResult | null> {
  const entry: CatalogEntry | undefined = index.entries.find((e) => e.id === params.id);
  if (!entry) return null;

  let content: string | undefined;
  if (entry.filePath) {
    if (!isAllowedPath(entry.filePath, index)) {
      return { entry };
    }
    try {
      content = await fs.readFile(entry.filePath, 'utf-8');
    } catch {
      // File not readable — return entry without content
    }
  }

  return { entry, content };
}
