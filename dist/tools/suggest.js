import { toShort } from '../types.js';
export function suggest(index, options) {
    const keywords = options.task.toLowerCase().split(/\s+/).filter(Boolean);
    const results = [];
    for (const entry of index.entries) {
        const matchedTags = entry.tags.filter((tag) => keywords.some((kw) => tag.toLowerCase().includes(kw) || kw.includes(tag.toLowerCase())));
        if (matchedTags.length === 0)
            continue;
        results.push({
            entry: toShort(entry),
            relevance: matchedTags.length,
            reason: `Matched tags: ${matchedTags.join(', ')}`,
        });
    }
    return results.sort((a, b) => b.relevance - a.relevance);
}
//# sourceMappingURL=suggest.js.map