export function getStats(index) {
    const byKind = {};
    for (const entry of index.entries) {
        byKind[entry.kind] = (byKind[entry.kind] ?? 0) + 1;
    }
    return {
        total: index.entries.length,
        byKind,
        scannedAt: index.scannedAt.toISOString(),
        globalPath: index.globalPath,
        projectPath: index.projectPath,
    };
}
//# sourceMappingURL=get-stats.js.map