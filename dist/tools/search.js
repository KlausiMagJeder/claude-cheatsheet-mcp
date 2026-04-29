export function search(index, options) {
    const q = options.query.toLowerCase();
    return index.entries.filter((entry) => {
        if (options.kind !== undefined && entry.kind !== options.kind) {
            return false;
        }
        return (entry.name.toLowerCase().includes(q) ||
            entry.description.toLowerCase().includes(q) ||
            entry.tags.some((tag) => tag.toLowerCase().includes(q)));
    });
}
//# sourceMappingURL=search.js.map