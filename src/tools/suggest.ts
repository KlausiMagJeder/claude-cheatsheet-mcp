import type { CatalogIndex, Suggestion } from '../types.js';
import { toShort } from '../types.js';

export interface SuggestOptions {
  task: string;
}

export function suggest(index: CatalogIndex, options: SuggestOptions): Suggestion[] {
  const keywords = options.task.toLowerCase().split(/\s+/).filter(Boolean);

  const results: Suggestion[] = [];

  for (const entry of index.entries) {
    const matchedTags = entry.tags.filter((tag) =>
      keywords.some((kw) => tag.toLowerCase().includes(kw) || kw.includes(tag.toLowerCase())),
    );

    if (matchedTags.length === 0) continue;

    results.push({
      entry: toShort(entry),
      relevance: matchedTags.length,
      reason: `Matched tags: ${matchedTags.join(', ')}`,
    });
  }

  return results.sort((a, b) => b.relevance - a.relevance);
}
