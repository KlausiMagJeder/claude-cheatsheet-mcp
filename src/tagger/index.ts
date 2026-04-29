import type { CatalogEntry } from '../types.js';

const KEYWORD_MAP: Record<string, string[]> = {
  review: ['pr', 'review', 'pull request', 'code review', 'code-review'],
  testing: ['test', 'tdd', 'spec', 'coverage', 'minitest'],
  debugging: ['debug', 'bug', 'error', 'failure', 'fix'],
  planning: ['plan', 'brainstorm', 'design', 'architecture'],
  jira: ['jira', 'issue', 'ticket', 'sprint'],
  confluence: ['confluence', 'wiki', 'documentation'],
  git: ['git', 'branch', 'commit', 'merge', 'worktree'],
  deployment: ['deploy', 'ci', 'cd', 'pipeline', 'release'],
  security: ['security', 'auth', 'permission', 'vulnerability'],
  memory: ['memory', 'observation', 'timeline', 'remember'],
  ui: ['ui', 'ux', 'frontend', 'component', 'css'],
  search: ['search', 'find', 'query', 'lookup'],
  quality: ['rubocop', 'lint', 'style', 'simplify', 'refactor'],
};

export function generateTags(entry: CatalogEntry, content?: string): string[] {
  const tags = new Set<string>();

  // Kind-based tag
  tags.add(entry.kind);

  // Build searchable text
  const text = [entry.name, entry.description, content ?? ''].join(' ').toLowerCase();

  // Keyword matching
  for (const [tag, keywords] of Object.entries(KEYWORD_MAP)) {
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        tags.add(tag);
        break;
      }
    }
  }

  return Array.from(tags);
}

export interface TagOverride {
  add: string[];
  remove: string[];
}

export function applyOverrides(
  tags: string[],
  overrides: Record<string, TagOverride>,
  entryId: string,
): string[] {
  const override = overrides[entryId];
  if (!override) return tags;

  const tagSet = new Set(tags);
  for (const tag of override.add) tagSet.add(tag);
  for (const tag of override.remove) tagSet.delete(tag);
  return Array.from(tagSet);
}
